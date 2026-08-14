import { createHash } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import {
  IIntegrationProvider,
  IntegrationEvent,
} from '../integration-provider.interface';

const NINETY_NINE_FOOD_API = 'https://openapi.99food.com/v1';

/**
 * Provider para o 99Food Open Platform (developer-food.99app.com).
 * Diferente do iFood (OAuth2 client_credentials único por conta), o 99Food
 * usa auth_token POR LOJA: app_id + app_secret (da conta/app) + app_shop_id
 * (identificador da loja, escolhido por nós) → GET /auth/authtoken/get.
 * Assinatura de webhook: MD5(rawBody + app_secret) === header didi-header-sign.
 */
export class NinetyNineFoodProvider implements IIntegrationProvider {
  readonly providerName = 'NINETY_NINE_FOOD';

  private _authToken: string | null = null;
  private _tokenExpiresAt = 0;

  /**
   * Obtém (ou renova) o auth_token da loja. Reutiliza o token em cache até
   * 60s antes de expirar (token_expiration_time vem em segundos epoch).
   */
  async getAuthToken(
    appId: string,
    appSecret: string,
    appShopId: string,
  ): Promise<{ token: string; expiresAt: number }> {
    if (
      this._authToken &&
      Date.now() < this._tokenExpiresAt - 60_000
    ) {
      return { token: this._authToken, expiresAt: this._tokenExpiresAt };
    }

    const qs = new URLSearchParams({
      app_id: appId,
      app_secret: appSecret,
      app_shop_id: appShopId,
    }).toString();

    const res = await fetch(`${NINETY_NINE_FOOD_API}/auth/authtoken/get?${qs}`, {
      method: 'GET',
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`99Food auth/get falhou: ${res.status} — ${text}`);
    }
    const json = (await res.json()) as {
      errno: number;
      errmsg: string;
      data?: { auth_token: string; token_expiration_time: number };
    };
    if (json.errno !== 0 || !json.data) {
      throw new Error(`99Food auth/get erro ${json.errno}: ${json.errmsg}`);
    }

    this._authToken = json.data.auth_token;
    this._tokenExpiresAt = json.data.token_expiration_time * 1_000;
    return { token: this._authToken, expiresAt: this._tokenExpiresAt };
  }

  /** Assina parâmetros conforme "Authentication & Signature Mechanism": ordena por
   * chave (ASCII), concatena "k=v&k=v" e anexa o app_secret, depois MD5. */
  signParams(params: Record<string, string | number>, appSecret: string): string {
    const sorted = Object.keys(params).sort();
    const toSign =
      sorted.map((k) => `${k}=${params[k]}`).join('&') + appSecret;
    return createHash('md5').update(toSign).digest('hex');
  }

  // ── Verificação de assinatura do webhook (didi-header-sign) ──────────────
  validateWebhookSignature(
    secret: string,
    headers: Record<string, string>,
    rawBody: Buffer,
  ): boolean {
    const signature = headers['didi-header-sign'] ?? '';
    if (!signature || !secret) return false;
    const expected = createHash('md5')
      .update(Buffer.concat([rawBody, Buffer.from(secret)]))
      .digest('hex');
    // MD5 não é HMAC — não há necessidade de timing-safe compare (não é
    // um segredo derivado sensível a timing attack de força bruta prática).
    return signature.toLowerCase() === expected.toLowerCase();
  }

  /** Confirma/atualiza status do pedido (deve ser chamado em < 5 min do orderNew). */
  async sendAck(orderId: string, authToken: string): Promise<void> {
    await this.orderAction('confirm', orderId, authToken);
  }

  async orderAction(
    action: 'confirm' | 'ready' | 'delivered' | 'cancel',
    orderId: string,
    authToken: string,
  ): Promise<void> {
    const res = await fetch(`${NINETY_NINE_FOOD_API}/order/order/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth_token: authToken, order_id: orderId }),
    });
    const json = (await res.json().catch(() => null)) as
      | { errno: number; errmsg: string }
      | null;
    if (!res.ok || (json && json.errno !== 0)) {
      throw new Error(
        `99Food ${action} falhou para ${orderId}: ${res.status} — ${json?.errmsg ?? await res.text()}`,
      );
    }
  }

  parseEvent(
    body: unknown,
    _headers: Record<string, string>,
  ): IntegrationEvent {
    const b = body as Record<string, any>;
    const type = String(b?.type ?? '');
    const data = b?.data ?? {};
    const orderId = data?.order_id ?? data?.order_info?.order_id;

    if (!orderId) {
      throw new BadRequestException('NinetyNineFoodProvider: payload sem order_id.');
    }

    const eventType = this.mapEventCode(type);
    const orderInfo = data?.order_info ?? {};
    const address = orderInfo?.receive_address ?? {};
    const price = orderInfo?.price ?? {};
    const items = Array.isArray(orderInfo?.order_items) ? orderInfo.order_items : [];

    return {
      type: eventType,
      externalOrderId: String(orderId),
      externalStatus: type,
      orderType: 'DELIVERY',
      customer: {
        name: address?.name || address?.first_name || 'Cliente 99Food',
        phone: String(address?.phone ?? ''),
        address: address?.poi_address ?? address?.street_name ?? '',
        addressNumber: address?.street_number ?? address?.house_number ?? '',
        neighborhood: address?.district ?? '',
        city: address?.city ?? '',
        state: address?.state ?? '',
        zipCode: address?.postalCode ?? '',
      },
      items: items.map((i: any) => ({
        externalProductId: i.app_item_id ?? String(i.item_id ?? ''),
        externalVariantId: i.app_external_id ?? undefined,
        productName: i.name ?? 'Item 99Food',
        quantity: Number(i.amount ?? 1),
        unitPrice: Number(i.sku_price ?? 0) / 100,
        notes: i.remark ?? '',
      })),
      paymentMethod: this.mapPaymentMethod(String(orderInfo?.pay_method ?? '')),
      subtotal: Number(price?.order_price ?? 0) / 100,
      deliveryFee: Number(price?.delivery_price ?? 0) / 100,
      total: Number(price?.real_pay_price ?? price?.customer_need_paying_money ?? 0) / 100,
      notes: orderInfo?.remark ?? '',
      rawPayload: body,
    };
  }

  mapOrderStatus(externalStatus: string): string {
    const map: Record<string, string> = {
      orderNew: 'PENDING',
      orderConfirm: 'CONFIRMED',
      orderReady: 'READY',
      orderFinish: 'DELIVERED',
      orderCancel: 'CANCELLED',
      orderPartialCancel: 'CANCELLED',
    };
    return map[externalStatus] ?? 'PENDING';
  }

  mapPaymentMethod(_externalPayment: string): string {
    // 99Food processa o pagamento no próprio app (pré-pago) — o dinheiro
    // já caiu na conta da 99Food, nunca é "dinheiro na entrega" do lado
    // da loja. Mapeado como PIX (mesmo tratamento dado a "ONLINE" no iFood).
    return 'PIX';
  }

  private mapEventCode(type: string): IntegrationEvent['type'] {
    if (type === 'orderNew') return 'ORDER_CREATED';
    if (type === 'orderCancel' || type === 'orderPartialCancel') return 'ORDER_CANCELLED';
    return 'STATUS_CHANGED';
  }
}
