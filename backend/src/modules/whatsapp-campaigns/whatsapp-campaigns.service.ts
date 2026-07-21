import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { WhatsappAiService } from '@/modules/whatsapp-ai/whatsapp-ai.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';

/**
 * Campanhas recorrentes de WhatsApp — reengajamento de cliente.
 *
 * Diferente de uma ferramenta de disparo em massa: só envia pra quem deu
 * opt-in explícito (Customer.marketingOptIn), nunca reenvia pro mesmo
 * telefone antes de `minIntervalDays` (contado em QUALQUER campanha da
 * empresa, não só a atual — evita empilhar mensagem de campanhas diferentes
 * no mesmo cliente), e usa mensagem única (sem spintax/variação de texto).
 * O delay entre envios é fixo e existe por estabilidade da conexão de
 * WhatsApp/API, não como técnica de evasão de detecção de spam.
 */
@Injectable()
export class WhatsappCampaignsService {
  private readonly logger = new Logger(WhatsappCampaignsService.name);

  // Delay fixo entre envios — proteção de carga na conexão WhatsApp, não
  // "anti-ban": não é randomizado nem varia por lote pra simular humano.
  private readonly SEND_DELAY_MS = 3000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappAi: WhatsappAiService,
  ) {}

  async getSummary(companyId: string) {
    const [eligibleContacts, activeCampaigns, sends30d] = await Promise.all([
      this.countEligibleContacts(companyId),
      this.prisma.whatsappCampaign.count({ where: { companyId, status: 'ACTIVE' } }),
      this.prisma.whatsappCampaignSend.findMany({
        where: { companyId, sentAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60_000) } },
        select: { status: true },
      }),
    ]);

    const attempted = sends30d.filter((s) => s.status === 'SENT' || s.status === 'FAILED').length;
    const sent = sends30d.filter((s) => s.status === 'SENT').length;
    const deliveryRate = attempted > 0 ? Math.round((sent / attempted) * 100) : null;

    return { eligibleContacts, activeCampaigns, deliveryRate };
  }

  /** Conta clientes com opt-in que não receberam nenhuma campanha nos últimos `minIntervalDays` (padrão 15). */
  private async countEligibleContacts(companyId: string, minIntervalDays = 15): Promise<number> {
    const eligible = await this.getEligibleContacts(companyId, minIntervalDays);
    return eligible.length;
  }

  private async getEligibleContacts(companyId: string, minIntervalDays: number) {
    const optedIn = await this.prisma.customer.findMany({
      where: { companyId, marketingOptIn: true },
      select: { id: true, name: true, phone: true },
    });
    if (optedIn.length === 0) return [];

    const cutoff = new Date(Date.now() - minIntervalDays * 24 * 60 * 60_000);
    const recentlySent = await this.prisma.whatsappCampaignSend.findMany({
      where: { companyId, status: 'SENT', sentAt: { gte: cutoff } },
      select: { phone: true },
    });
    const recentPhones = new Set(recentlySent.map((s) => s.phone));

    return optedIn.filter((c) => c.phone && !recentPhones.has(c.phone));
  }

  async listCampaigns(companyId: string) {
    const campaigns = await this.prisma.whatsappCampaign.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        sends: { select: { status: true } },
      },
    });

    return campaigns.map((c) => {
      const sent = c.sends.filter((s) => s.status === 'SENT').length;
      const failed = c.sends.filter((s) => s.status === 'FAILED').length;
      const skipped = c.sends.filter((s) => s.status.startsWith('SKIPPED')).length;
      const { sends, ...rest } = c;
      return { ...rest, stats: { sent, failed, skipped, total: c.sends.length } };
    });
  }

  async createCampaign(companyId: string, userId: string, dto: CreateCampaignDto) {
    if (!dto.message?.trim()) {
      throw new BadRequestException('Mensagem é obrigatória.');
    }
    return this.prisma.whatsappCampaign.create({
      data: {
        companyId,
        name: dto.name.trim(),
        message: dto.message.trim(),
        minIntervalDays: dto.minIntervalDays ?? 15,
        createdById: userId,
        status: 'DRAFT',
      },
    });
  }

  async activateCampaign(id: string, companyId: string) {
    const campaign = await this.prisma.whatsappCampaign.findFirst({ where: { id, companyId } });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    if (campaign.status === 'ACTIVE') return campaign;

    const updated = await this.prisma.whatsappCampaign.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    // Dispara o envio em background — não bloqueia a resposta HTTP.
    setImmediate(() => {
      this.runCampaign(id).catch((e) =>
        this.logger.error(`[Campaign ${id}] runCampaign falhou: ${e?.message}`),
      );
    });

    return updated;
  }

  async pauseCampaign(id: string, companyId: string) {
    const campaign = await this.prisma.whatsappCampaign.findFirst({ where: { id, companyId } });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    return this.prisma.whatsappCampaign.update({
      where: { id },
      data: { status: 'PAUSED' },
    });
  }

  async getCampaignSends(id: string, companyId: string) {
    const campaign = await this.prisma.whatsappCampaign.findFirst({ where: { id, companyId } });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    return this.prisma.whatsappCampaignSend.findMany({
      where: { campaignId: id },
      orderBy: { sentAt: 'desc' },
      take: 200,
    });
  }

  /**
   * Motor de envio. Roda em background (setImmediate), sequencial (um por
   * vez, não em paralelo) com delay fixo — checa o status da campanha antes
   * de cada envio pra permitir pausar no meio.
   */
  private async runCampaign(campaignId: string): Promise<void> {
    const campaign = await this.prisma.whatsappCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign || campaign.status !== 'ACTIVE') return;

    const contacts = await this.getEligibleContacts(campaign.companyId, campaign.minIntervalDays);
    this.logger.log(`[Campaign ${campaignId}] iniciando envio pra ${contacts.length} contato(s) elegível(is)`);

    for (const contact of contacts) {
      // Re-checa status a cada iteração — permite pausar no meio do envio.
      const current = await this.prisma.whatsappCampaign.findUnique({
        where: { id: campaignId },
        select: { status: true },
      });
      if (current?.status !== 'ACTIVE') {
        this.logger.log(`[Campaign ${campaignId}] pausada/interrompida — parando envio`);
        return;
      }

      if (!contact.phone) {
        await this.logSend(campaignId, campaign.companyId, contact.id, '', 'SKIPPED_NO_PHONE');
        continue;
      }

      const text = campaign.message.replace(/\{\{\s*nome\s*\}\}/gi, contact.name || 'cliente');

      try {
        const delivered = await this.whatsappAi.sendTextMessage(campaign.companyId, contact.phone, text);
        await this.logSend(
          campaignId, campaign.companyId, contact.id, contact.phone,
          delivered ? 'SENT' : 'FAILED',
          delivered ? undefined : 'Sem conexão de WhatsApp ativa ou falha no envio',
        );
      } catch (e: any) {
        await this.logSend(campaignId, campaign.companyId, contact.id, contact.phone, 'FAILED', e?.message);
      }

      await new Promise((resolve) => setTimeout(resolve, this.SEND_DELAY_MS));
    }

    await this.prisma.whatsappCampaign.updateMany({
      where: { id: campaignId, status: 'ACTIVE' },
      data: { status: 'COMPLETED' },
    });
    this.logger.log(`[Campaign ${campaignId}] concluída`);
  }

  private async logSend(
    campaignId: string,
    companyId: string,
    customerId: string | null,
    phone: string,
    status: 'SENT' | 'FAILED' | 'SKIPPED_INTERVAL' | 'SKIPPED_NO_OPTIN' | 'SKIPPED_NO_PHONE',
    errorMessage?: string,
  ) {
    await this.prisma.whatsappCampaignSend.create({
      data: { campaignId, companyId, customerId, phone, status, errorMessage },
    });
  }
}
