import { Injectable, Logger } from '@nestjs/common';

// Cliente HTTP mínimo do provedor Focus NFe (https://focusnfe.com.br).
// O sistema NUNCA assume a responsabilidade fiscal: o payload (CFOP, ICMS,
// NCM, itens) é de responsabilidade do contratante/contador — este adapter
// apenas repassa a requisição usando a credencial (API Key) que o próprio
// cliente cadastrou (modelo BYOK).
@Injectable()
export class FocusNfeProvider {
  private readonly logger = new Logger(FocusNfeProvider.name);

  private baseUrl(environment: string): string {
    return environment === 'PRODUCAO'
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br';
  }

  // Basic Auth do Focus NFe: API Key como username, senha vazia.
  private authHeader(apiKey: string): string {
    return `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
  }

  async emitNfce(apiKey: string, environment: string, payload: Record<string, any>) {
    const url = `${this.baseUrl(environment)}/v2/nfce`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: this.authHeader(apiKey),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20_000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        this.logger.warn(`Focus NFe emit falhou (${res.status}): ${JSON.stringify(data)}`);
        return { ok: false, status: res.status, data };
      }
      return { ok: true, status: res.status, data };
    } catch (err: any) {
      this.logger.error(`Focus NFe emit erro de rede: ${err.message}`);
      return { ok: false, status: 0, data: { erro: err.message } };
    }
  }

  async consultNfce(apiKey: string, environment: string, ref: string) {
    const url = `${this.baseUrl(environment)}/v2/nfce/${ref}`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: this.authHeader(apiKey) },
        signal: AbortSignal.timeout(15_000),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch (err: any) {
      return { ok: false, status: 0, data: { erro: err.message } };
    }
  }
}
