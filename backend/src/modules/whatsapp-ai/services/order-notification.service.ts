import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import {
  OrderStatusKey,
  STATUS_TEMPLATES,
  tplOrderConfirmed,
  formatPhoneInternational,
  formatOrderItems,
  PAYMENT_LABELS,
} from './notification-templates';
import { ReceiptImageService, ReceiptItem } from './receipt-image.service';

const TYPE_LABELS: Record<string, string> = {
  DELIVERY: 'DELIVERY',
  PICKUP: 'RETIRADA',
  DINE_IN: 'BALCÃO',
};

/**
 * OrderNotificationService
 *
 * Responsável por enviar notificações automáticas de status de pedido via WhatsApp.
 *
 * Dois pontos de entrada:
 *   1. notifyOrderConfirmed() — chamado quando pedido é fechado (IA ou painel)
 *   2. notifyStatusChange()   — chamado a cada mudança de status no ciclo de vida
 *
 * Anti-loop: cada evento é idempotente — o serviço não envia duplicatas para o
 * mesmo (orderId + status) graças ao guard de status anterior verificado pelo caller.
 *
 * Env necessárias (já existentes no projeto):
 *   Nenhuma nova — usa as conexões WhatsApp existentes por empresa.
 */
@Injectable()
export class OrderNotificationService {
  private readonly log = new Logger('OrderNotificationService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly receiptImageService: ReceiptImageService,
  ) {}

  // ── 1. Confirmação completa de pedido ────────────────────────────────────────

  /**
   * Envia a confirmação de pedido fechado. Tenta primeiro um cupom em
   * imagem (fundo creme, visual de recibo impresso — WhatsApp não permite
   * cor de fundo em mensagem de texto, só mídia); se a geração/envio da
   * imagem falhar por qualquer motivo (provider sem suporte a mídia, erro
   * de render, falha de rede), cai automaticamente pra mensagem de texto
   * já validada em produção — nunca deixa o cliente sem nenhuma confirmação.
   */
  async notifyOrderConfirmed(params: {
    companyId: string;
    orderId: string;
    customerPhone: string;
    customerName?: string;
    orderType?: string;
    items: {
      name: string;
      quantity: number;
      unitPrice?: number;
      categoryType?: string | null;
      complements?: { name: string; price: number }[];
    }[];
    subtotal?: number;
    deliveryFee?: number;
    total: number;
    paymentMethod: string;
    address?: string;
  }): Promise<void> {
    const phone = formatPhoneInternational(params.customerPhone);
    if (!phone || phone.length < 10) {
      this.log.warn(
        `notifyOrderConfirmed: telefone inválido "${params.customerPhone}"`,
      );
      return;
    }

    const connection = await this.findActiveConnection(params.companyId);
    if (!connection) return;

    const money = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
    const shortId = params.orderId.slice(-6).toUpperCase();
    const items = formatOrderItems(params.items);
    const total = money(params.total);
    const subtotal =
      params.subtotal != null ? money(params.subtotal) : undefined;
    const deliveryFee =
      params.deliveryFee != null && params.deliveryFee > 0
        ? money(params.deliveryFee)
        : undefined;
    const payment =
      PAYMENT_LABELS[params.paymentMethod] ?? params.paymentMethod;
    // Pedido de mesa/consumo local grava deliveryAddress como o literal
    // "INTERNO" -- sem esse tratamento, a mensagem mostrava "Entrega:
    // INTERNO" pro cliente, que não faz sentido nenhum fora do contexto
    // interno do sistema.
    const rawAddress = params.address?.trim();
    const address =
      !rawAddress || rawAddress.toUpperCase() === 'INTERNO'
        ? rawAddress?.toUpperCase() === 'INTERNO'
          ? 'Consumo no local'
          : 'Retirada no balcão'
        : rawAddress;
    const isDelivery = !!rawAddress && rawAddress.toUpperCase() !== 'INTERNO';

    // Fallback de texto — sempre calculado, usado se a imagem falhar por
    // qualquer razão (nunca deixa o pedido sem confirmação nenhuma).
    const textMessage = tplOrderConfirmed({
      name: params.customerName ?? '',
      orderId: shortId,
      items,
      subtotal,
      deliveryFee,
      total,
      payment,
      address,
    });

    try {
      const company = await this.prisma.company.findUnique({
        where: { id: params.companyId },
        select: {
          name: true,
          cnpj: true,
          street: true,
          streetNumber: true,
          neighborhood: true,
          city: true,
          slug: true,
        },
      });
      const addressLine = [company?.street, company?.streetNumber, company?.neighborhood]
        .filter(Boolean)
        .join(', ');

      const receiptItems: ReceiptItem[] = params.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        categoryType: i.categoryType ?? null,
        complements: i.complements,
      }));

      const png = await this.receiptImageService.render({
        companyName: company?.name ?? 'Pedido',
        cnpj: company?.cnpj ?? null,
        addressLine: addressLine || null,
        orderId: shortId,
        orderTypeLabel: TYPE_LABELS[params.orderType ?? ''] ?? (isDelivery ? 'DELIVERY' : 'BALCÃO'),
        createdAt: new Date(),
        customerName: params.customerName ?? null,
        deliveryAddress: isDelivery ? rawAddress ?? null : null,
        items: receiptItems,
        subtotalLabel: subtotal ?? null,
        deliveryFeeLabel: deliveryFee ?? null,
        totalLabel: total,
        paymentLabel: payment,
        websiteFooter: company?.slug ? `foodsaas.com.br/menu/${company.slug}` : null,
      });

      const dataUrl = `data:image/png;base64,${png.toString('base64')}`;
      const sent = await this.dispatchMedia(connection, phone, dataUrl, '');
      if (sent) {
        this.log.log(`Confirmação (imagem) enviada — order #${shortId} → ${phone}`);
        return;
      }
      this.log.warn(
        `notifyOrderConfirmed: envio da imagem falhou, caindo pro texto — order #${shortId}`,
      );
    } catch (err: any) {
      this.log.warn(
        `notifyOrderConfirmed: falha ao gerar cupom-imagem, caindo pro texto (order #${shortId}): ${err?.message}`,
      );
    }

    const sentText = await this.dispatch(connection, phone, textMessage);
    this.log.log(
      `Confirmação (texto${sentText ? '' : ' — FALHOU'}) — order #${shortId} → ${phone}`,
    );
  }

  // ── 2. Gatilho de mudança de status ─────────────────────────────────────────

  /**
   * Envia mensagem curta e amigável quando o status do pedido muda.
   * Suporta: CONFIRMED, PREPARING, READY, OUT_FOR_DELIVERY, DELIVERED, CANCELLED.
   *
   * Anti-loop: não re-envia se status for igual ao anterior (caller deve checar).
   */
  async notifyStatusChange(params: {
    companyId: string;
    orderId: string;
    customerPhone: string;
    customerName?: string;
    newStatus: OrderStatusKey;
    orderType?: string;
  }): Promise<void> {
    const phone = formatPhoneInternational(params.customerPhone);
    if (!phone || phone.length < 10) {
      this.log.warn(
        `notifyStatusChange: telefone inválido "${params.customerPhone}"`,
      );
      return;
    }

    const templateFn = STATUS_TEMPLATES[params.newStatus];
    if (!templateFn) {
      this.log.debug(
        `notifyStatusChange: status "${params.newStatus}" sem template — ignorado`,
      );
      return;
    }

    const connection = await this.findActiveConnection(params.companyId);
    if (!connection) return;

    const shortId = params.orderId.slice(-6).toUpperCase();
    const message = templateFn(shortId, params.customerName, params.orderType);

    const sent = await this.dispatch(connection, phone, message);
    this.log.log(
      `Status "${params.newStatus}"${sent ? '' : ' — FALHOU'} — order #${shortId} → ${phone}`,
    );
  }

  // ── Helpers privados ─────────────────────────────────────────────────────────

  private async findActiveConnection(companyId: string): Promise<any | null> {
    try {
      const conn = await this.prisma.whatsappConnection.findFirst({
        where: { companyId, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      if (!conn) {
        this.log.debug(`Sem conexão WhatsApp ativa para empresa ${companyId}`);
      }
      return conn ?? null;
    } catch (err: any) {
      this.log.warn(`findActiveConnection: ${err?.message}`);
      return null;
    }
  }

  private async dispatch(
    connection: any,
    phone: string,
    text: string,
  ): Promise<boolean> {
    try {
      if (
        connection.provider === 'EVOLUTION' &&
        connection.apiUrl &&
        connection.instanceName
      ) {
        const url = `${String(connection.apiUrl).replace(/\/$/, '')}/message/sendText/${connection.instanceName}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: connection.apiToken ?? '',
          },
          body: JSON.stringify({ number: phone, text }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) {
          this.log.warn(`Evolution dispatch HTTP ${res.status}`);
          return false;
        }
        return true;
      } else if (
        connection.provider === 'CLOUD_API' &&
        connection.phoneNumberId
      ) {
        const url = `https://graph.facebook.com/v18.0/${connection.phoneNumberId}/messages`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${connection.apiToken ?? ''}`,
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phone,
            type: 'text',
            text: { body: text },
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) {
          this.log.warn(`Cloud API dispatch HTTP ${res.status}`);
          return false;
        }
        return true;
      }
      this.log.warn(
        `dispatch: provider "${connection.provider}" não suportado ou incompleto`,
      );
      return false;
    } catch (err: any) {
      this.log.warn(`dispatch error: ${err?.message}`);
      return false;
    }
  }

  /**
   * Envia uma imagem (data URL base64) como mídia. Só suportado no provider
   * EVOLUTION hoje — Cloud API (Meta) exige upload prévio pra media ID, que
   * não implementamos aqui; o caller já cai pro texto automaticamente
   * quando isso retorna false.
   */
  private async dispatchMedia(
    connection: any,
    phone: string,
    imageDataUrl: string,
    caption: string,
  ): Promise<boolean> {
    try {
      if (
        connection.provider !== 'EVOLUTION' ||
        !connection.apiUrl ||
        !connection.instanceName
      ) {
        this.log.warn(
          `dispatchMedia: provider "${connection.provider}" não suporta mídia aqui`,
        );
        return false;
      }
      const media = imageDataUrl.startsWith('data:')
        ? imageDataUrl.split(',').slice(1).join(',')
        : imageDataUrl;
      const url = `${String(connection.apiUrl).replace(/\/$/, '')}/message/sendMedia/${connection.instanceName}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: connection.apiToken ?? '',
        },
        body: JSON.stringify({
          number: phone,
          mediatype: 'image',
          mimetype: 'image/png',
          media,
          caption,
          fileName: 'pedido.png',
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.log.warn(`dispatchMedia Evolution HTTP ${res.status}: ${body.slice(0, 200)}`);
        return false;
      }
      return true;
    } catch (err: any) {
      this.log.warn(`dispatchMedia error: ${err?.message}`);
      return false;
    }
  }
}
