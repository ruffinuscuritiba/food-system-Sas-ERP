import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { isMatrixCompany } from '@/common/utils/matrix';

const MIGRATION_KEY = 'trial-model-v2-2026-08-21';
const FULL_TRIAL_DAYS = 10;
const BASIC_MODULE_SLUGS = ['tables', 'cash', 'financial', 'stock', 'recipes', 'pdv'] as const;

/**
 * Roda uma única vez (marcador em SystemMigrationFlag) pra migrar empresas
 * que já estavam em trial ANTES da reforma do modelo de 10 dias:
 *   - Estende `dueDate` para `createdAt + 10 dias` — nunca encurta quem já
 *     tinha uma data maior (ex.: alguém que ganhou prorrogação manual).
 *   - Corrige/backfilla os CompanyModule do Básico (bug antigo do signup
 *     deixava `moduleSlug` vazio e `status` em INACTIVE — o guard nunca
 *     reconhecia essas linhas por moduleSlug, só pelo fallback pro campo
 *     legado `module`).
 *   - Libera "delivery" (único módulo com bloqueio real hoje) em TRIAL até
 *     a mesma data — hoje nenhum signup antigo tinha esse módulo.
 * Nunca toca empresa que já pagou (`wasEverActive`) ou já bloqueada — essas
 * já passaram pelo funil antigo e não fazem parte da reforma.
 */
@Injectable()
export class TrialMigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TrialMigrationService.name);

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap(): void {
    setImmediate(() => {
      this.run().catch((err) =>
        this.logger.warn(`[TrialMigration] bootstrap falhou: ${(err as Error)?.message}`),
      );
    });
  }

  private async run(): Promise<void> {
    await this.prisma.readyPromise;

    const already = await this.prisma.systemMigrationFlag.findUnique({
      where: { key: MIGRATION_KEY },
    });
    if (already) return;

    const candidates = await this.prisma.company.findMany({
      where: {
        wasEverActive: false,
        subscriptionStatus: 'PENDING_PAYMENT',
        isBlocked: false,
      },
      select: { id: true, createdAt: true, dueDate: true },
    });

    let migrated = 0;

    for (const company of candidates) {
      if (isMatrixCompany(company.id)) continue;

      const minDue = new Date(company.createdAt);
      minDue.setDate(minDue.getDate() + FULL_TRIAL_DAYS);
      const currentDue = company.dueDate ? new Date(company.dueDate) : null;
      const newDue = !currentDue || minDue > currentDue ? minDue : currentDue;

      try {
        await this.prisma.$transaction([
          this.prisma.company.update({
            where: { id: company.id },
            data: { dueDate: newDue },
          }),
          ...BASIC_MODULE_SLUGS.map((slug) =>
            this.prisma.companyModule.upsert({
              where: { id: `cm-${slug}-${company.id}` },
              update: {},
              create: {
                id: `cm-${slug}-${company.id}`,
                module: slug.toUpperCase(),
                moduleSlug: slug,
                status: 'ACTIVE',
                active: true,
                activatedAt: new Date(),
                companyId: company.id,
              },
            }),
          ),
          this.prisma.companyModule.upsert({
            where: { id: `cm-delivery-${company.id}` },
            update: {},
            create: {
              id: `cm-delivery-${company.id}`,
              module: 'DELIVERY',
              moduleSlug: 'delivery',
              status: 'TRIAL',
              active: false,
              trialEndsAt: newDue,
              companyId: company.id,
            },
          }),
        ]);
        migrated++;
      } catch (err) {
        this.logger.error(
          `[TrialMigration] falha ao migrar empresa ${company.id}: ${(err as Error)?.message}`,
        );
      }
    }

    await this.prisma.systemMigrationFlag.create({
      data: {
        key: MIGRATION_KEY,
        details: `${migrated}/${candidates.length} empresas migradas para o trial de ${FULL_TRIAL_DAYS} dias`,
      },
    });

    this.logger.log(
      `[TrialMigration] concluído — ${migrated}/${candidates.length} empresas migradas`,
    );
  }
}
