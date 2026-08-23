import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '@/common/decorators/roles.decorator';
import { isDemoWriteAllowed } from '@/common/utils/demo-write-policy';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    const user = request.user;

    if (!user) {
      return false;
    }

    // Role DEMO: GET sempre passa; escrita só no ciclo de venda (Caixa/
    // Pedidos/Mesas — `isDemoWriteAllowed`), ignorando a lista concreta de
    // `@Roles` do endpoint (ex.: DEMO nunca é literalmente CASHIER/WAITER,
    // mas pode agir como um pra essas rotas específicas — é exatamente o
    // que "a demo é a própria loja" pede). DemoGuard global já filtra a
    // mesma política antes; mantido aqui como defesa em profundidade
    // (dois layers independentes usando a MESMA fonte de verdade).
    if (user.role === 'DEMO') {
      return isDemoWriteAllowed(request.method, request.url);
    }

    // SYSTEM_SUPER_ADMIN bypassa qualquer restrição de role
    if (user.role === 'SYSTEM_SUPER_ADMIN') return true;

    return requiredRoles.includes(user.role);
  }
}
