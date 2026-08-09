import { Injectable } from '@nestjs/common';

/**
 * Cache em memória do processo pro cardápio público
 * (GET /products/public/menu/:companyId) — a query mais repetida do
 * sistema, refeita do zero a cada carregamento do cardápio digital, mesmo
 * sem nenhuma mudança de cardápio entre uma visita e outra.
 *
 * Redis NÃO traz benefício real aqui: o backend roda como UM único
 * container (docker-compose.yml do VPS, sem replicas/load balancer —
 * ver item 143/104 do CLAUDE.md). Redis só compensa quando existem VÁRIAS
 * instâncias do backend precisando compartilhar o mesmo cache — não é o
 * caso desta arquitetura. Cache em memória do próprio processo Node dá o
 * mesmo ganho de performance sem container novo, sem dependência de rede
 * extra, sem custo de hospedagem adicional (ver conversa: usuário
 * perguntou explicitamente sobre consumo de hospedagem).
 *
 * TTL curto (30s) como rede de segurança pra qualquer edição de cardápio
 * sem invalidação explícita cobrindo o caminho (ex: mudança de categoria)
 * — o caminho mais comum de edição (Product) invalida na hora via
 * `invalidate()`, chamado pelos services de escrita.
 */
@Injectable()
export class MenuCacheService {
  private readonly ttlMs = 30_000;
  private readonly store = new Map<string, { data: unknown; expiresAt: number }>();

  get<T = unknown>(companyId: string): T | undefined {
    const entry = this.store.get(companyId);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(companyId);
      return undefined;
    }
    return entry.data as T;
  }

  set(companyId: string, data: unknown): void {
    this.store.set(companyId, { data, expiresAt: Date.now() + this.ttlMs });
  }

  invalidate(companyId: string): void {
    this.store.delete(companyId);
  }
}
