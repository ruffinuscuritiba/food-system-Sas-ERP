import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { SuperAdminService } from './super-admin.service';
import { DemoVitrineService } from './demo-vitrine.service';

const DEMO_EMAILS = [
  'demo-basic@foodsaas.demo',
  'demo-pro@foodsaas.demo',
  'demo-enterprise@foodsaas.demo',
  'demo-delivery@foodsaas.demo',
];

/**
 * Ensures the 3 demo accounts (basic / pro / enterprise) always exist after
 * every deploy. Runs once at startup — silently skipped if all accounts are
 * already present, so it has zero cost on normal restarts.
 *
 * Flow:
 *  1. Wait for Prisma to finish connecting (handles DB retries on cold start).
 *  2. Count demo users.
 *  3. If any are missing: init companies + populate vitrine data.
 *  4. Never throws — a bootstrap failure is logged but must not crash the app.
 */
@Injectable()
export class DemoBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DemoBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly superAdmin: SuperAdminService,
    private readonly vitrine: DemoVitrineService,
  ) {}

  onApplicationBootstrap(): void {
    this.ensureDemoAccounts().catch((err) =>
      this.logger.error('Demo bootstrap failed', err?.message ?? String(err)),
    );
  }

  private async ensureDemoAccounts(): Promise<void> {
    await this.prisma.readyPromise;

    const count = await this.prisma.user.count({
      where: { email: { in: DEMO_EMAILS } },
    });

    if (count >= 4) {
      this.logger.debug('Demo accounts present — running idempotent patches.');
      await this.vitrine.patchDemoCategoryNames();
      await this.vitrine.patchDemoThemesAndModules();
      return;
    }

    this.logger.log(
      `Demo accounts missing (${count}/4) — bootstrapping demo companies…`,
    );
    await this.superAdmin.initDemoCompanies();
    await this.vitrine.populateAll();
    this.logger.log('Demo bootstrap complete.');
  }
}
