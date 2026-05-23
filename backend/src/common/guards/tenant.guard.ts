import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

import { PrismaService } from '@/database/prisma.service'

/**
 * Validates tenant (company) is active and the JWT's companyId is legitimate.
 * Use after JwtAuthGuard so req.user is already populated.
 *
 * Usage: @UseGuards(JwtAuthGuard, TenantGuard)
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest()
    const user = req.user

    if (!user?.companyId) {
      throw new UnauthorizedException('Token sem tenant associado')
    }

    const company = await this.prisma.company.findUnique({
      where: { id: user.companyId },
      select: { id: true, isBlocked: true, subscriptionStatus: true },
    })

    if (!company) {
      throw new ForbiddenException('Empresa não encontrada')
    }

    if (company.isBlocked) {
      throw new ForbiddenException('Empresa bloqueada — verifique sua assinatura')
    }

    req.tenantId = company.id

    return true
  }
}
