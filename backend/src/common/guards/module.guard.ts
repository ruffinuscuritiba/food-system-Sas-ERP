import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@/database/prisma.service';
import { REQUIRED_MODULE_KEY } from '@/common/decorators/required-module.decorator';
import { isMatrixCompany } from '@/common/utils/matrix';

/**
 * Blocks access to routes decorated with @RequiredModule('slug') when the
 * requesting company does not have that module ACTIVE or in valid TRIAL.
 *
 * Matrix company (R_FoodSaaS) bypasses all module checks — all features
 * are permanently active in that environment.
 *
 * Usage order: @UseGuards(JwtAuthGuard, TenantGuard, ModuleGuard)
 */
@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const slug = this.reflector.getAllAndOverride<string>(REQUIRED_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!slug) return true;

    const req = context.switchToHttp().getRequest();
    const companyId: string | undefined = req.user?.companyId;

    if (!companyId) return false;

    // Matrix company — tudo liberado
    if (isMatrixCompany(companyId)) return true;

    const cm = await this.prisma.companyModule.findFirst({
      where: {
        companyId,
        moduleSlug: slug,
        status: { in: ['ACTIVE', 'TRIAL'] },
      },
      select: { id: true, status: true, trialEndsAt: true },
    });

    if (!cm) {
      throw new ForbiddenException(
        `Módulo "${slug}" não está ativo para esta empresa`,
      );
    }

    if (
      cm.status === 'TRIAL' &&
      cm.trialEndsAt &&
      new Date() > cm.trialEndsAt
    ) {
      throw new ForbiddenException(
        `Período de teste do módulo "${slug}" expirou`,
      );
    }

    return true;
  }
}
