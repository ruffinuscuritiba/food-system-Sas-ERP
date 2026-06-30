import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/database/prisma.service';
import { CreateCampaignDto, CampaignType } from './dto/create-campaign.dto';
import { ValidateTokenDto } from './dto/validate-token.dto';
import { RedeemTokenDto } from './dto/redeem-token.dto';

// ─── Tipos internos ───────────────────────────────────────────────────────────

export interface QrPayload {
  /** Token de 6 chars para exibir na nota e formar URL */
  token: string;
  /** URL completa de redirect (https://…/r/TOKEN) */
  redirectUrl: string;
  /** Bloco pronto para fila de impressão térmica (ESC/POS JSON) */
  printBlock: PrintBlock;
  /** Validade em ISO string */
  expiresAt: string;
}

export interface PrintBlock {
  title: string;
  customerName: string;
  discountLine: string;
  url: string;
  couponCode: string;
  validUntil: string;
}

export interface ValidationResult {
  valid: boolean;
  discount: number;
  discountType: string;
  message: string;
  campaignName: string;
  qrCodeId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Gera token alfanumérico maiúsculo de 6 chars (ex: AE9D07) */
function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I,O,1,0 (confusão visual)
  let token = '';
  for (let i = 0; i < 6; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

/** Identifica device pelo User-Agent */
function detectDevice(ua: string): string {
  if (!ua) return 'UNKNOWN';
  if (/mobile|android|iphone|ipad/i.test(ua)) return 'MOBILE';
  if (/tablet/i.test(ua)) return 'TABLET';
  return 'DESKTOP';
}

/** Extrai IP real prevenindo X-Forwarded-For spoofing básico */
export function extractRealIp(req: any): string {
  const xfwd = req.headers?.['x-forwarded-for'];
  if (xfwd) {
    // Pegar APENAS o primeiro endereço (mais próximo ao cliente)
    const first = String(xfwd).split(',')[0].trim();
    // Validação básica de formato para rejeitar valores manipulados
    if (/^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]+$/i.test(first)) return first;
  }
  return req.ip ?? req.connection?.remoteAddress ?? 'unknown';
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class QrCampaignsService {
  private readonly frontendUrl: string;
  private readonly logger = new Logger(QrCampaignsService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.frontendUrl =
      this.config.get('FRONTEND_URL') ??
      this.config.get('NEXT_PUBLIC_API_URL')?.replace('/api', '') ??
      'https://food-system-sas-erp-frontend.vercel.app';
  }

  // ── WhatsApp de boas-vindas ao usar o cupom QR ────────────────────────────
  private async sendWelcomeWhatsapp(params: {
    companyId: string;
    customerPhone: string;
    customerName: string;
    campaignName: string;
    discountLine: string;
    cardapioUrl: string;
  }) {
    const apiUrl      = this.config.get('EVOLUTION_API_URL');
    const apiKey      = this.config.get('EVOLUTION_API_KEY');
    const instanceName = this.config.get('EVOLUTION_INSTANCE_NAME');
    if (!apiUrl || !apiKey || !instanceName) return; // sem Evolution configurado

    // Busca a conexão ativa da empresa
    const conn = await this.prisma.whatsappConnection.findFirst({
      where: { companyId: params.companyId, isActive: true },
    }).catch(() => null);
    const instance = conn?.instanceName || instanceName;

    const phone = params.customerPhone.replace(/\D/g, '');
    const firstName = params.customerName.split(' ')[0];

    const text =
      `Oi ${firstName}! 🎉\n\n` +
      `Seu cupom foi aplicado com sucesso!\n` +
      `*${params.discountLine}* no seu próximo pedido pelo nosso cardápio 🛵\n\n` +
      `Peça diretamente por aqui e aproveite o desconto:\n` +
      `👉 ${params.cardapioUrl}\n\n` +
      `Qualquer dúvida é só chamar! 😊`;

    try {
      await fetch(`${apiUrl}/message/sendText/${instance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({ number: phone, text }),
        signal: AbortSignal.timeout(10_000),
      });
      this.logger.log(`[QR-WA] boas-vindas enviado para ${phone}`);
    } catch (e: any) {
      this.logger.warn(`[QR-WA] falha ao enviar WA para ${phone}: ${e?.message}`);
    }
  }

  // ── CRUD de campanhas ──────────────────────────────────────────────────────

  async listCampaigns(companyId: string) {
    return this.prisma.campaign.findMany({
      where: { companyId },
      include: {
        _count: { select: { qrCodes: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCampaign(companyId: string, dto: CreateCampaignDto) {
    return this.prisma.campaign.create({
      data: {
        companyId,
        name: dto.name,
        type: dto.type as any,
        discountType: dto.discountType as any,
        discountValue: dto.discountValue,
        minimumOrder: dto.minimumOrder ?? 0,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        limitPerCustomer: dto.limitPerCustomer ?? null,
        limitPerDevice: dto.limitPerDevice ?? null,
        status: dto.status ?? true,
      },
    });
  }

  async toggleCampaign(id: string, companyId: string, status: boolean) {
    const camp = await this.prisma.campaign.findFirst({
      where: { id, companyId },
    });
    if (!camp) throw new NotFoundException('Campanha não encontrada');
    return this.prisma.campaign.update({ where: { id }, data: { status } });
  }

  async deleteCampaign(id: string, companyId: string) {
    const camp = await this.prisma.campaign.findFirst({
      where: { id, companyId },
    });
    if (!camp) throw new NotFoundException('Campanha não encontrada');
    await this.prisma.campaign.delete({ where: { id } });
  }

  // ── Geração de QR Code (chamado após criação de pedido) ───────────────────

  /**
   * Ponto de entrada principal. Chamado de OrdersService e OnlineOrdersService
   * via setImmediate (fire-and-forget).
   *
   * @param params.orderSource  'PROPRIO' | 'IFOOD' | '99FOOD' | 'RAPPI' | 'MOCK'
   * @param params.isFirstOrder true se este for o 1º pedido do cliente nesta empresa
   */
  async generateForOrder(params: {
    companyId: string;
    orderId: string;
    orderSource: string;
    customerName: string;
    customerPhone?: string;
    isFirstOrder?: boolean;
  }): Promise<QrPayload | null> {
    const { companyId, orderId, orderSource, customerName, customerPhone, isFirstOrder } = params;

    // Definir qual tipo de campanha buscar
    const now = new Date();
    const isExternal = ['IFOOD', '99FOOD', 'RAPPI'].includes(orderSource.toUpperCase());
    const typeToSearch: CampaignType[] = isExternal
      ? [CampaignType.RECUPERACAO_IFOOD]
      : isFirstOrder
        ? [CampaignType.PRIMEIRA_COMPRA, CampaignType.FIDELIZACAO]
        : [CampaignType.FIDELIZACAO, CampaignType.CASHBACK];

    const campaign = await this.prisma.campaign.findFirst({
      where: {
        companyId,
        status: true,
        type: { in: typeToSearch as any[] },
        startsAt: { lte: now },
        endsAt:   { gte: now },
      },
      orderBy: [
        // Priorizar campanha que tem correspondência exata com o tipo principal
        { type: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    if (!campaign) return null;

    // Garantir token único com até 10 tentativas
    let token: string | null = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const t = generateToken();
      const exists = await this.prisma.qrCode.findUnique({ where: { token: t } });
      if (!exists) { token = t; break; }
    }
    if (!token) return null; // improvável; falha silenciosa

    // Validade: campanha tem endsAt ou 30 dias, o que vier primeiro
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const expiresAt  = campaign.endsAt < thirtyDays ? campaign.endsAt : thirtyDays;

    const redirectUrl = `${this.frontendUrl}/r/${token}`;

    await this.prisma.qrCode.create({
      data: {
        companyId,
        campaignId: campaign.id,
        customerId:  customerPhone ?? null,
        orderId,
        orderSource: orderSource.toUpperCase(),
        token,
        qrUrl: redirectUrl,
        expiresAt,
      },
    });

    // Linha de desconto legível
    const discountLine =
      campaign.discountType === ('PERCENTUAL' as any)
        ? `${Number(campaign.discountValue)}% DE DESCONTO`
        : `+ R$ ${Number(campaign.discountValue).toFixed(2).replace('.', ',')} DE DESCONTO`;

    const validStr = expiresAt.toLocaleDateString('pt-BR') +
                     ' ' + expiresAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const printBlock: PrintBlock = {
      title:        'CARDÁPIO DIGITAL',
      customerName: customerName.toUpperCase(),
      discountLine: discountLine + '\nno seu próximo pedido',
      url:          redirectUrl,
      couponCode:   token,
      validUntil:   validStr,
    };

    return { token, redirectUrl, printBlock, expiresAt: expiresAt.toISOString() };
  }

  // ── Redirect — validar token e devolver dados da sessão ───────────────────

  async resolveToken(token: string) {
    // Sanitizar token (prevenir injeção via path param)
    const clean = token.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6);

    const qr = await this.prisma.qrCode.findUnique({
      where:   { token: clean },
      include: { campaign: true },
    });

    if (!qr) throw new NotFoundException('Cupom não encontrado');
    if (!qr.campaign.status)       throw new ForbiddenException('Campanha inativa');
    if (qr.used)                   throw new ForbiddenException('Cupom já utilizado');
    if (new Date() > qr.expiresAt) throw new ForbiddenException('Cupom expirado');

    // Payload de sessão (assinado/criptografado no cookie pelo controller)
    const sessionPayload = {
      qrCodeId:      qr.id,
      companyId:     qr.companyId,
      token:         qr.token,
      discountType:  qr.campaign.discountType,
      discountValue: Number(qr.campaign.discountValue),
      minimumOrder:  Number(qr.campaign.minimumOrder),
      campaignName:  qr.campaign.name,
      expiresAt:     qr.expiresAt.toISOString(),
    };

    return {
      sessionPayload,
      cardapioUrl: `${this.frontendUrl}/menu/${qr.companyId}`,
    };
  }

  // ── Checkout — validar token na sessão e calcular desconto ───────────────

  async validateForCheckout(
    companyId: string,
    dto: ValidateTokenDto,
    ip: string,
    ua: string,
  ): Promise<ValidationResult> {
    const clean = dto.token.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6);

    const qr = await this.prisma.qrCode.findFirst({
      where: { token: clean, companyId },
      include: { campaign: true },
    });

    if (!qr)                       throw new NotFoundException('Cupom inválido');
    if (!qr.campaign.status)       throw new BadRequestException('Campanha inativa');
    if (qr.used)                   throw new BadRequestException('Cupom já utilizado');
    if (new Date() > qr.expiresAt) throw new BadRequestException('Cupom expirado');

    const minimum = Number(qr.campaign.minimumOrder);
    if (dto.subtotal < minimum) {
      throw new BadRequestException(
        `Pedido mínimo de R$ ${minimum.toFixed(2).replace('.', ',')} para usar este cupom`,
      );
    }

    // Limites por IP/device
    if (qr.campaign.limitPerDevice) {
      const usedByIp = await this.prisma.couponRedemption.count({
        where: { companyId, ip, qrCode: { campaignId: qr.campaignId } },
      });
      if (usedByIp >= qr.campaign.limitPerDevice) {
        throw new BadRequestException('Limite de uso por dispositivo atingido');
      }
    }

    const discountValue = Number(qr.campaign.discountValue);
    let discount = 0;
    if (qr.campaign.discountType === ('PERCENTUAL' as any)) {
      discount = Math.min((dto.subtotal * discountValue) / 100, dto.subtotal);
    } else {
      discount = Math.min(discountValue, dto.subtotal);
    }

    return {
      valid:        true,
      discount:     Math.round(discount * 100) / 100,
      discountType: qr.campaign.discountType as string,
      campaignName: qr.campaign.name,
      message:      '✓ Cupom aplicado automaticamente',
      qrCodeId:     qr.id,
    };
  }

  // ── Finalização — marcar como usado e gravar redemption ──────────────────

  async redeem(
    companyId: string,
    dto: RedeemTokenDto,
    ip: string,
    ua: string,
  ) {
    const clean = dto.token.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6);

    return this.prisma.$transaction(async (tx) => {
      const qr = await tx.qrCode.findFirst({
        where: { token: clean, companyId },
        include: { campaign: true },
      });

      if (!qr)    throw new NotFoundException('Cupom inválido');
      if (qr.used) throw new BadRequestException('Cupom já utilizado');

      // Calcular desconto final
      const discountValue = Number(qr.campaign.discountValue);
      const total = Number(dto.orderTotal);
      let discount = 0;
      if (qr.campaign.discountType === ('PERCENTUAL' as any)) {
        discount = Math.min((total * discountValue) / 100, total);
      } else {
        discount = Math.min(discountValue, total);
      }
      discount = Math.round(discount * 100) / 100;

      // Marcar QR como usado (grava phone/nome para o WhatsApp de boas-vindas)
      await tx.qrCode.update({
        where: { id: qr.id },
        data: {
          used: true,
          usedAt: new Date(),
          ...(dto.customerPhone && { usedByPhone: dto.customerPhone }),
          ...(dto.customerName  && { usedByCustomer: dto.customerName }),
        },
      });

      // Gravar redemption
      await tx.couponRedemption.create({
        data: {
          companyId,
          qrCodeId:   qr.id,
          orderId:    dto.orderId,
          orderTotal: dto.orderTotal,
          discount,
          ip,
          userAgent: ua ?? '',
          device:    detectDevice(ua),
        },
      });

      return { success: true, discount, campaignName: qr.campaign.name, discountValue: Number(qr.campaign.discountValue), discountType: qr.campaign.discountType as string };
    }).then(result => {
      // Fire-and-forget: WhatsApp de boas-vindas
      if (dto.customerPhone) {
        const discountLine = result.discountType === 'PERCENTUAL'
          ? `${result.discountValue}% de desconto`
          : `R$ ${result.discountValue.toFixed(2).replace('.', ',')} de desconto`;
        this.prisma.company.findUnique({ where: { id: companyId }, select: { slug: true } })
          .then(co => {
            const cardapioUrl = `${this.frontendUrl}/menu/${co?.slug ?? companyId}`;
            this.sendWelcomeWhatsapp({
              companyId,
              customerPhone: dto.customerPhone!,
              customerName:  dto.customerName ?? 'Cliente',
              campaignName:  result.campaignName,
              discountLine,
              cardapioUrl,
            }).catch(() => {});
          }).catch(() => {});
      }
      return { success: result.success, discount: result.discount };
    });
  }

  // ── Métricas para o dashboard ─────────────────────────────────────────────

  async getMetrics(companyId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [generated, scanned, redemptions] = await Promise.all([
      // Total gerado no período
      this.prisma.qrCode.count({
        where: { companyId, createdAt: { gte: since } },
      }),

      // Total escaneado (used = true)
      this.prisma.qrCode.count({
        where: { companyId, used: true, usedAt: { gte: since } },
      }),

      // Resgates com soma de faturamento
      this.prisma.couponRedemption.aggregate({
        where: { companyId, createdAt: { gte: since } },
        _count: { id: true },
        _sum:   { orderTotal: true, discount: true },
        _avg:   { orderTotal: true },
      }),
    ]);

    // Breakdown por campanha
    const byCampaign = await this.prisma.qrCode.groupBy({
      by: ['campaignId'],
      where: { companyId, createdAt: { gte: since } },
      _count: { id: true },
    });

    // Resgates dos últimos 7 dias (sparkline)
    const recentRedemptions = await this.prisma.couponRedemption.findMany({
      where: { companyId, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      select: { createdAt: true, orderTotal: true, discount: true },
      orderBy: { createdAt: 'asc' },
    });

    const totalOrders   = redemptions._count.id;
    const totalRevenue  = Number(redemptions._sum.orderTotal ?? 0);
    const totalDiscount = Number(redemptions._sum.discount ?? 0);
    const avgTicket     = Number(redemptions._avg.orderTotal ?? 0);
    const conversionRate = generated > 0
      ? Math.round((scanned / generated) * 10000) / 100  // 2 decimais
      : 0;

    return {
      period:         `${days} dias`,
      generated,
      scanned,
      conversionRate, // %
      totalOrders,
      totalRevenue:   Math.round(totalRevenue * 100) / 100,
      totalDiscount:  Math.round(totalDiscount * 100) / 100,
      avgTicket:      Math.round(avgTicket * 100) / 100,
      byCampaign,
      recentRedemptions,
    };
  }

  // ── Histórico de QR codes ─────────────────────────────────────────────────

  /** Retorna o printBlock do QrCode gerado para um pedido (PDV reprint) */
  async getPrintBlockForOrder(orderId: string, companyId: string) {
    const redemption = await (this.prisma as any).couponRedemption.findFirst({
      where: { orderId, companyId },
      include: { qrCode: true },
    });
    if (!redemption?.qrCode?.printBlock) return { printBlock: null };
    return { printBlock: redemption.qrCode.printBlock };
  }

  async listQrCodes(companyId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.qrCode.findMany({
        where: { companyId },
        include: { campaign: { select: { name: true, type: true } }, redemptions: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.qrCode.count({ where: { companyId } }),
    ]);
    return { items, total, page, limit };
  }
}
