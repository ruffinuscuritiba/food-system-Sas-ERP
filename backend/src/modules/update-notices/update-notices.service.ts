import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '@/database/prisma.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';

export interface BroadcastSummary {
  clientsWa: number;
  clientsEmail: number;
  leadsWa: number;
  total: number;
}

const DEMO_EMAILS_SUFFIX = '@foodsaas.demo';
const PLATFORM_EMAIL = 'platform@foodsaas.internal';

/**
 * Aviso de atualização do sistema — dispara após cada deploy (BUILD_ID novo):
 *   - Clientes ATIVOS e em TRIAL: WhatsApp + e-mail ("sistema atualizado").
 *   - Leads não convertidos: WhatsApp com reconvite para a demo.
 *
 * Regras:
 *   - Máximo 1 aviso a cada 15 dias corridos. Builds dentro da janela são
 *     registrados como `skipped` e não reenviam.
 *   - Cada build notifica no máximo uma vez (dedupe por BUILD_ID — restarts
 *     do container não reenviam).
 *   - Sem BUILD_ID (ambiente dev) o serviço não faz nada.
 *   - Best-effort: falha de um destinatário não interrompe os demais.
 */
@Injectable()
export class UpdateNoticesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UpdateNoticesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  onApplicationBootstrap(): void {
    setImmediate(() => {
      this.checkAndNotify().catch((err) =>
        this.logger.warn(
          `[UpdateNotices] bootstrap falhou: ${(err as Error)?.message}`,
        ),
      );
    });
  }

  private readBuildId(): string | null {
    try {
      // __dirname em produção = dist/modules/update-notices → dist/BUILD_ID
      const p = join(__dirname, '..', '..', 'BUILD_ID');
      const v = readFileSync(p, 'utf8').trim();
      return v || null;
    } catch {
      return null;
    }
  }

  private async checkAndNotify(): Promise<void> {
    await this.prisma.readyPromise;

    const buildId = this.readBuildId();
    if (!buildId) {
      this.logger.log('[UpdateNotices] BUILD_ID ausente (dev) — sem avisos.');
      return;
    }

    const already = await this.prisma.systemUpdateNotice.findUnique({
      where: { buildId },
    });
    if (already) return; // build já processado (restart normal)

    // Limite: 1 envio a cada 15 dias corridos (evita SPAM em dias com vários deploys)
    const MIN_INTERVAL_DAYS = 15;
    const lastSent = await this.prisma.systemUpdateNotice.findFirst({
      where: { skipped: false },
      orderBy: { sentAt: 'desc' },
    });
    if (lastSent) {
      const daysSince = (Date.now() - lastSent.sentAt.getTime()) / 86_400_000;
      if (daysSince < MIN_INTERVAL_DAYS) {
        await this.prisma.systemUpdateNotice.create({
          data: { buildId, skipped: true },
        });
        this.logger.log(
          `[UpdateNotices] último aviso há ${daysSince.toFixed(1)}d (< ${MIN_INTERVAL_DAYS}d) — build registrado sem reenvio.`,
        );
        return;
      }
    }

    // Registra ANTES de enviar: crash no meio do envio não gera duplicidade
    const notice = await this.prisma.systemUpdateNotice.create({
      data: { buildId },
    });

    const summary = await this.broadcast();
    await this.prisma.systemUpdateNotice.update({
      where: { id: notice.id },
      data: {
        recipients: summary.total,
        summary: JSON.parse(JSON.stringify(summary)),
      },
    });
    this.logger.log(
      `[UpdateNotices] build=${buildId} — clientes WA=${summary.clientsWa} email=${summary.clientsEmail} leads WA=${summary.leadsWa}`,
    );
  }

  /**
   * Envia o aviso para todos os públicos. Também usado pelo trigger manual do
   * super-admin. Retorna contadores por canal.
   */
  async broadcast(): Promise<BroadcastSummary> {
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ??
      'https://food-system-sas-erp-frontend.vercel.app';

    const now = new Date();
    const companies = await this.prisma.company.findMany({
      where: {
        isBlocked: false,
        archivedAt: null,
        OR: [
          { subscriptionStatus: 'ACTIVE' },
          { subscriptionStatus: 'PENDING_PAYMENT', dueDate: { gte: now } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        whatsapp: true,
        phone: true,
      },
    });

    const isInternal = (email: string | null | undefined) => {
      const e = (email ?? '').toLowerCase();
      return e.endsWith(DEMO_EMAILS_SUFFIX) || e === PLATFORM_EMAIL;
    };
    const clients = companies.filter((c) => !isInternal(c.email));

    // Leads não convertidos (excluímos números que já pertencem a uma empresa)
    const allCompanyPhones = await this.prisma.company.findMany({
      select: { whatsapp: true, phone: true },
    });
    const companyDigits = new Set(
      allCompanyPhones
        .flatMap((c) => [c.whatsapp, c.phone])
        .map((p) => (p ?? '').replace(/\D/g, ''))
        .filter((d) => d.length >= 10),
    );
    const leads = await this.prisma.lead.findMany({
      where: { whatsapp: { not: null }, status: { not: 'PERDIDO' } },
      select: { id: true, name: true, whatsapp: true },
    });

    const summary: BroadcastSummary = {
      clientsWa: 0,
      clientsEmail: 0,
      leadsWa: 0,
      total: 0,
    };

    for (const c of clients) {
      const firstName = (c.name ?? '').split(' ')[0] || 'tudo bem';
      const waMsg =
        `🚀 *Atualização no seu FoodSaaS!*\n\n` +
        `Olá, ${firstName}! Acabamos de lançar melhorias e correções importantes no sistema.\n\n` +
        `✅ Seu sistema já está atualizado automaticamente — você não precisa fazer nada.\n\n` +
        `Qualquer dúvida, é só responder por aqui. 😉`;
      if (await this.sendWa(c.whatsapp ?? c.phone, waMsg)) summary.clientsWa++;

      if (c.email && !isInternal(c.email)) {
        await this.notifications
          .send({
            to: c.email,
            type: 'SYSTEM_UPDATE',
            data: { name: c.name, frontendUrl },
          })
          .catch((err) =>
            this.logger.warn(
              `[UpdateNotices] email falhou para ${c.email}: ${(err as Error)?.message}`,
            ),
          );
        summary.clientsEmail++;
      }
      await this.sleep(400);
    }

    for (const l of leads) {
      const digits = (l.whatsapp ?? '').replace(/\D/g, '');
      if (!digits || companyDigits.has(digits)) continue; // já virou cliente
      const hello = l.name ? `Olá, *${l.name.split(' ')[0]}*!` : 'Olá!';
      const waMsg =
        `${hello} 👋 Aqui é a Kely, do *FoodSaaS*.\n\n` +
        `Acabamos de lançar uma atualização com melhorias importantes no sistema que você conheceu. 🚀\n\n` +
        `Que tal dar mais uma olhada? O teste é grátis e leva 2 minutos pra começar:\n` +
        `${frontendUrl}/demo\n\n` +
        `Se preferir, me chama aqui que te mostro tudo na hora. 😉`;
      if (await this.sendWa(l.whatsapp, waMsg)) summary.leadsWa++;
      await this.sleep(400);
    }

    summary.total = summary.clientsWa + summary.clientsEmail + summary.leadsWa;
    return summary;
  }

  /**
   * Envia texto via Evolution API. Usa as envs EVOLUTION_*; se a instância da
   * env não existir mais (reprovisionamento), cai para a primeira
   * WhatsappConnection ativa do banco (self-healing contra env drift).
   */
  private async sendWa(
    rawPhone: string | null | undefined,
    text: string,
  ): Promise<boolean> {
    const digits = (rawPhone ?? '').replace(/\D/g, '');
    if (digits.length < 10) return false;
    const number = digits.length <= 11 ? `55${digits}` : digits;

    const targets: { apiUrl: string; apiKey: string; instance: string }[] = [];
    const envUrl = this.config.get<string>('EVOLUTION_API_URL');
    const envKey = this.config.get<string>('EVOLUTION_API_KEY');
    const envInstance = this.config.get<string>('EVOLUTION_INSTANCE_NAME');
    if (envUrl && envKey && envInstance) {
      targets.push({ apiUrl: envUrl, apiKey: envKey, instance: envInstance });
    }
    const conn = await this.prisma.whatsappConnection.findFirst({
      where: {
        isActive: true,
        provider: 'EVOLUTION',
        instanceName: { not: null },
        apiUrl: { not: null },
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (conn?.apiUrl && conn.apiToken && conn.instanceName) {
      targets.push({
        apiUrl: conn.apiUrl,
        apiKey: conn.apiToken,
        instance: conn.instanceName,
      });
    }

    for (const t of targets) {
      try {
        const res = await fetch(`${t.apiUrl}/message/sendText/${t.instance}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: t.apiKey },
          body: JSON.stringify({ number, text }),
          signal: AbortSignal.timeout(15_000),
        });
        if (res.ok) return true;
        this.logger.warn(
          `[UpdateNotices] Evolution ${t.instance} → ${res.status} para ${number}`,
        );
      } catch (err) {
        this.logger.warn(
          `[UpdateNotices] Evolution ${t.instance} falhou: ${(err as Error)?.message}`,
        );
      }
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
