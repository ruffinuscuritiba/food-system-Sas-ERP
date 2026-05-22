import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/database/prisma.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';

export type PaymentProvider = 'MERCADOPAGO' | 'STRIPE';

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

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async createCheckout(dto: CreateCheckoutDto): Promise<{ checkoutUrl: string; paymentId: string }> {
    const planData = PLAN_PRICES[dto.plan];
    if (!planData) throw new BadRequestException('Plano inválido.');

    const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
    if (!company) throw new BadRequestException('Empresa não encontrada.');

    if (dto.provider === 'MERCADOPAGO') {
      return this.createMercadoPagoCheckout(dto, planData, company);
    }
    return this.createStripeCheckout(dto, planData, company);
  }

  private async createMercadoPagoCheckout(
    dto: CreateCheckoutDto,
    planData: { amount: number; label: string },
    company: any,
  ) {
    const accessToken = this.config.get<string>('MERCADOPAGO_ACCESS_TOKEN');
    if (!accessToken) {
      this.logger.warn('MERCADOPAGO_ACCESS_TOKEN not configured.');
      // Return a mock URL for development
      return {
        checkoutUrl: `${this.config.get('FRONTEND_URL') || 'http://localhost:3000'}/pagamento/sucesso?plan=${dto.plan}&companyId=${dto.companyId}&mock=1`,
        paymentId: `mock_mp_${Date.now()}`,
      };
    }

    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const backendUrl = this.config.get<string>('BACKEND_URL') || 'http://localhost:3001';

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
        success: dto.successUrl || `${frontendUrl}/pagamento/sucesso?plan=${dto.plan}&companyId=${dto.companyId}`,
        failure: dto.cancelUrl || `${frontendUrl}/pagamento/cancelado`,
        pending: `${frontendUrl}/pagamento/pendente`,
      },
      auto_return: 'approved',
      notification_url: `${backendUrl}/api/payments/webhook/mercadopago`,
      external_reference: `${dto.companyId}|${dto.plan}`,
      metadata: { companyId: dto.companyId, plan: dto.plan },
    };

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`MercadoPago error: ${err}`);
      throw new BadRequestException('Erro ao criar checkout MercadoPago.');
    }

    const data = await response.json();
    return {
      checkoutUrl: data.init_point,
      paymentId: data.id,
    };
  }

  private async createStripeCheckout(
    dto: CreateCheckoutDto,
    planData: { amount: number; label: string },
    company: any,
  ) {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      this.logger.warn('STRIPE_SECRET_KEY not configured.');
      const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
      return {
        checkoutUrl: `${frontendUrl}/pagamento/sucesso?plan=${dto.plan}&companyId=${dto.companyId}&mock=1`,
        paymentId: `mock_stripe_${Date.now()}`,
      };
    }

    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const backendUrl = this.config.get<string>('BACKEND_URL') || 'http://localhost:3001';

    const params = new URLSearchParams({
      'payment_method_types[]': 'card',
      'line_items[0][price_data][currency]': 'brl',
      'line_items[0][price_data][product_data][name]': planData.label,
      'line_items[0][price_data][unit_amount]': String(planData.amount),
      'line_items[0][quantity]': '1',
      mode: 'payment',
      success_url: dto.successUrl || `${frontendUrl}/pagamento/sucesso?plan=${dto.plan}&companyId=${dto.companyId}`,
      cancel_url: dto.cancelUrl || `${frontendUrl}/pagamento/cancelado`,
      'metadata[companyId]': dto.companyId,
      'metadata[plan]': dto.plan,
    });

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${secretKey}`,
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`Stripe error: ${err}`);
      throw new BadRequestException('Erro ao criar checkout Stripe.');
    }

    const data = await response.json();
    return {
      checkoutUrl: data.url,
      paymentId: data.id,
    };
  }

  async handleWebhookMercadoPago(body: any): Promise<void> {
    this.logger.log(`MercadoPago webhook: ${JSON.stringify(body)}`);
    if (body.type === 'payment' && body.data?.id) {
      const accessToken = this.config.get<string>('MERCADOPAGO_ACCESS_TOKEN');
      if (!accessToken) return;

      const res = await fetch(`https://api.mercadopago.com/v1/payments/${body.data.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payment = await res.json();

      if (payment.status === 'approved') {
        const [companyId, plan] = (payment.external_reference || '').split('|');
        if (companyId && plan) {
          await this.activateSubscription(companyId, plan);
        }
      }
    }
  }

  async handleWebhookStripe(rawBody: string, signature: string): Promise<void> {
    this.logger.log(`Stripe webhook received`);
    // Stripe webhook verification would go here with stripe.webhooks.constructEvent
    // For now, parse the body directly (in production, verify signature)
    try {
      const event = JSON.parse(rawBody);
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { companyId, plan } = session.metadata || {};
        if (companyId && plan) {
          await this.activateSubscription(companyId, plan);
        }
      }
    } catch (err) {
      this.logger.error(`Stripe webhook error: ${err}`);
    }
  }

  async activateSubscription(companyId: string, plan: string): Promise<void> {
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + 1);

    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        plan,
        subscriptionStatus: 'ACTIVE',
        dueDate,
        isBlocked: false,
      },
    });

    // Send confirmation email
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { users: { where: { role: 'ADMIN' }, take: 1 } },
    });

    if (company?.users?.[0]?.email) {
      await this.notifications.send({
        to: company.users[0].email,
        type: 'PAYMENT_CONFIRMED',
        data: {
          plan,
          dueDate: dueDate.toLocaleDateString('pt-BR'),
        },
      });
    }

    this.logger.log(`Subscription activated: company=${companyId} plan=${plan}`);
  }
}
