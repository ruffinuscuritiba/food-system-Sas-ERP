import { Reflector } from '@nestjs/core';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class ModuleGuard
  implements CanActivate {

constructor(
  private prisma: PrismaService,

  private reflector: Reflector,
) {}

  async canActivate(
    context: ExecutionContext,
  ) {

    const request =
      context.switchToHttp().getRequest();

    const companyId =
      request.user.companyId;

    const requiredModule =
      this.reflector.getAllAndOverride<string>('requiredModule', [
        context.getHandler(),
        context.getClass(),
      ]);

    if (!requiredModule) return true;

    const module =
      await this.prisma.companyModule.findFirst({
        where: {
          companyId,

          module: requiredModule,

          active: true,
        },
      });

    if (!module) {

      throw new ForbiddenException(
        'Módulo não contratado',
      );
    }

    return true;
  }
}