import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/database/prisma.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { SocketGateway } from '@/socket/socket.gateway';
import { OnlineOrdersService } from '@/modules/online-orders/online-orders.service';

export type PaymentProvider = 'MERCADO_PAGO' | 'STRIPE';

export interface CreateCheckoutDto {
  companyId: string;
  plan: string;
  provider: PaymentProvider;
  successUrl?: string;
  cancelUrl?: string;
}

const PLAN_PRICES: Record<string, { amount: number; label: string }> = {
  BASIC: { amount: 9700, label: 'Plano Básico — FoodSaaS' },
  DELIVERY: { amount: 19700, label: 'Plano Profissional — FoodSaaS' },
  ENTERPRISE: { amount: 39700, label: 'Plano Enterprise — FoodSaaS' },
};

const PIX_EXPIRATION_MINUTES = 30;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly socket: SocketGateway,
    private readonly onlineOrders: OnlineOrdersService,
  ) {}

  // ─── Subscription checkout ─────────────────────────────────────────────────

  async createCheckout(
    dto: CreateCheckoutDto,
  ): Promise<{ checkoutUrl: string; paymentId: string }> {
    const planData = PLAN_PRICES[dto.plan];
    if (!planData) throw new BadRequestException('Plano inválido.');

    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });
    if (!company) throw new BadRequestException('Empresa não encontrada.');

    if (dto.provider === 'MERCADO_PAGO')
      return this.createMercadoPagoCheckout(dto, planData, company);
    return this.createStripeCheckout(dto, planData, company);
  }

  private async createMercadoPagoCheckout(
    dto: CreateCheckoutDto,
    planData: { amount: number; label: string },
    company: any,
  ) {
    const accessToken = this.config.get<string>('MERCADOPAGO_ACCESS_TOKEN');
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const backendUrl =
      this.config.get<string>('BACKEND_URL') || 'http://localhost:3001';

    if (!accessToken) {
      this.logger.warn('MERCADOPAGO_ACCESS_TOKEN not configured.');
      return {
        checkoutUrl: `${frontendUrl}/pagamento/sucesso?plan=${dto.plan}&companyId=${dto.companyId}&mock=1`,
        paymentId: `mock_mp_${Date.now()}`,
      };
    }

    const body = {
      items: [
        {
          title: planData.label,
          quantity: 1,
          unit_price: planData.amount / 100,
          currency_id: 'BRL',
        },
      ],
      back_urls: {
        success:
          dto.successUrl ||
          `${frontendUrl}/pagamento/sucesso?plan=${dto.plan}&companyId=${dto.companyId}`,
        failure: dto.cancelUrl || `${frontendUrl}/pagamento/cancelado`,
        pending: `${frontendUrl}/pagamento/pendente`,
      },
      auto_return: 'approved',
      notification_url: `${backendUrl}/api/payments/webhook/mercadopago`,
      external_reference: `${dto.companyId}|${dto.plan}`,
      metadata: { companyId: dto.companyId, plan: dto.plan },
    };

    const response = await fetch(
      'https://api.mercadopago.com/checkout/preferences',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`MercadoPago error: ${err}`);
      throw new BadRequestException('Erro ao criar checkout MercadoPago.');
    }

    const data: any = await response.json();
    return { checkoutUrl: data.init_point, paymentId: data.id };
  }

  private async createStripeCheckout(
    dto: CreateCheckoutDto,
    planData: { amount: number; label: string },
    company: any,
  ) {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    if (!secretKey) {
      this.logger.warn('STRIPE_SECRET_KEY not configured.');
      return {
        checkoutUrl: `${frontendUrl}/pagamento/sucesso?plan=${dto.plan}&companyId=${dto.companyId}&mock=1`,
        paymentId: `mock_stripe_${Date.now()}`,
      };
    }

    const params = new URLSearchParams({
      'payment_method_types[]': 'card',
      'line_items[0][price_data][currency]': 'brl',
      'line_items[0][price_data][product_data][name]': planData.label,
      'line_items[0][price_data][unit_amount]': String(planData.amount),
      'line_items[0][quantity]': '1',
      mode: 'payment',
      success_url:
        dto.successUrl ||
        `${frontendUrl}/pagamento/sucesso?plan=${dto.plan}&companyId=${dto.companyId}`,
      cancel_url: dto.cancelUrl || `${frontendUrl}/pagamento/cancelado`,
      'metadata[companyId]': dto.companyId,
      'metadata[plan]': dto.plan,
    });

    const response = await fetch(
      'https://api.stripe.com/v1/checkout/sessions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${secretKey}`,
        },
        body: params.toString(),
      },
    );

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`Stripe error: ${err}`);
      throw new BadRequestException('Erro ao criar checkout Stripe.');
    }

    const data: any = await response.json();
    return { checkoutUrl: data.url, paymentId: data.id };
  }

  // ─── PIX nativo (OnlineOrder) ───────────────────────────────────────────────

  async createOnlinePix(onlineOrderId: string, companyId: string) {
    const order = await this.onlineOrders.findOne(onlineOrderId, companyId);

    if (order.paymentStatus === 'APPROVED') {
      throw new BadRequestException('Pedido já está pago.');
    }

    const accessToken = this.config.get<string>('MERCADOPAGO_ACCESS_TOKEN');
    const backendUrl =
      this.config.get<string>('BACKEND_URL') || 'http://localhost:3001';

    if (!accessToken) {
      this.logger.warn(
        'MERCADOPAGO_ACCESS_TOKEN not configured — returning mock PIX.',
      );
      const mockExpires = new Date(
        Date.now() + PIX_EXPIRATION_MINUTES * 60_000,
      );
      await this.onlineOrders.updatePayment(onlineOrderId, {
        mercadopagoPaymentId: `mock_pix_${Date.now()}`,
        pixQrcode: undefined,
        pixCopyPaste:
          '00020101021226580014BR.GOV.BCB.PIX0136mock-pix-key-for-testing5204000053039865802BR5925MOCK RESTAURANTE TEST6009SAO PAULO62140510mock12345630461C3',
        pixExpiresAt: mockExpires,
      });
      return {
        pixCopyPaste:
          '00020101021226580014BR.GOV.BCB.PIX0136mock-pix-key-for-testing5204000053039865802BR5925MOCK RESTAURANTE TEST6009SAO PAULO62140510mock12345630461C3',
        pixQrcode: null,
        expiresAt: mockExpires,
        paymentId: `mock_pix_${Date.now()}`,
        mock: true,
      };
    }

    const expiresAt = new Date(Date.now() + PIX_EXPIRATION_MINUTES * 60_000);
    const expiresIso = expiresAt.toISOString().replace('Z', '-03:00');

    const itemsArr: any[] = Array.isArray(order.items) ? order.items : [];
    const description =
      itemsArr.length > 0
        ? itemsArr
            .map((i: any) => i.productName || i.name || 'Item')
            .join(', ')
            .slice(0, 100)
        : `Pedido online #${order.id.slice(-6).toUpperCase()}`;

    const payerEmail =
      order.customerEmail ||
      `${order.customerPhone.replace(/\D/g, '')}@pedido.app`;
    const nameParts = order.customerName.trim().split(' ');
    const firstName = nameParts[0] || 'Cliente';
    const lastName = nameParts.slice(1).join(' ') || 'Online';

    const body = {
      transaction_amount: Number(order.total),
      description,
      payment_method_id: 'pix',
      date_of_expiration: expiresIso,
      notification_url: `${backendUrl}/api/payments/webhook/online-order`,
      external_reference: `ONLINE_ORDER|${order.id}|${companyId}`,
      payer: {
        email: payerEmail,
        first_name: firstName,
        last_name: lastName,
      },
    };

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Idempotency-Key': `pix-${order.id}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`MercadoPago PIX error: ${err}`);
      throw new BadRequestException('Erro ao gerar PIX. Tente novamente.');
    }

    const mp: any = await response.json();
    const txData = mp.point_of_interaction?.transaction_data;
    const pixCopyPaste = txData?.qr_code || undefined;
    const pixQrcode = txData?.qr_code_base64 || undefined;

    await this.onlineOrders.updatePayment(onlineOrderId, {
      mercadopagoPaymentId: String(mp.id),
      pixQrcode,
      pixCopyPaste,
      pixExpiresAt: expiresAt,
    });

    this.logger.log(`PIX created: mpId=${mp.id} order=${onlineOrderId}`);

    return {
      pixCopyPaste,
      pixQrcode,
      expiresAt,
      paymentId: String(mp.id),
      mock: false,
    };
  }

  // ─── Payment status polling ─────────────────────────────────────────────────

  async getOnlinePaymentStatus(onlineOrderId: string, companyId: string) {
    const order = await this.onlineOrders.findOne(onlineOrderId, companyId);
    return {
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      paidAt: order.paidAt,
    };
  }

  // ─── Webhook: online orders (idempotente) ───────────────────────────────────

  async handleOnlineOrderWebhook(
    body: any,
    query: any,
    xSignature: string,
    xRequestId: string,
  ): Promise<void> {
    const mpPaymentId = body?.data?.id || query?.id;
    if (!mpPaymentId) return;

    // ── Signature validation (official MP algorithm) ────────────────────────
    // https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
    const secret = this.config.get<string>('MP_WEBHOOK_SECRET');
    if (secret) {
      const valid = this.verifyMpSignature(
        String(mpPaymentId),
        xSignature ?? '',
        xRequestId ?? '',
        secret,
      );
      if (!valid) {
        this.logger.warn(
          `[MP Webhook] Rejected — invalid signature for eventId=${mpPaymentId}`,
        );
        throw new UnauthorizedException('Invalid webhook signature.');
      }
    } else {
      this.logger.warn(
        '[MP Webhook] MP_WEBHOOK_SECRET not configured — signature check skipped (dev mode)',
      );
    }

    const eventId = String(mpPaymentId);

    // Idempotency — skip if already processed
    const existing = await this.prisma.paymentWebhook.findUnique({
      where: { gateway_eventId: { gateway: 'MERCADOPAGO', eventId } },
    });
    if (existing?.processed) {
      this.logger.log(`Webhook already processed: eventId=${eventId}`);
      return;
    }

    // Log raw webhook
    await this.prisma.paymentWebhook.upsert({
      where: { gateway_eventId: { gateway: 'MERCADOPAGO', eventId } },
      update: { payload: body as any },
      create: {
        gateway: 'MERCADOPAGO',
        eventId,
        event: body?.type || 'payment',
        payload: body as any,
      },
    });

    const accessToken = this.config.get<string>('MERCADOPAGO_ACCESS_TOKEN');
    if (!accessToken) return;

    let mp: any;
    try {
      const res = await fetch(
        `https://api.mercadopago.com/v1/payments/${mpPaymentId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      mp = await res.json();
    } catch (err) {
      this.logger.error(`Failed to fetch MP payment: ${err}`);
      return;
    }

    const ref = mp.external_reference || '';
    if (!ref.startsWith('ONLINE_ORDER|')) return;

    const [, onlineOrderId, companyId] = ref.split('|');
    if (!onlineOrderId || !companyId) return;

    const mpStatus: string = mp.status;
    const paymentStatus =
      mpStatus === 'approved'
        ? 'APPROVED'
        : mpStatus === 'rejected'
          ? 'REJECTED'
          : mpStatus === 'cancelled'
            ? 'EXPIRED'
            : 'PENDING';

    await this.onlineOrders.updatePayment(onlineOrderId, {
      paymentStatus: paymentStatus as any,
      mercadopagoPaymentId: eventId,
      paidAt: mpStatus === 'approved' ? new Date() : undefined,
    });

    if (paymentStatus === 'APPROVED') {
      await this.onlineOrders.updateOrderStatus(onlineOrderId, 'CONFIRMED');
      // → Kitchen / dashboard (company room)
      this.socket.emitOnlineOrderPaid(companyId, {
        onlineOrderId,
        paymentStatus,
        orderStatus: 'CONFIRMED',
      });
      // → Customer tracking page (order room — /pedido/confirmado listens here)
      this.socket.emitOrderStatusChanged(onlineOrderId, {
        status: 'CONFIRMED',
        source: 'PAYMENT',
      });
      this.logger.log(
        `OnlineOrder ${onlineOrderId} PAID — emitting to company ${companyId} and order room`,
      );

      // → Payment confirmed email to customer (fire-and-forget)
      this.onlineOrders
        .findOne(onlineOrderId, companyId)
        .then((o) => {
          if (!o.customerEmail) return;
          return this.notifications.send({
            to: o.customerEmail,
            type: 'ORDER_STATUS',
            data: {
              orderId: onlineOrderId.slice(-8).toUpperCase(),
              status: 'Pagamento confirmado — pedido em preparo',
            },
          });
        })
        .catch((e: any) =>
          this.logger.warn(`[OnlineOrderWebhook] email failed: ${e?.message}`),
        );
    }

    // Mark webhook as processed
    await this.prisma.paymentWebhook.update({
      where: { gateway_eventId: { gateway: 'MERCADOPAGO', eventId } },
      data: { processed: true, companyId },
    });
  }

  // ─── Webhook: subscription plans (existing) ────────────────────────────────

  async handleWebhookMercadoPago(body: any): Promise<void> {
    this.logger.log(`MP subscription webhook: ${JSON.stringify(body)}`);
    if (body.type !== 'payment' || !body.data?.id) return;

    const accessToken = this.config.get<string>('MERCADOPAGO_ACCESS_TOKEN');
    if (!accessToken) return;

    const res = await fetch(
      `https://api.mercadopago.com/v1/payments/${body.data.id}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const payment: any = await res.json();

    if (payment.status === 'approved') {
      const ref = payment.external_reference || '';
      if (ref.startsWith('ONLINE_ORDER|')) return; // handled by handleOnlineOrderWebhook

      const [companyId, plan] = ref.split('|');
      if (companyId && plan) await this.activateSubscription(companyId, plan);
    }
  }

  async handleWebhookStripe(rawBody: string, signature: string): Promise<void> {
    this.logger.log('Stripe webhook received');
    try {
      const event = JSON.parse(rawBody);
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { companyId, plan } = session.metadata || {};
        if (companyId && plan) await this.activateSubscription(companyId, plan);
      }
    } catch (err) {
      this.logger.error(`Stripe webhook error: ${err}`);
    }
  }

  // ─── Legacy order checkout (PDV) ───────────────────────────────────────────

  async createOrderCheckout(dto: {
    orderId: string;
    companyId: string;
  }): Promise<{ checkoutUrl: string; paymentId: string }> {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { items: true },
    });
    if (!order || order.companyId !== dto.companyId)
      throw new BadRequestException('Pedido não encontrado.');

    const accessToken = this.config.get<string>('MERCADOPAGO_ACCESS_TOKEN');
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const backendUrl =
      this.config.get<string>('BACKEND_URL') || 'http://localhost:3001';

    let checkoutUrl: string;
    let externalId: string;

    if (!accessToken) {
      this.logger.warn(
        'MERCADOPAGO_ACCESS_TOKEN not configured — mock order checkout.',
      );
      externalId = `mock_order_${Date.now()}`;
      checkoutUrl = `${frontendUrl}/pedido/confirmado?orderId=${dto.orderId}&mock=1`;
    } else {
      const body = {
        items: order.items.map((item) => ({
          title: item.productName,
          quantity: Number(item.quantity),
          unit_price: Number(item.unitPrice),
          currency_id: 'BRL',
        })),
        back_urls: {
          success: `${frontendUrl}/pedido/confirmado?orderId=${dto.orderId}`,
          failure: `${frontendUrl}/pedido/erro?orderId=${dto.orderId}`,
          pending: `${frontendUrl}/pedido/pendente?orderId=${dto.orderId}`,
        },
        auto_return: 'approved',
        notification_url: `${backendUrl}/api/payments/webhook/order`,
        external_reference: `ORDER|${dto.orderId}|${dto.companyId}`,
      };

      const res = await fetch(
        'https://api.mercadopago.com/checkout/preferences',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const err = await res.text();
        this.logger.error(`MercadoPago order checkout error: ${err}`);
        throw new BadRequestException('Erro ao criar checkout do pedido.');
      }

      const data: any = await res.json();
      checkoutUrl = data.init_point;
      externalId = data.id;
    }

    const payment = await this.prisma.payment.create({
      data: {
        orderId: dto.orderId,
        companyId: dto.companyId,
        externalId,
        status: 'PENDING',
        provider: 'MERCADO_PAGO',
        amount: order.total,
      },
    });

    return { checkoutUrl, paymentId: payment.id };
  }

  async handleOrderWebhook(body: any): Promise<void> {
    this.logger.log(`Order payment webhook: ${JSON.stringify(body)}`);
    if (body.type !== 'payment' || !body.data?.id) return;

    const accessToken = this.config.get<string>('MERCADOPAGO_ACCESS_TOKEN');
    if (!accessToken) return;

    const res = await fetch(
      `https://api.mercadopago.com/v1/payments/${body.data.id}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const mpPayment: any = await res.json();
    const parts = (mpPayment.external_reference || '').split('|');
    if (parts[0] !== 'ORDER' || !parts[1]) return;

    const [, orderId, companyId] = parts;
    const status: 'APPROVED' | 'REJECTED' | 'PENDING' =
      mpPayment.status === 'approved'
        ? 'APPROVED'
        : mpPayment.status === 'rejected'
          ? 'REJECTED'
          : 'PENDING';

    await this.prisma.payment.updateMany({
      where: { orderId, companyId },
      data: { status, externalId: String(body.data.id) },
    });
    if (status === 'APPROVED') {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'CONFIRMED' },
      });
      this.logger.log(`Order ${orderId} confirmed via payment webhook.`);
    }
  }

  // ─── Subscription activation ────────────────────────────────────────────────

  async activateSubscription(companyId: string, plan: string): Promise<void> {
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + 1);

    await this.prisma.company.update({
      where: { id: companyId },
      data: { plan, subscriptionStatus: 'ACTIVE', dueDate, isBlocked: false },
    });

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { users: { where: { role: 'ADMIN' }, take: 1 } },
    });

    if (company?.users?.[0]?.email) {
      await this.notifications.send({
        to: company.users[0].email,
        type: 'PAYMENT_CONFIRMED',
        data: { plan, dueDate: dueDate.toLocaleDateString('pt-BR') },
      });
    }

    this.logger.log(
      `Subscription activated: company=${companyId} plan=${plan}`,
    );
  }

  // ─── MercadoPago webhook signature verification ────────────────────────────
  // Official algorithm:
  // 1. Parse x-signature header → ts and v1
  // 2. Build manifest: "id:<dataId>;request-id:<xRequestId>;ts:<ts>;"
  // 3. HMAC-SHA256(manifest, MP_WEBHOOK_SECRET) must equal v1
  // Docs: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
  private verifyMpSignature(
    dataId: string,
    xSignature: string,
    xRequestId: string,
    secret: string,
  ): boolean {
    if (!xSignature) return false;

    // x-signature format: "ts=1704908010,v1=abc123..."
    const parts: Record<string, string> = {};
    for (const part of xSignature.split(',')) {
      const [key, value] = part.split('=', 2);
      if (key && value) parts[key.trim()] = value.trim();
    }

    const ts = parts['ts'];
    const v1 = parts['v1'];
    if (!ts || !v1) return false;

    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const computed = createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    return timingSafeEqual(Buffer.from(computed), Buffer.from(v1));
  }
}
