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

  constructor(private readonly prisma: PrismaService) {}

  // ── 1. Confirmação completa de pedido ────────────────────────────────────────

  /**
   * Envia mensagem detalhada de confirmação quando um pedido é fechado.
   * Inclui: número, itens, total, pagamento e endereço.
   */
  async notifyOrderConfirmed(params: {
    companyId: string;
    orderId: string;
    customerPhone: string;
    customerName?: string;
    items: { name: string; quantity: number; unitPrice?: number }[];
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

    const shortId = params.orderId.slice(-6).toUpperCase();
    const items = formatOrderItems(params.items);
    const total = `R$ ${params.total.toFixed(2).replace('.', ',')}`;
    const payment =
      PAYMENT_LABELS[params.paymentMethod] ?? params.paymentMethod;
    const address = params.address?.trim() || 'Retirada no balcão';

    const message = tplOrderConfirmed({
      name: params.customerName ?? '',
      orderId: shortId,
      items,
      total,
      payment,
      address,
    });

    await this.dispatch(connection, phone, message);
    this.log.log(`Confirmação enviada — order #${shortId} → ${phone}`);
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
    const message = templateFn(shortId, params.customerName);

    await this.dispatch(connection, phone, message);
    this.log.log(
      `Status "${params.newStatus}" notificado — order #${shortId} → ${phone}`,
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
  ): Promise<void> {
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
        if (!res.ok) this.log.warn(`Evolution dispatch HTTP ${res.status}`);
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
        if (!res.ok) this.log.warn(`Cloud API dispatch HTTP ${res.status}`);
      } else {
        this.log.warn(
          `dispatch: provider "${connection.provider}" não suportado ou incompleto`,
        );
      }
    } catch (err: any) {
      this.log.warn(`dispatch error: ${err?.message}`);
    }
  }
}
