import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { isDemoWriteAllowed } from '@/common/utils/demo-write-policy';

/**
 * Guard global para usuários com role DEMO.
 * — GET: permitido (leitura).
 * — POST / PATCH / PUT / DELETE: bloqueado, EXCETO o ciclo de venda
 *   (Caixa/Pedidos/Mesas) — ver `isDemoWriteAllowed` pro racional completo.
 *
 * Decodifica o JWT sem verificar a assinatura (Base64 decode do payload).
 * A verificação de assinatura continua sendo responsabilidade do JwtAuthGuard.
 * Não necessita injeção de JwtService — zero dependências externas.
 */
@Injectable()
export class DemoGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<any>();

    // Auth endpoints are always public — never block unauthenticated login/signup/register/demo-access.
    // demo-access is POST and is how a visitor switches from one demo (DEMO role,
    // write-blocked by this same guard) into another — without this bypass, a
    // leftover DEMO token in localStorage gets attached to the next demo-access
    // call and this guard blocks it, breaking "test Basic then test Delivery".
    const url: string = req.url ?? '';
    if (/\/auth\/(login|signup|register|demo-access)/.test(url)) return true;

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

    if (!isDemoWriteAllowed(req.method, url)) {
      throw new ForbiddenException(
        'Conta de demonstração — esta ação não está disponível no modo de teste. O fluxo de venda (caixa/pedidos/mesas) funciona normalmente.',
      );
    }

    return true;
  }
}
