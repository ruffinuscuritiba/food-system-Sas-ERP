import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/database/prisma.service';

/**
 * Guard das rotas chamadas pelo Printer Agent (.exe). Aceita DOIS tipos de
 * credencial no mesmo header Authorization: Bearer <token>:
 *
 *   1. Company.printerAgentToken — o token real que o agente usa no dia a
 *      dia, gerado uma vez e sem expiração (ver getOrCreateAgentToken).
 *   2. JWT normal de sessão de usuário — mantido como fallback só pra
 *      permitir testar as rotas manualmente pelo painel/Postman.
 *
 * Antes disso o "token de ativação" mostrado na tela de Impressão ERA o
 * JWT de sessão (expira em 7 dias, signOptions no AuthModule) — um agente
 * instalado corretamente parava de autenticar sozinho depois de uma
 * semana, sem nenhum erro visível (o agente engole falha de heartbeat
 * silenciosamente).
 */
@Injectable()
export class PrinterAgentGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers?.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;

    if (!token) {
      throw new UnauthorizedException('Token ausente');
    }

    const company = await this.prisma.company.findUnique({
      where: { printerAgentToken: token },
      select: { id: true },
    });
    if (company) {
      req.user = {
        userId: null,
        email: null,
        companyId: company.id,
        role: 'ADMIN',
      };
      return true;
    }

    try {
      const payload = this.jwtService.verify(token);
      if (!payload?.companyId) throw new Error('token sem companyId');
      req.user = {
        userId: payload.sub ?? null,
        email: payload.email ?? null,
        companyId: payload.companyId,
        role: payload.role,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido');
    }
  }
}
