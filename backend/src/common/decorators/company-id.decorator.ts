import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

/**
 * Extrai companyId do JWT de forma segura e tipada.
 *
 * GARANTIA DE SEGURANÇA: o valor vem exclusivamente do token JWT assinado com
 * JWT_SECRET, decodificado pelo JwtAuthGuard/JwtStrategy. Nenhum valor enviado
 * pelo cliente no body, query string ou header é aceito.
 *
 * Pré-requisito: @UseGuards(JwtAuthGuard) deve anteceder o endpoint.
 *
 * Uso:
 *   @Get()
 *   @UseGuards(JwtAuthGuard, TenantGuard)
 *   findAll(@CompanyId() companyId: string) { ... }
 */
export const CompanyId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req       = ctx.switchToHttp().getRequest();
    const companyId = req.user?.companyId as string | undefined;

    if (!companyId) {
      throw new UnauthorizedException(
        'Contexto de tenant ausente — JwtAuthGuard não aplicado ou token inválido.',
      );
    }

    return companyId;
  },
);
