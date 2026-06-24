import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type NotificationType =
  | 'WELCOME'
  | 'NEW_ORDER'
  | 'ORDER_STATUS'
  | 'SUBSCRIPTION_EXPIRING'
  | 'SUBSCRIPTION_BLOCKED'
  | 'SUBSCRIPTION_REMINDER'
  | 'TRIAL_WARNING'
  | 'PAYMENT_CONFIRMED'
  | 'DEMO_LEAD'
  | 'NEW_SIGNUP';

export interface NotificationPayload {
  to: string;
  type: NotificationType;
  data?: Record<string, any>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Indica se o canal de e-mail está configurado (SMTP_HOST/USER/PASS presentes).
   * Usado pelo /health para diagnóstico sem expor valores das credenciais.
   */
  isEmailConfigured(): boolean {
    return !!(
      this.config.get<string>('SMTP_HOST') &&
      this.config.get<string>('SMTP_USER') &&
      this.config.get<string>('SMTP_PASS')
    );
  }

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
      case 'SUBSCRIPTION_REMINDER':
        return `💛 Sentimos sua falta, ${data?.companyName || 'restaurante'} — renove sua assinatura`;
      case 'TRIAL_WARNING':
        return Number(data?.daysLeft) <= 1
          ? '⏰ Último dia do seu teste grátis no FoodSaaS'
          : `⏳ Seu teste grátis termina em ${data?.daysLeft} dias`;
      case 'DEMO_LEAD':
        return `🔥 Novo lead quente na demo — ${data?.restaurantName || data?.name || 'Visitante'}`;
      case 'NEW_SIGNUP':
        return `🚀 Novo cliente cadastrado — ${data?.companyName || 'Restaurante'}`;
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
          <h2>Bem-vindo ao FoodSaaS, ${data?.name || 'cliente'}! 🎉</h2>
          <p>Sua conta <strong>${data?.companyName || ''}</strong> foi criada com sucesso e seu <strong>trial de 7 dias gratuito</strong> já começou.</p>

          <p style="margin-top:22px;font-weight:700;color:#fff;font-size:15px;">Comece em 3 passos rápidos 👇</p>
          <table style="width:100%;border-collapse:collapse;margin:10px 0;">
            <tr>
              <td style="padding:10px 0;font-size:20px;width:40px;vertical-align:top;">1️⃣</td>
              <td style="padding:10px 0;">
                <strong style="color:#fff;">Cadastre seu cardápio</strong><br/>
                <span style="color:#94a3b8;font-size:13px;">Produtos, categorias e preços — ou use o <em>Cadastro Inteligente</em> com IA para subir tudo a partir de uma foto.</span>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 0;font-size:20px;vertical-align:top;">2️⃣</td>
              <td style="padding:10px 0;">
                <strong style="color:#fff;">Compartilhe seu cardápio digital</strong><br/>
                <span style="color:#94a3b8;font-size:13px;">Seus clientes pedem direto pelo celular, sem instalar app nenhum.</span>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 0;font-size:20px;vertical-align:top;">3️⃣</td>
              <td style="padding:10px 0;">
                <strong style="color:#fff;">Receba pedidos no PDV e na cozinha</strong><br/>
                <span style="color:#94a3b8;font-size:13px;">Tudo em tempo real, do balcão à entrega — sem papel e sem retrabalho.</span>
              </td>
            </tr>
          </table>

          <div style="text-align:center;margin:28px 0;">
            <a href="${data?.loginUrl || 'https://food-system-sas-erp-frontend.vercel.app/login'}"
               style="background:#ef4444;color:#fff;padding:14px 32px;border-radius:12px;font-weight:900;font-size:16px;text-decoration:none;display:inline-block;">
              Começar agora →
            </a>
          </div>
          <p style="color:#64748b;font-size:13px;">Precisa de ajuda para configurar? Fale com a gente pelo WhatsApp — estamos aqui para você vender mais. 🚀</p>
        `);
      case 'TRIAL_WARNING':
        return base(`
          <h2 style="color:#f59e0b;">${
            Number(data?.daysLeft) <= 1
              ? '⏰ Último dia do seu teste grátis!'
              : `Seu teste grátis termina em ${data?.daysLeft} dias`
          }</h2>
          <p>Olá, <strong>${data?.name || 'tudo bem'}</strong>! Seu acesso ao <strong>FoodSaaS</strong> ${
            Number(data?.daysLeft) <= 1
              ? 'expira <strong>amanhã</strong>'
              : `termina em <strong>${data?.daysLeft} dias</strong>`
          }.</p>
          <p style="margin-top:12px;">Durante o teste você teve acesso ao PDV, cardápio digital, cozinha em tempo real, controle de estoque e financeiro. Não perca tudo isso! 🚀</p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${data?.renewUrl || 'https://food-system-sas-erp-frontend.vercel.app/assinatura'}"
               style="background:#f97316;color:#fff;padding:14px 32px;border-radius:12px;font-weight:900;font-size:16px;text-decoration:none;display:inline-block;">
              Garantir meu plano →
            </a>
          </div>
          <p style="color:#64748b;font-size:13px;text-align:center;">
            A partir de <strong>R$ 97/mês</strong>. Dúvidas?${
              data?.supportWA
                ? ` Fale com a gente: <a href="https://wa.me/${String(data.supportWA).replace(/\D/g, '')}" style="color:#25D366;">WhatsApp</a>.`
                : ' Estamos no WhatsApp.'
            }
          </p>
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
      case 'SUBSCRIPTION_REMINDER':
        return base(`
          <h2 style="color:#f59e0b;">💛 Olá! Sentimos sua falta no ${data?.companyName || 'seu restaurante'}.</h2>
          <p>O seu painel do FoodSaaS continua ativo com todos os seus produtos e relatórios salvos com segurança.</p>
          <p style="margin-top:16px;">Deseja reativar sua assinatura hoje e voltar a gerenciar suas vendas?</p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${data?.renewUrl || '#'}"
               style="background:#f97316;color:#fff;padding:14px 32px;border-radius:12px;font-weight:900;font-size:16px;text-decoration:none;display:inline-block;">
              Reativar Assinatura Agora →
            </a>
          </div>
          <p style="color:#64748b;font-size:13px;text-align:center;">
            ${data?.daysPastDue ? `Sua assinatura expirou há ${data.daysPastDue} dias.` : ''}
            Seus dados estão seguros e esperando por você.
          </p>
        `);
      case 'DEMO_LEAD':
        return base(`
          <h2 style="color:#f97316;">🔥 Novo lead quente na demo!</h2>
          <p>Um interessado acabou de entrar na demonstração <strong>${data?.plan || ''}</strong>.</p>
          <table style="width:100%;border-collapse:collapse;margin-top:16px;">
            <tr><td style="padding:8px 0;color:#94a3b8;width:140px;">Nome</td><td style="padding:8px 0;font-weight:700;">${data?.name || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#94a3b8;">Restaurante</td><td style="padding:8px 0;font-weight:700;">${data?.restaurantName || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#94a3b8;">E-mail</td><td style="padding:8px 0;"><a href="mailto:${data?.email}" style="color:#f97316;">${data?.email || '—'}</a></td></tr>
            <tr><td style="padding:8px 0;color:#94a3b8;">WhatsApp</td><td style="padding:8px 0;"><a href="https://wa.me/${(data?.whatsapp || '').replace(/\D/g,'')}" style="color:#25D366;">${data?.whatsapp || '—'}</a></td></tr>
          </table>
          <p style="margin-top:20px;background:#1e293b;border-left:3px solid #f97316;padding:12px 16px;border-radius:4px;font-size:13px;">
            Entre em contato agora — este lead está quente e testando o sistema no momento!
          </p>
        `);
      case 'NEW_SIGNUP':
        return base(`
          <h2 style="color:#22c55e;">🚀 Novo cliente se cadastrou!</h2>
          <table style="width:100%;border-collapse:collapse;margin-top:16px;">
            <tr><td style="padding:8px 0;color:#94a3b8;width:140px;">Restaurante</td><td style="padding:8px 0;font-weight:700;">${data?.companyName || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#94a3b8;">Nome</td><td style="padding:8px 0;">${data?.adminName || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#94a3b8;">E-mail</td><td style="padding:8px 0;"><a href="mailto:${data?.email}" style="color:#ef4444;">${data?.email || '—'}</a></td></tr>
            <tr><td style="padding:8px 0;color:#94a3b8;">Segmento</td><td style="padding:8px 0;">${data?.segment || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#94a3b8;">Trial até</td><td style="padding:8px 0;">${data?.trialEnds || '—'}</td></tr>
          </table>
          <p style="margin-top:20px;background:#1e293b;border-left:3px solid #22c55e;padding:12px 16px;border-radius:4px;font-size:13px;">
            Entre em contato para ajudar na configuração e aumentar a conversão!
          </p>
        `);
      default:
        return base(`<p>${data?.message || 'Notificação do sistema.'}</p>`);
    }
  }
}
