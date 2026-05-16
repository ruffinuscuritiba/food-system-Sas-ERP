import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class SubscriptionGuard
  implements CanActivate {

  constructor(
    private prisma: PrismaService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ) {

    const request =
      context.switchToHttp().getRequest();

    const company =
      await this.prisma.company.findUnique({
        where: {
          id: request.user.companyId,
        },
      });

    if (!company) {
      throw new ForbiddenException(
        'Empresa não encontrada',
      );
    }

    if (company.isBlocked) {
      throw new ForbiddenException(
        'Assinatura em atraso',
      );
    }

    return true;
  }
}