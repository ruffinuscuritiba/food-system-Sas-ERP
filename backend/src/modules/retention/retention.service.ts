import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/database/prisma.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { LeadsService } from '@/modules/leads/leads.service';
import { SuperAdminService } from '@/modules/super-admin/super-admin.service';
import { isMatrixCompany } from '@/common/utils/matrix';

// Demo company identifiers — never delete these
const DEMO_EMAILS = [
  'demo-basic@foodsaas.demo',
  'demo-pro@foodsaas.demo',
  'demo-enterprise@foodsaas.demo',
];

// Days past dueDate on which we send renewal reminders to ex-clients
const REMINDER_DAYS = [5, 15, 30];

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly leads: LeadsService,
    private readonly superAdminService: SuperAdminService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Runs every day at 03:00 (server time).
   * 1. Deletes demo/trial companies older than 31 days that never converted.
   * 2. Sends renewal reminder emails to ex-paying customers at day 5 / 15 / 30.
   * 3. Sends WA retention messages at trial -3 days and -1 day.
   */
  @Cron('0 3 * * *')
  async runDailyRetention() {
    this.logger.log('[Retention] Daily run started');
    try {
      await this.cleanupExpiredTrials();
    } catch (err) {
      this.logger.error(`[Retention] cleanupExpiredTrials failed: ${(err as Error)?.message}`);
    }
    try {
      await this.sendRenewalReminders();
    } catch (err) {
      this.logger.error(`[Retention] sendRenewalReminders failed: ${(err as Error)?.message}`);
    }
    try {
      await this.sendTrialWarnings();
    } catch (err) {
      this.logger.error(`[Retention] sendTrialWarnings failed: ${(err as Error)?.message}`);
    }
    this.logger.log('[Retention] Daily run complete');
  }

  // ── Manual trigger for testing ──────────────────────────────────────────────

  async runNow() {
    await this.runDailyRetention();
    return { ok: true };
  }

  // ── 1. Cleanup: delete demo/trial companies that never paid ─────────────────

  private async cleanupExpiredTrials() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 31); // 31 days ago

    const candidates = await this.prisma.company.findMany({
      where: {
        wasEverActive: false,         // never paid — true ex-clients are excluded
        createdAt: { lt: cutoff },    // older than 31 days
        subscriptionStatus: { not: 'ACTIVE' },
      },
      include: {
        users: { where: { role: 'ADMIN' }, take: 1 },
      },
    });

    let deleted = 0;

    for (const company of candidates) {
      // Never delete the 3 permanent demo accounts or the matrix company
      const adminEmail = company.users[0]?.email ?? '';
      if (
        DEMO_EMAILS.includes(adminEmail) ||
        isMatrixCompany(company.id)
      ) continue;

      // Attempt to save a lead record before deleting
      try {
        await this.leads.upsert({
          sessionToken: `retention-cleanup-${company.id}`,
          name: company.users[0]?.name || company.name,
          company: company.name,
          whatsapp: undefined,
          recommendedPlan: company.plan?.toUpperCase(),
        });
      } catch (e) {
        this.logger.warn(`[Retention] Lead upsert failed for ${company.id}: ${(e as Error)?.message}`);
      }

      // Delete company (SuperAdminService.deleteCompany handles cascade)
      try {
        await this.superAdminService.deleteCompany(company.id);
        deleted++;
        this.logger.log(`[Retention] Deleted expired trial company: ${company.name} (${company.id})`);
      } catch (e) {
        this.logger.error(`[Retention] Delete failed for ${company.id}: ${(e as Error)?.message}`);
      }
    }

    this.logger.log(`[Retention] Cleanup complete — ${deleted} companies deleted`);
  }

  // ── 2. Reminders: send re-engagement emails to ex-paying customers ──────────

  private async sendRenewalReminders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const exClients = await this.prisma.company.findMany({
      where: {
        wasEverActive: true,
        subscriptionStatus: { not: 'ACTIVE' },
        dueDate: { not: null },
        isBlocked: false,
      },
      include: {
        users: { where: { role: 'ADMIN' }, take: 1 },
      },
    });

    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ||
      'https://food-system-sas-erp-frontend.vercel.app';

    let sent = 0;

    for (const company of exClients) {
      if (!company.dueDate) continue;
      if (isMatrixCompany(company.id)) continue;

      const expiredAt = new Date(company.dueDate);
      expiredAt.setHours(0, 0, 0, 0);

      const daysPastDue = Math.round(
        (today.getTime() - expiredAt.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (!REMINDER_DAYS.includes(daysPastDue)) continue;

      const adminEmail = company.users[0]?.email;
      if (!adminEmail) continue;

      try {
        await this.notifications.send({
          to: adminEmail,
          type: 'SUBSCRIPTION_REMINDER',
          data: {
            companyName: company.name,
            daysPastDue,
            renewUrl: `${frontendUrl}/assinatura`,
          },
        });
        sent++;
        this.logger.log(
          `[Retention] Reminder sent to ${adminEmail} (${company.name}) — day ${daysPastDue}`,
        );
      } catch (e) {
        this.logger.error(
          `[Retention] Reminder failed for ${adminEmail}: ${(e as Error)?.message}`,
        );
      }
    }

    this.logger.log(`[Retention] Reminders complete — ${sent} emails sent`);
  }

  // ── 3. Trial warnings: WA messages at -3 and -1 days before trial expires ───

  private async sendEvolutionWA(phone: string, text: string): Promise<void> {
    const apiUrl   = this.config.get<string>('EVOLUTION_API_URL');
    const apiKey   = this.config.get<string>('EVOLUTION_API_KEY');
    const instance = this.config.get<string>('EVOLUTION_INSTANCE_NAME');
    if (!apiUrl || !apiKey || !instance || !phone) return;
    await fetch(`${apiUrl}/message/sendText/${instance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ number: phone, text }),
      signal: AbortSignal.timeout(10_000),
    });
  }

  private async sendTrialWarnings() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ||
      'https://food-system-sas-erp-frontend.vercel.app';

    // Support contact shown in the message
    const supportWA =
      this.config.get<string>('SUPPORT_WHATSAPP') || '5567991753455';

    const trialCompanies = await this.prisma.company.findMany({
      where: {
        wasEverActive: false,
        subscriptionStatus: 'PENDING_PAYMENT',
        dueDate: { not: null },
        isBlocked: false,
        // Sem filtro de whatsapp: lojas sem WA recebem o aviso por e-mail.
      },
      include: {
        users: { where: { role: 'ADMIN' }, take: 1 },
      },
    });

    let sentWa = 0;
    let sentEmail = 0;

    for (const company of trialCompanies) {
      if (!company.dueDate) continue;
      if (isMatrixCompany(company.id)) continue;

      const adminEmail = company.users[0]?.email ?? '';
      if (DEMO_EMAILS.includes(adminEmail)) continue;

      const dueDate = new Date(company.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      const daysLeft = Math.round(
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      let msg: string | null = null;

      if (daysLeft === 3) {
        msg =
          `Olá, *${company.users[0]?.name ?? company.name}*! 👋\n\n` +
          `Seu teste grátis do *FoodSaaS* termina em *3 dias* (${dueDate.toLocaleDateString('pt-BR')}).\n\n` +
          `Durante o teste você experimentou:\n` +
          `✅ PDV com carrinho e pagamentos\n` +
          `✅ Cardápio digital para seus clientes\n` +
          `✅ Gestão de cozinha em tempo real\n` +
          `✅ Controle de estoque e financeiro\n\n` +
          `Não perca o acesso! Garanta seu plano agora com *a partir de R$ 97/mês*:\n` +
          `👉 ${frontendUrl}/assinatura\n\n` +
          `Ficou com alguma dúvida? Fale com a gente:\n` +
          `📱 wa.me/${supportWA}`;
      } else if (daysLeft === 1) {
        msg =
          `⏰ *Último dia de teste, ${company.users[0]?.name ?? company.name}!*\n\n` +
          `Seu acesso ao *FoodSaaS* expira *amanhã*.\n\n` +
          `Mais de 100 estabelecimentos já usam nosso sistema para vender mais e perder menos tempo. Não fique de fora! 🚀\n\n` +
          `Assine agora e continue sem interrupção:\n` +
          `👉 ${frontendUrl}/assinatura\n\n` +
          `Precisa de ajuda para escolher o plano certo? Manda mensagem:\n` +
          `📱 wa.me/${supportWA}\n\n` +
          `_Responda aqui se tiver alguma dúvida — teremos prazer em ajudar!_ 😊`;
      }

      if (!msg) continue;

      const ownerName = company.users[0]?.name ?? company.name;

      // Canal primário: WhatsApp (se a loja informou um número no cadastro).
      if (company.whatsapp) {
        try {
          // Remove non-digit chars to normalize the phone number
          const phone = company.whatsapp.replace(/\D/g, '');
          await this.sendEvolutionWA(phone, msg);
          sentWa++;
          this.logger.log(
            `[Retention] Trial warning (day -${daysLeft}) sent via WA to ${company.name} (${phone})`,
          );
          continue;
        } catch (e) {
          this.logger.error(
            `[Retention] Trial WA failed for ${company.name}, caindo para e-mail: ${(e as Error)?.message}`,
          );
          // Não dá continue — segue para o backup por e-mail.
        }
      }

      // Backup (ou canal único quando não há WhatsApp): e-mail para o admin.
      if (!adminEmail) {
        this.logger.warn(
          `[Retention] Trial company ${company.name} sem WhatsApp e sem e-mail de admin — aviso (day -${daysLeft}) não enviado`,
        );
        continue;
      }

      try {
        await this.notifications.send({
          to: adminEmail,
          type: 'TRIAL_WARNING',
          data: {
            name: ownerName,
            daysLeft,
            renewUrl: `${frontendUrl}/assinatura`,
            supportWA,
          },
        });
        sentEmail++;
        this.logger.log(
          `[Retention] Trial warning (day -${daysLeft}) sent via e-mail to ${adminEmail} (${company.name})`,
        );
      } catch (e) {
        this.logger.error(
          `[Retention] Trial e-mail failed for ${adminEmail}: ${(e as Error)?.message}`,
        );
      }
    }

    this.logger.log(
      `[Retention] Trial warnings complete — ${sentWa} via WhatsApp, ${sentEmail} via e-mail`,
    );
  }
}
