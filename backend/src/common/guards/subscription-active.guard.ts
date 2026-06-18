import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { isMatrixCompany } from '@/common/utils/matrix';

const AI_LOCKED_MSG =
  'Recurso de Inteligência Artificial disponível apenas nos planos ativos. Faça upgrade para continuar.';

/**
 * Blocks AI/ML endpoints for companies in trial (PENDING_PAYMENT) or suspended.
 * Only companies with subscriptionStatus === 'ACTIVE' may proceed.
 * Matrix company bypasses this guard entirely.
 *
 * Use after JwtAuthGuard: @UseGuards(JwtAuthGuard, SubscriptionActiveGuard)
 */
@Injectable()
export class SubscriptionActiveGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const companyId: string | undefined = req.user?.companyId;

    if (!companyId) return true; // let JwtAuthGuard handle missing auth

    if (isMatrixCompany(companyId)) return true; // matrix always unrestricted

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { subscriptionStatus: true },
    });

    if (company?.subscriptionStatus !== 'ACTIVE') {
      throw new ForbiddenException(AI_LOCKED_MSG);
    }

    return true;
  }
}
