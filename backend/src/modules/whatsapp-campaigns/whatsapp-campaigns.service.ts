import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { WhatsappAiService } from '@/modules/whatsapp-ai/whatsapp-ai.service';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/create-campaign.dto';
import { AddContactsDto } from './dto/add-contacts.dto';

/** Normaliza telefone BR pro mesmo formato usado no disparo (dígitos + DDI 55). */
function normalizePhoneBr(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return digits;
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

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

  /**
   * Contatos elegíveis, ordenados do que espera há MAIS tempo pro que espera
   * há MENOS (nunca contatado vem primeiro) — usado pelo gotejamento pra
   * garantir que, ao longo de vários lotes, todo mundo eventualmente recebe
   * em vez de sempre pegar os mesmos primeiros N da lista.
   */
  private async getEligibleContacts(companyId: string, minIntervalDays: number) {
    const optedIn = await this.prisma.customer.findMany({
      where: { companyId, marketingOptIn: true },
      select: { id: true, name: true, phone: true },
    });
    if (optedIn.length === 0) return [];

    const cutoff = new Date(Date.now() - minIntervalDays * 24 * 60 * 60_000);
    const [recentlySent, lastSentByPhone] = await Promise.all([
      this.prisma.whatsappCampaignSend.findMany({
        where: { companyId, status: 'SENT', sentAt: { gte: cutoff } },
        select: { phone: true },
      }),
      this.prisma.whatsappCampaignSend.groupBy({
        by: ['phone'],
        where: { companyId, status: 'SENT' },
        _max: { sentAt: true },
      }),
    ]);
    const recentPhones = new Set(recentlySent.map((s) => s.phone));
    const lastSentMap = new Map(
      lastSentByPhone.map((r) => [r.phone, r._max.sentAt?.getTime() ?? 0]),
    );

    return optedIn
      .filter((c) => c.phone && !recentPhones.has(c.phone))
      .sort((a, b) => (lastSentMap.get(a.phone) ?? 0) - (lastSentMap.get(b.phone) ?? 0));
  }

  /**
   * Adiciona contatos manualmente à base de opt-in (ex.: lista de convite
   * pra inauguração) — o admin está explicitamente afirmando que esses
   * números podem receber, então marca marketingOptIn=true na hora. Não
   * cria duplicata: reaproveita Customer existente com o mesmo telefone.
   */
  async addContacts(companyId: string, dto: AddContactsDto) {
    let created = 0;
    let updated = 0;
    let invalid = 0;

    for (const entry of dto.contacts) {
      const phone = normalizePhoneBr(entry.phone);
      if (!phone || phone.length < 10) {
        invalid++;
        continue;
      }
      const existing = await this.prisma.customer.findFirst({
        where: { companyId, phone },
      });
      if (existing) {
        await this.prisma.customer.update({
          where: { id: existing.id },
          data: {
            marketingOptIn: true,
            name: existing.name?.trim() ? existing.name : (entry.name?.trim() || existing.name),
          },
        });
        updated++;
      } else {
        await this.prisma.customer.create({
          data: {
            companyId,
            phone,
            name: entry.name?.trim() || phone,
            marketingOptIn: true,
          },
        });
        created++;
      }
    }

    return { created, updated, invalid, total: dto.contacts.length };
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
        maxPerRun: dto.maxPerRun ?? 50,
        createdById: userId,
        status: 'DRAFT',
      },
    });
  }

  async updateCampaign(id: string, companyId: string, dto: UpdateCampaignDto) {
    const campaign = await this.prisma.whatsappCampaign.findFirst({ where: { id, companyId } });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    if (campaign.status === 'ARCHIVED') {
      throw new BadRequestException('Campanha desativada definitivamente — não pode ser editada.');
    }
    return this.prisma.whatsappCampaign.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.message !== undefined && { message: dto.message.trim() }),
        ...(dto.minIntervalDays !== undefined && { minIntervalDays: dto.minIntervalDays }),
        ...(dto.maxPerRun !== undefined && { maxPerRun: dto.maxPerRun }),
      },
    });
  }

  async activateCampaign(id: string, companyId: string) {
    const campaign = await this.prisma.whatsappCampaign.findFirst({ where: { id, companyId } });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    if (campaign.status === 'ARCHIVED') {
      throw new BadRequestException('Campanha desativada definitivamente — crie uma nova campanha se quiser reenviar.');
    }
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

  /** Desativação definitiva — diferente de pausar, nunca mais pode ser reativada. */
  async archiveCampaign(id: string, companyId: string) {
    const campaign = await this.prisma.whatsappCampaign.findFirst({ where: { id, companyId } });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    return this.prisma.whatsappCampaign.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
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
   *
   * Gotejamento: só envia até `maxPerRun` contatos por ativação (os que
   * esperam há mais tempo primeiro). Se sobrar gente elegível além disso,
   * a campanha volta pra PAUSED em vez de COMPLETED — "Retomar" dispara o
   * próximo lote, e assim por diante até a lista se esgotar.
   */
  private async runCampaign(campaignId: string): Promise<void> {
    const campaign = await this.prisma.whatsappCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign || campaign.status !== 'ACTIVE') return;

    const allEligible = await this.getEligibleContacts(campaign.companyId, campaign.minIntervalDays);
    const cap = campaign.maxPerRun ?? 50;
    const contacts = allEligible.slice(0, cap);
    const deferred = allEligible.length - contacts.length;
    this.logger.log(
      `[Campaign ${campaignId}] iniciando lote de ${contacts.length}/${allEligible.length} contato(s) elegível(is)` +
        (deferred > 0 ? ` — ${deferred} adiado(s) pro próximo lote (limite de ${cap}/ativação)` : ''),
    );

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

    if (deferred > 0) {
      // Ainda tem gente esperando além do limite do lote — volta pra PAUSED
      // (não COMPLETED) pra deixar claro que "Retomar" manda o próximo lote.
      await this.prisma.whatsappCampaign.updateMany({
        where: { id: campaignId, status: 'ACTIVE' },
        data: { status: 'PAUSED' },
      });
      this.logger.log(
        `[Campaign ${campaignId}] lote concluído — ${deferred} contato(s) aguardando o próximo "Retomar"`,
      );
    } else {
      await this.prisma.whatsappCampaign.updateMany({
        where: { id: campaignId, status: 'ACTIVE' },
        data: { status: 'COMPLETED' },
      });
      this.logger.log(`[Campaign ${campaignId}] concluída`);
    }
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
