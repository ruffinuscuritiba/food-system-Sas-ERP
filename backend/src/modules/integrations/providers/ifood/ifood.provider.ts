import { createHmac, timingSafeEqual } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import {
  IIntegrationProvider,
  IntegrationEvent,
} from '../integration-provider.interface';

const IFOOD_API = 'https://merchant-api.ifood.com.br';

export class IfoodProvider implements IIntegrationProvider {
  readonly providerName = 'IFOOD';

  // ── TODO 1: OAuth2 token cache ──────────────────────────────────────────
  private _accessToken: string | null = null;
  private _tokenExpiresAt = 0;

  /**
   * Obtém (ou renova) o access token via client_credentials.
   * Reutiliza o token em cache até 60 s antes de expirar.
   */
  async getAccessToken(clientId: string, clientSecret: string): Promise<string> {
    if (this._accessToken && Date.now() < this._tokenExpiresAt - 60_000) {
      return this._accessToken;
    }
    const res = await fetch(`${IFOOD_API}/authentication/v1.0/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        clientId,
        clientSecret,
        grantType: 'client_credentials',
      }).toString(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`iFood OAuth2 falhou: ${res.status} — ${text}`);
    }
    const data = (await res.json()) as {
      accessToken: string;
      expiresIn: number;
    };
    this._accessToken = data.accessToken;
    this._tokenExpiresAt = Date.now() + data.expiresIn * 1_000;
    return this._accessToken;
  }

  /** Expira em (ms epoch) — permite que a service persista no DB após refresh. */
  get tokenExpiry(): number { return this._tokenExpiresAt; }

  // ── TODO 2: Validação HMAC com timing-safe compare ──────────────────────
  validateWebhookSignature(
    secret: string,
    headers: Record<string, string>,
    rawBody: Buffer,
  ): boolean {
    const signature =
      headers['x-ifood-signature'] ?? headers['x-signature'] ?? '';
    if (!signature || !secret) return false;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    try {
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      // timingSafeEqual lança RangeError se buffers têm tamanhos diferentes
      return false;
    }
  }

  // ── TODO 4: ACK de pedido (deve ser chamado em < 10 s do evento PLACED) ─
  async sendAck(orderId: string, accessToken: string): Promise<void> {
    const res = await fetch(
      `${IFOOD_API}/order/v1.0/orders/${orderId}/statuses/confirmation`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );
    if (!res.ok && res.status !== 202) {
      const text = await res.text();
      throw new Error(
        `iFood ACK falhou para ${orderId}: ${res.status} — ${text}`,
      );
    }
  }

  // ── TODO 5: Sync de cardápio ─────────────────────────────────────────────
  async pushCatalog(
    merchantId: string,
    categories: unknown[],
    accessToken: string,
  ): Promise<void> {
    const res = await fetch(
      `${IFOOD_API}/catalog/v2.0/merchants/${merchantId}/categories`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ categories }),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `iFood pushCatalog falhou para ${merchantId}: ${res.status} — ${text}`,
      );
    }
  }

  parseEvent(
    body: unknown,
    _headers: Record<string, string>,
  ): IntegrationEvent {
    const b = body as Record<string, any>;

    // iFood envia eventos no formato { fullCode, orderId, ... }
    const eventCode = b?.fullCode ?? b?.code ?? '';
    const type = this.mapEventCode(eventCode);

    if (!b?.orderId) {
      throw new BadRequestException('IfoodProvider: payload sem orderId.');
    }

    const order = b?.order ?? b ?? {};
    const delivery = order?.delivery ?? {};
    const customer = order?.customer ?? {};
    const address = delivery?.deliveryAddress ?? {};

    return {
      type,
      externalOrderId: b.orderId,
      externalStatus: eventCode,
      orderType: delivery?.mode === 'DEFAULT' ? 'DELIVERY' : 'PICKUP',
      customer: {
        name: customer?.name ?? '',
        phone: customer?.phone?.localizer ?? customer?.phone ?? '',
        address: address?.formattedAddress ?? address?.streetName ?? '',
        addressNumber: address?.streetNumber ?? '',
        neighborhood: address?.neighborhood ?? '',
        city: address?.city ?? '',
        state: address?.state ?? '',
        zipCode: address?.postalCode ?? '',
      },
      items: (order?.items ?? []).map((i: any) => ({
        externalProductId: i.id ?? i.externalId,
        externalVariantId: i.externalCode,
        productName: i.name ?? 'Item iFood',
        quantity: Number(i.quantity ?? 1),
        unitPrice: Number(i.unitPrice ?? i.price ?? 0),
        notes: i.observations ?? '',
      })),
      paymentMethod: this.mapPaymentMethod(
        order?.payments?.methods?.[0]?.type ?? 'PIX',
      ),
      subtotal: Number(order?.subTotal ?? 0),
      deliveryFee: Number(delivery?.deliveryFee ?? 0),
      total: Number(order?.totalPrice ?? 0),
      notes: order?.observations ?? '',
      rawPayload: body,
    };
  }

  // ── TODO 3: Mapeamento completo de status conforme documentação oficial ──
  mapOrderStatus(externalStatus: string): string {
    const map: Record<string, string> = {
      // Short codes (formato legado iFood)
      PLC: 'PENDING',
      CFM: 'CONFIRMED',
      INT: 'CONFIRMED',   // INTEGRATION_CONFIRMED
      ACE: 'CONFIRMED',   // ACCEPTED
      PRP: 'PREPARING',
      PRE: 'PREPARING',
      RDY: 'READY',
      DSP: 'OUT_FOR_DELIVERY',
      CON: 'DELIVERED',
      CAN: 'CANCELLED',
      CRQ: 'CANCELLED',   // CANCELLATION_REQUESTED
      CDN: 'CONFIRMED',   // CANCELLATION_DENIED → retorna a confirmado

      // fullCode (iFood v2 — lista oficial completa)
      PLACED: 'PENDING',
      CONFIRMED: 'CONFIRMED',
      INTEGRATION_CONFIRMED: 'CONFIRMED',
      WAITING_ACCEPTANCE: 'PENDING',
      ACCEPTED: 'CONFIRMED',
      PREPARATION_STARTED: 'PREPARING',
      IN_PREPARATION: 'PREPARING',
      READY_TO_PICKUP: 'READY',
      WAITING_PICKUP: 'READY',
      DISPATCHED: 'OUT_FOR_DELIVERY',
      PICK_UP_AREA_ASSIGNED: 'OUT_FOR_DELIVERY',
      WAITING_SELLER: 'PENDING',
      CONCLUDED: 'DELIVERED',
      CONSUMER_PICKED_UP: 'DELIVERED',
      PICKED_BY_THE_CONSUMER: 'DELIVERED',
      CANCELLED: 'CANCELLED',
      CANCELLATION_REQUESTED: 'CANCELLED',
      CANCELLATION_DENIED: 'CONFIRMED',
      INTEGRATION_ERROR: 'PENDING',
    };
    return map[externalStatus?.toUpperCase()] ?? 'PENDING';
  }

  mapPaymentMethod(externalPayment: string): string {
    const map: Record<string, string> = {
      ONLINE: 'PIX',
      PIX: 'PIX',
      CREDIT: 'CREDIT_CARD',
      CREDIT_CARD: 'CREDIT_CARD',
      DEBIT: 'DEBIT_CARD',
      DEBIT_CARD: 'DEBIT_CARD',
      CASH: 'CASH',
      DINHEIRO: 'CASH',
      VOUCHER: 'CREDIT_CARD',
      MEAL_VOUCHER: 'CREDIT_CARD',
      BANK_SLIP: 'TRANSFER',
      TRANSFER: 'TRANSFER',
    };
    return map[externalPayment?.toUpperCase()] ?? 'PIX';
  }

  private mapEventCode(code: string): IntegrationEvent['type'] {
    if (!code) return 'ORDER_CREATED';
    const upper = code.toUpperCase();
    if (upper === 'PLACED' || upper === 'PLC') return 'ORDER_CREATED';
    if (upper === 'CANCELLED' || upper === 'CAN') return 'ORDER_CANCELLED';
    if (upper.startsWith('CAT')) return 'CATALOG_SYNC';
    return 'STATUS_CHANGED';
  }
}
