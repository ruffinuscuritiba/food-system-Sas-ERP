import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type NotificationType =
  | 'WELCOME'
  | 'NEW_ORDER'
  | 'ORDER_STATUS'
  | 'SUBSCRIPTION_EXPIRING'
  | 'SUBSCRIPTION_BLOCKED'
  | 'PAYMENT_CONFIRMED';

export interface NotificationPayload {
  to: string;
  type: NotificationType;
  data?: Record<string, any>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly config: ConfigService) {}

  async send(payload: NotificationPayload): Promise<void> {
    const { to, type, data } = payload;
    const subject = this.getSubject(type, data);
    const body = this.getBody(type, data);

    const smtpHost = this.config.get<string>('SMTP_HOST');
    const smtpUser = this.config.get<string>('SMTP_USER');
    const smtpPass = this.config.get<string>('SMTP_PASS');
    const fromEmail =
      this.config.get<string>('SMTP_FROM') || 'noreply@foodsaas.com.br';

    if (!smtpHost || !smtpUser || !smtpPass) {
      // Log instead of fail — SMTP not configured yet
      this.logger.warn(
        `[EMAIL NOT SENT — SMTP not configured] To: ${to} | Subject: ${subject}`,
      );
      this.logger.debug(`Body: ${body}`);
      return;
    }

    try {
      // Dynamic import to avoid hard dependency
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: smtpHost,
        port: Number(this.config.get('SMTP_PORT') || 587),
        secure: false,
        auth: { user: smtpUser, pass: smtpPass },
      });

      await transporter.sendMail({
        from: `"FoodSaaS" <${fromEmail}>`,
        to,
        subject,
        html: body,
      });

      this.logger.log(`Email sent to ${to} [${type}]`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}: ${err}`);
    }
  }

  private getSubject(
    type: NotificationType,
    data?: Record<string, any>,
  ): string {
    switch (type) {
      case 'WELCOME':
        return '🎉 Bem-vindo ao FoodSaaS!';
      case 'NEW_ORDER':
        return `🛒 Novo pedido recebido #${data?.orderId || ''}`;
      case 'ORDER_STATUS':
        return `📦 Pedido ${data?.orderId || ''} atualizado`;
      case 'SUBSCRIPTION_EXPIRING':
        return '⚠️ Sua assinatura vence em breve';
      case 'SUBSCRIPTION_BLOCKED':
        return '🔒 Acesso suspenso — regularize seu pagamento';
      case 'PAYMENT_CONFIRMED':
        return '✅ Pagamento confirmado!';
      default:
        return 'Notificação FoodSaaS';
    }
  }

  private getBody(type: NotificationType, data?: Record<string, any>): string {
    const base = (content: string) => `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#fff;padding:32px;border-radius:16px;">
        <h1 style="color:#ef4444;margin-bottom:8px;">🍽️ FoodSaaS</h1>
        ${content}
        <hr style="border-color:#334155;margin:24px 0"/>
        <p style="color:#64748b;font-size:12px;">FoodSaaS — Sistema ERP para Alimentação</p>
      </div>
    `;

    switch (type) {
      case 'WELCOME':
        return base(`
          <h2>Bem-vindo, ${data?.name || 'cliente'}!</h2>
          <p>Sua conta foi criada com sucesso. Você tem <strong>7 dias de trial gratuito</strong>.</p>
          <p>Acesse o painel: <a href="${data?.loginUrl || '#'}" style="color:#ef4444;">Entrar agora</a></p>
        `);
      case 'NEW_ORDER':
        return base(`
          <h2>Novo pedido recebido!</h2>
          <p><strong>Pedido:</strong> #${data?.orderId}</p>
          <p><strong>Cliente:</strong> ${data?.customerName || '—'}</p>
          <p><strong>Total:</strong> R$ ${data?.total || '0.00'}</p>
          <p><strong>Tipo:</strong> ${data?.orderType === 'DELIVERY' ? 'Delivery' : 'Retirada'}</p>
        `);
      case 'ORDER_STATUS':
        return base(`
          <h2>Atualização do seu pedido</h2>
          <p>Seu pedido <strong>#${data?.orderId}</strong> foi atualizado para: <strong>${data?.status}</strong></p>
        `);
      case 'SUBSCRIPTION_EXPIRING':
        return base(`
          <h2>Sua assinatura vence em ${data?.days || 3} dias</h2>
          <p>Renove agora para não perder acesso ao sistema.</p>
          <p><a href="${data?.renewUrl || '#'}" style="color:#ef4444;">Renovar assinatura</a></p>
        `);
      case 'SUBSCRIPTION_BLOCKED':
        return base(`
          <h2>Acesso suspenso</h2>
          <p>Sua assinatura expirou. Regularize o pagamento para retomar o acesso.</p>
          <p><a href="${data?.payUrl || '#'}" style="color:#ef4444;">Regularizar agora</a></p>
        `);
      case 'PAYMENT_CONFIRMED':
        return base(`
          <h2>Pagamento confirmado!</h2>
          <p>Seu plano <strong>${data?.plan || ''}</strong> está ativo até <strong>${data?.dueDate || ''}</strong>.</p>
        `);
      default:
        return base(`<p>${data?.message || 'Notificação do sistema.'}</p>`);
    }
  }
}
