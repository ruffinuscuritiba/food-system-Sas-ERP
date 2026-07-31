import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '@/database/prisma.service';
import { CreatePrinterDto } from './dto/create-printer.dto';
import { CreateProfileDto } from './dto/create-profile.dto';
import { PrintJobStatus } from '@prisma/client';

// In-memory store: companyId → last heartbeat timestamp (ms).
// Resets on restart — intentional; agent must re-ping after deploy.
const agentHeartbeats = new Map<string, number>();
const AGENT_ONLINE_TTL_MS = 90_000; // 90s — agent pings every 30s

@Injectable()
export class PrintersService {
  constructor(private prisma: PrismaService) {}

  // ── Token dedicado do agente (nunca expira) ─────────────────────────────────
  // Gerado sob demanda na 1ª vez que a tela de Impressão pede a "chave de
  // ativação" — antes esse texto era o JWT de sessão do admin (expira em 7
  // dias), fazendo o agente parar de autenticar sozinho depois de uma semana.

  async getOrCreateAgentToken(companyId: string): Promise<string> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { printerAgentToken: true },
    });
    if (company?.printerAgentToken) return company.printerAgentToken;

    const token = randomBytes(32).toString('hex');
    await this.prisma.company.update({
      where: { id: companyId },
      data: { printerAgentToken: token },
    });
    return token;
  }

  // ── Agent heartbeat (no DB write, zero latency) ────────────────────────────

  agentPing(companyId: string): { ok: boolean } {
    agentHeartbeats.set(companyId, Date.now());
    return { ok: true };
  }

  getAgentStatus(companyId: string): { online: boolean; lastSeen: string | null } {
    const ts = agentHeartbeats.get(companyId) ?? null;
    const online = ts !== null && Date.now() - ts < AGENT_ONLINE_TTL_MS;
    return { online, lastSeen: ts ? new Date(ts).toISOString() : null };
  }

  // ── Printers ───────────────────────────────────────────────────────────────

  findAll(companyId: string) {
    return this.prisma.printer.findMany({
      where: { companyId },
      include: { profiles: true, _count: { select: { jobs: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  create(companyId: string, dto: CreatePrinterDto) {
    return this.prisma.printer.create({
      data: { ...dto, companyId },
    });
  }

  async update(id: string, companyId: string, dto: Partial<CreatePrinterDto>) {
    await this.assertOwnership(id, companyId);
    return this.prisma.printer.update({ where: { id }, data: dto });
  }

  async remove(id: string, companyId: string) {
    await this.assertOwnership(id, companyId);
    return this.prisma.printer.delete({ where: { id } });
  }

  async heartbeat(id: string, companyId: string) {
    await this.assertOwnership(id, companyId);
    return this.prisma.printer.update({
      where: { id },
      data: { isOnline: true, lastSeenAt: new Date() },
    });
  }

  private async assertOwnership(id: string, companyId: string) {
    const p = await this.prisma.printer.findFirst({ where: { id, companyId } });
    if (!p) throw new NotFoundException('Impressora não encontrada');
  }

  // ── Profiles ───────────────────────────────────────────────────────────────

  findProfiles(companyId: string) {
    return this.prisma.printerProfile.findMany({
      where: { companyId },
      include: {
        printer: {
          select: { name: true, connectionType: true, isOnline: true },
        },
      },
    });
  }

  async upsertProfile(companyId: string, dto: CreateProfileDto) {
    const printer = await this.prisma.printer.findFirst({
      where: { id: dto.printerId, companyId },
    });
    if (!printer) throw new ForbiddenException('Impressora fora da empresa');

    return this.prisma.printerProfile.upsert({
      where: { printerId_role: { printerId: dto.printerId, role: dto.role } },
      create: { ...dto, companyId },
      update: { isActive: dto.isActive ?? true },
    });
  }

  async removeProfile(id: string, companyId: string) {
    const p = await this.prisma.printerProfile.findFirst({
      where: { id, companyId },
    });
    if (!p) throw new NotFoundException('Perfil não encontrado');
    return this.prisma.printerProfile.delete({ where: { id } });
  }

  // ── Jobs ───────────────────────────────────────────────────────────────────

  findJobs(companyId: string, status?: PrintJobStatus) {
    return this.prisma.printerJob.findMany({
      where: { companyId, ...(status ? { status } : {}) },
      include: { printer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async updateJobStatus(
    id: string,
    companyId: string,
    status: PrintJobStatus,
    failReason?: string,
  ) {
    const job = await this.prisma.printerJob.findFirst({
      where: { id, companyId },
    });
    if (!job) throw new NotFoundException('Job não encontrado');
    return this.prisma.printerJob.update({
      where: { id },
      data: {
        status,
        ...(status === 'PRINTED' ? { printedAt: new Date() } : {}),
        ...(failReason ? { failReason, attempts: { increment: 1 } } : {}),
      },
    });
  }

  // ── Enqueue (called by PrintService after order events) ────────────────────

  async enqueueJob(params: {
    companyId: string;
    printerId: string;
    orderId?: string;
    template: string;
    payload: object;
  }) {
    return this.prisma.printerJob.create({
      data: {
        companyId: params.companyId,
        printerId: params.printerId,
        orderId: params.orderId,
        template: params.template,
        payload: params.payload,
        status: 'PENDING',
      },
    });
  }

  /**
   * Enfileira um job por setor (KITCHEN/BAR/COUNTER/DELIVERY), resolvendo o
   * PrinterProfile de cada papel — mas nunca manda 2+ tickets do MESMO
   * pedido pra UMA MESMA impressora física. Loja com 1 impressora só e os 4
   * papéis cadastrados apontando todos pra ela (setup comum) recebia 3
   * tickets idênticos por pedido de entrega (KITCHEN+COUNTER+DELIVERY no
   * mesmo rolo) — aqui agrupamos por printerId e, quando 2+ setores
   * resolvem pro mesmo printerId, mantemos só o ticket mais completo
   * (DELIVERY/COUNTER já trazem todos os itens do pedido; KITCHEN/BAR só o
   * subconjunto do próprio setor). Lojas com impressoras físicas separadas
   * por setor não são afetadas — cada papel resolve pra um printerId
   * diferente e todos os tickets saem normalmente.
   */
  async enqueueSectorJobs(
    companyId: string,
    orderId: string | undefined,
    sectorJobs: Array<{
      role: 'KITCHEN' | 'BAR' | 'COUNTER' | 'DELIVERY';
      items: any[];
    }>,
    basePayload: Record<string, any>,
  ): Promise<void> {
    if (sectorJobs.length === 0) return;

    const roles = [...new Set(sectorJobs.map((j) => j.role))];
    const profiles = await this.prisma.printerProfile.findMany({
      where: {
        companyId,
        role: { in: roles },
        isActive: true,
        printer: { isActive: true },
      },
      select: { printerId: true, role: true },
    });

    const byPrinter = new Map<
      string,
      Array<{ role: string; items: any[] }>
    >();
    for (const profile of profiles) {
      const job = sectorJobs.find((j) => j.role === profile.role);
      if (!job) continue;
      const list = byPrinter.get(profile.printerId) ?? [];
      list.push(job);
      byPrinter.set(profile.printerId, list);
    }

    const PRIORITY: Record<string, number> = {
      DELIVERY: 0,
      COUNTER: 1,
      KITCHEN: 2,
      BAR: 3,
    };

    for (const [printerId, jobs] of byPrinter) {
      const chosen = jobs
        .slice()
        .sort((a, b) => (PRIORITY[a.role] ?? 9) - (PRIORITY[b.role] ?? 9))[0];
      await this.enqueueJob({
        companyId,
        printerId,
        orderId,
        template: chosen.role,
        payload: { ...basePayload, template: chosen.role, items: chosen.items },
      });
    }
  }
}
