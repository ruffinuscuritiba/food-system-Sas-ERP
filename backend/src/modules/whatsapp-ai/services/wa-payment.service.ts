import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const PIX_EXPIRATION_MINUTES = 30;

export interface WaPixResult {
  pixCopyPaste: string;
  pixQrcode: string | null;
  expiresAt: Date;
  mpPaymentId: string;
  mock: boolean;
}

export interface WaLinkResult {
  paymentUrl: string;
  preferenceId: string;
  mock: boolean;
}

@Injectable()
export class WaPaymentService {
  private readonly log = new Logger(WaPaymentService.name);

  constructor(private readonly config: ConfigService) {}

  private get accessToken(): string | undefined {
    return this.config.get<string>('MERCADOPAGO_ACCESS_TOKEN');
  }

  private get backendUrl(): string {
    const url = this.config.get<string>('BACKEND_URL') || 'http://localhost:3001';
    if (!url.startsWith('https://')) {
      this.log.warn('BACKEND_URL is not HTTPS — Mercado Pago webhooks will NOT be delivered in production. Set BACKEND_URL=https://... in Render env vars.');
    }
    return url;
  }

  /** Creates a PIX charge for a WhatsApp order. external_reference: "WA_ORDER|orderId|companyId" */
  async createPix(params: {
    orderId: string;
    companyId: string;
    total: number;
    customerPhone: string;
    customerName: string;
    description: string;
  }): Promise<WaPixResult> {
    if (!this.accessToken) {
      this.log.warn('MERCADOPAGO_ACCESS_TOKEN not set — returning mock PIX');
      const mockExpires = new Date(Date.now() + PIX_EXPIRATION_MINUTES * 60_000);
      return {
        pixCopyPaste: '00020101021226580014BR.GOV.BCB.PIX0136mock-wa-pix-key5204000053039865802BR5925FOODSAAS WA TEST6009SAO PAULO62140510wa123456306314D0',
        pixQrcode: null,
        expiresAt: mockExpires,
        mpPaymentId: `mock_wa_pix_${Date.now()}`,
        mock: true,
      };
    }

    const expiresAt   = new Date(Date.now() + PIX_EXPIRATION_MINUTES * 60_000);
    const expiresIso  = expiresAt.toISOString().replace('Z', '-03:00');
    const nameParts   = params.customerName.trim().split(' ');
    const payerEmail  = `${params.customerPhone.replace(/\D/g, '')}@pedido-wa.app`;

    const body = {
      transaction_amount: params.total,
      description:        params.description.slice(0, 100),
      payment_method_id:  'pix',
      date_of_expiration: expiresIso,
      notification_url:   `${this.backendUrl}/api/whatsapp-ai/webhook/mp-payment`,
      external_reference: `WA_ORDER|${params.orderId}|${params.companyId}`,
      payer: {
        email:      payerEmail,
        first_name: nameParts[0] || 'Cliente',
        last_name:  nameParts.slice(1).join(' ') || 'WA',
      },
    };

    const res = await fetch('https://api.mercadopago.com/v1/payments', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        Authorization:       `Bearer ${this.accessToken}`,
        'X-Idempotency-Key': `wa-pix-${params.orderId}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const err = await res.text();
      this.log.error(`MP PIX (WA) error: ${err}`);
      throw new Error('Erro ao gerar PIX via Mercado Pago.');
    }

    const mp: any   = await res.json();
    const txData    = mp.point_of_interaction?.transaction_data;
    const pixCopyPaste = txData?.qr_code        ?? '';
    const pixQrcode    = txData?.qr_code_base64  ?? null;

    this.log.log(`WA PIX created: mpId=${mp.id} order=${params.orderId}`);
    return { pixCopyPaste, pixQrcode, expiresAt, mpPaymentId: String(mp.id), mock: false };
  }

  /** Creates a checkout Preference (link de pagamento) for credit/debit card. */
  async createPaymentLink(params: {
    orderId: string;
    companyId: string;
    total: number;
    description: string;
    customerName: string;
  }): Promise<WaLinkResult> {
    if (!this.accessToken) {
      this.log.warn('MERCADOPAGO_ACCESS_TOKEN not set — returning mock link');
      return {
        paymentUrl: 'https://www.mercadopago.com.br/checkout/mock',
        preferenceId: `mock_wa_pref_${Date.now()}`,
        mock: true,
      };
    }

    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    const body = {
      items: [{
        title:      params.description.slice(0, 100),
        quantity:   1,
        unit_price: params.total,
        currency_id: 'BRL',
      }],
      back_urls: {
        success: `${frontendUrl}/pedido/confirmado?orderId=${params.orderId}`,
        failure: `${frontendUrl}/pedido/erro?orderId=${params.orderId}`,
        pending: `${frontendUrl}/pedido/pendente?orderId=${params.orderId}`,
      },
      auto_return: 'approved',
      notification_url:   `${this.backendUrl}/api/whatsapp-ai/webhook/mp-payment`,
      external_reference: `WA_ORDER|${params.orderId}|${params.companyId}`,
    };

    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const err = await res.text();
      this.log.error(`MP Preference (WA) error: ${err}`);
      throw new Error('Erro ao gerar link de pagamento via Mercado Pago.');
    }

    const data: any = await res.json();
    this.log.log(`WA Payment link created: prefId=${data.id} order=${params.orderId}`);
    return { paymentUrl: data.init_point, preferenceId: data.id, mock: false };
  }
}
