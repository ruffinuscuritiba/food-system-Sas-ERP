import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/database/prisma.service';
import { UpdateLoyaltyMilestoneConfigDto } from './dto/update-config.dto';

/** Últimos 8 dígitos — ignora DDI/DDC/hífen/formatação (mesma regra de reports.service getCustomerStats). */
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 8 ? digits.slice(-8) : null;
}

@Injectable()
export class LoyaltyMilestonesService {
  private readonly logger = new Logger(LoyaltyMilestonesService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  // ── Config (uma por empresa, criada com defaults na 1ª leitura) ────────────

  async getConfig(companyId: string) {
    const existing = await this.prisma.loyaltyMilestoneConfig.findUnique({ where: { companyId } });
    if (existing) return existing;
    return this.prisma.loyaltyMilestoneConfig.create({ data: { companyId } });
  }

  async updateConfig(companyId: string, dto: UpdateLoyaltyMilestoneConfigDto) {
    return this.prisma.loyaltyMilestoneConfig.upsert({
      where: { companyId },
      create: {
        companyId,
        ordersThreshold: dto.ordersThreshold,
        rewardLabel: dto.rewardLabel,
        isActive: dto.isActive ?? true,
      },
      update: {
        ordersThreshold: dto.ordersThreshold,
        rewardLabel: dto.rewardLabel,
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  // ── Painel — resgates pendentes de confirmação no balcão ───────────────────

  async listPending(companyId: string) {
    return this.prisma.loyaltyMilestoneReward.findMany({
      where: { companyId, redeemed: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  async redeem(id: string, companyId: string, userId: string) {
    const reward = await this.prisma.loyaltyMilestoneReward.findFirst({ where: { id, companyId } });
    if (!reward) throw new NotFoundException('Recompensa não encontrada');
    if (reward.redeemed) return reward;
    return this.prisma.loyaltyMilestoneReward.update({
      where: { id },
      data: { redeemed: true, redeemedAt: new Date(), redeemedByUserId: userId },
    });
  }

  // ── Contagem cross-canal (Order + OnlineOrder), mesma regra de reports.service ──

  private async countOrdersForPhone(companyId: string, phone: string): Promise<number> {
    const last8 = normalizePhone(phone);
    if (!last8) return 0;
    const [orders, onlineOrders] = await Promise.all([
      this.prisma.order.count({ where: { companyId, customerPhone: { endsWith: last8 } } }),
      this.prisma.onlineOrder.count({ where: { companyId, customerPhone: { endsWith: last8 } } }),
    ]);
    return orders + onlineOrders;
  }

  // ── Hook chamado após CADA pedido (fire-and-forget nos callers) ────────────
  // Nunca aplica desconto/produto grátis sozinho — só detecta o marco, grava
  // o aviso pro painel (idempotente via unique companyId+phone+milestoneCount)
  // e opcionalmente avisa o cliente por WhatsApp. Resgate físico é sempre
  // manual no balcão (decisão explícita do dono da loja).
  async checkAndRegisterMilestone(companyId: string, customerPhone?: string | null, customerName?: string | null) {
    if (!customerPhone) return;
    const config = await this.prisma.loyaltyMilestoneConfig.findUnique({ where: { companyId } });
    if (!config || !config.isActive || config.ordersThreshold < 2) return;

    const count = await this.countOrdersForPhone(companyId, customerPhone);
    if (count === 0 || count % config.ordersThreshold !== 0) return;

    try {
      const reward = await this.prisma.loyaltyMilestoneReward.create({
        data: {
          companyId,
          customerPhone,
          customerName: customerName ?? null,
          milestoneCount: count,
          rewardLabel: config.rewardLabel,
        },
      });
      this.logger.log(`[ClienteFiel] marco batido: phone=${customerPhone} count=${count} reward=${reward.id}`);
      this.notifyCustomer(companyId, customerPhone, customerName ?? 'Cliente', config.rewardLabel).catch(() => {});
    } catch (e: any) {
      // Unique constraint = já registrado antes (ex: dois hooks disparando pro mesmo pedido) — ok ignorar.
      if (e?.code !== 'P2002') {
        this.logger.warn(`[ClienteFiel] falha ao registrar marco: ${e?.message}`);
      }
    }
  }

  private async notifyCustomer(companyId: string, phone: string, name: string, rewardLabel: string) {
    const apiUrl = this.config.get('EVOLUTION_API_URL');
    const apiKey = this.config.get('EVOLUTION_API_KEY');
    const instanceName = this.config.get('EVOLUTION_INSTANCE_NAME');
    if (!apiUrl || !apiKey || !instanceName) return;

    const conn = await this.prisma.whatsappConnection
      .findFirst({ where: { companyId, isActive: true } })
      .catch(() => null);
    const instance = conn?.instanceName || instanceName;
    const firstName = name.split(' ')[0];
    const digits = phone.replace(/\D/g, '');

    const text =
      `🎉 Parabéns, ${firstName}!\n\n` +
      `Você é cliente fiel e ganhou: *${rewardLabel}*\n\n` +
      `É só avisar no balcão no seu próximo pedido que a gente já libera. Obrigado pela preferência!`;

    try {
      await fetch(`${apiUrl}/message/sendText/${instance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({ number: digits, text }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (e: any) {
      this.logger.warn(`[ClienteFiel] falha ao avisar cliente por WhatsApp: ${e?.message}`);
    }
  }
}
