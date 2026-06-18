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
}
