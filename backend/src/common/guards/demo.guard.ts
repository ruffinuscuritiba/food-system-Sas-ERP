import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/**
 * Guard global para usuários com role DEMO.
 * — GET: permitido (leitura).
 * — POST / PATCH / PUT / DELETE: bloqueado (escrita).
 *
 * Decodifica o JWT sem verificar a assinatura (Base64 decode do payload).
 * A verificação de assinatura continua sendo responsabilidade do JwtAuthGuard.
 * Não necessita injeção de JwtService — zero dependências externas.
 */
@Injectable()
export class DemoGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<any>();

    // Auth endpoints are always public — never block unauthenticated login/signup/register
    const url: string = req.url ?? '';
    if (/\/auth\/(login|signup|register)/.test(url)) return true;

    const auth: string = req.headers?.['authorization'] ?? '';
    if (!auth.startsWith('Bearer ')) return true;

    const token = auth.slice(7);

    // Decode only — parte do payload é Base64URL no índice 1
    let role: string | undefined;
    try {
      const parts = token.split('.');
      if (parts.length < 2) return true;
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8'),
      );
      role = payload?.role;
    } catch {
      return true; // Token inválido: JwtAuthGuard rejeitará
    }

    if (role !== 'DEMO') return true;

    const method: string = (req.method ?? 'GET').toUpperCase();
    if (method !== 'GET') {
      throw new ForbiddenException(
        'Conta de demonstração — somente leitura. Operações de escrita não são permitidas.',
      );
    }

    return true;
  }
}
