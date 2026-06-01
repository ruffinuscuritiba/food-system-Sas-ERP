import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from "@nestjs/common";

import { Reflector }
from "@nestjs/core";

import {
  ROLES_KEY,
} from "@/common/decorators/roles.decorator";

@Injectable()
export class RolesGuard
  implements CanActivate
{
  constructor(
    private reflector: Reflector,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean {

    const requiredRoles =
      this.reflector.getAllAndOverride<
        string[]
      >(
        ROLES_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      );

    if (!requiredRoles) {

      return true;
    }

    const request =
      context
        .switchToHttp()
        .getRequest();

    const user =
      request.user;

    if (!user) {

      return false;
    }

    // Role DEMO: somente leitura — GET/HEAD/OPTIONS passam, escrita é bloqueada.
    // DemoGuard global já bloqueia POST/PATCH/DELETE antes, mas mantemos aqui
    // como defesa em profundidade (dois layers independentes de proteção).
    if (user.role === 'DEMO') {
      const method: string = (request.method ?? 'GET').toUpperCase();
      return ['GET', 'HEAD', 'OPTIONS'].includes(method);
    }

    return requiredRoles.includes(
      user.role,
    );
  }
}