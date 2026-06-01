import { Reflector } from '@nestjs/core';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';

/**
 * Módulos incluídos nativamente por plano (sem precisar de CompanyModule ativo).
 * Plano OU módulo avulso ativo → acesso liberado.
 */
const PLAN_INCLUDES: Record<string, string[]> = {
  BASIC:      ['TABLES', 'CASH', 'STOCK'],
  PRO:        ['TABLES', 'CASH', 'STOCK', 'FINANCIAL', 'RECIPES', 'DELIVERY'],
  ENTERPRISE: ['*'],  // tudo liberado
};

@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(
    private prisma:    PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const companyId = request.user?.companyId;
    if (!companyId) return false;

    const requiredModule = this.reflector.getAllAndOverride<string>(
      'requiredModule',
      [context.getHandler(), context.getClass()],
    );

    // Sem decorator @requiredModule → libera sempre
    if (!requiredModule) return true;

    const upper = requiredModule.toUpperCase();
    const lower = requiredModule.toLowerCase();

    // 1. Verificar plano da empresa
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { plan: true },
    });

    if (company) {
      const planSlug = (company.plan || 'BASIC').toUpperCase();
      const included = PLAN_INCLUDES[planSlug] ?? [];

      // ENTERPRISE libera tudo; outros planos têm lista fixa
      if (included.includes('*') || included.includes(upper)) {
        return true;
      }
    }

    // 2. Verificar módulo avulso — aceita tanto o campo legado quanto o slug novo
    const activeModule = await this.prisma.companyModule.findFirst({
      where: {
        companyId,
        OR: [
          // Legado: campo `module` uppercase + active:true
          { module: upper, active: true },
          // Novo: campo moduleSlug lowercase + status ACTIVE ou TRIAL
          { moduleSlug: lower, status: { in: ['ACTIVE', 'TRIAL'] } },
        ],
      },
    });

    if (activeModule) return true;

    throw new ForbiddenException(
      `Módulo "${requiredModule}" não está disponível no seu plano ou como módulo avulso.`,
    );
  }
}
