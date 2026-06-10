import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Manages Evolution API instance lifecycle on behalf of tenants.
 * Env vars required:
 *   EVOLUTION_API_URL  — e.g. https://evolution-api-kely.onrender.com
 *   EVOLUTION_API_KEY  — master API key (AUTHENTICATION_API_KEY in Evolution)
 */
@Injectable()
export class EvolutionProvisionService {
  private readonly log = new Logger(EvolutionProvisionService.name);

  constructor(private config: ConfigService) {}

  private get baseUrl(): string {
    return (this.config.get<string>('EVOLUTION_API_URL') ?? '').replace(/\/$/, '');
  }

  private get masterKey(): string {
    return this.config.get<string>('EVOLUTION_API_KEY') ?? '';
  }

  get isConfigured(): boolean {
    return !!this.baseUrl && !!this.masterKey;
  }

  private async request(method: string, path: string, body?: unknown) {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          apikey: this.masterKey,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(45_000),
      });
    } catch (err: any) {
      this.log.error(`Evolution ${method} ${path} → connection error: ${err?.message ?? err}`);
      throw new Error(`Não foi possível conectar à Evolution API (${err?.message ?? 'timeout'}). Verifique se o serviço está online.`);
    }
    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) {
      this.log.warn(`Evolution ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
    }
    return { ok: res.ok, status: res.status, data };
  }

  /** Creates an Evolution API instance. Returns { instanceName, qrCode? } */
  async createInstance(instanceName: string): Promise<{ instanceName: string; qrCode: string | null }> {
    const { ok, data } = await this.request('POST', '/instance/create', {
      instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    });

    if (!ok) throw new Error(`Failed to create Evolution instance: ${JSON.stringify(data)}`);

    const d = data as any;
    const qrCode: string | null =
      d?.qrcode?.base64 ??
      d?.hash?.qrcode ??
      d?.base64 ??
      null;

    return { instanceName, qrCode };
  }

  /** Returns base64 QR code string, or null if already connected. */
  async getQrCode(instanceName: string): Promise<string | null> {
    const { ok, data } = await this.request('GET', `/instance/connect/${instanceName}`);
    if (!ok) return null;
    const d = data as any;
    return d?.base64 ?? d?.qrcode?.base64 ?? null;
  }

  /** Returns 'open' | 'connecting' | 'close' */
  async getState(instanceName: string): Promise<'open' | 'connecting' | 'close'> {
    const { ok, data } = await this.request('GET', `/instance/connectionState/${instanceName}`);
    if (!ok) return 'close';
    const state = (data as any)?.instance?.state ?? (data as any)?.state ?? 'close';
    if (state === 'open') return 'open';
    if (state === 'connecting') return 'connecting';
    return 'close';
  }

  /** Registers a webhook URL on the instance. */
  async setWebhook(instanceName: string, webhookUrl: string): Promise<void> {
    await this.request('POST', `/webhook/set/${instanceName}`, {
      url: webhookUrl,
      webhook_by_events: false,
      webhook_base64: false,
      events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
    });
  }

  /** Fetches the instance phone number after QR scan. */
  async getPhoneNumber(instanceName: string): Promise<string | null> {
    const { ok, data } = await this.request('GET', `/instance/fetchInstances`);
    if (!ok) return null;
    const arr = Array.isArray(data) ? data : (data as any)?.instances ?? [];
    const inst = arr.find((i: any) => i.name === instanceName || i.instance?.instanceName === instanceName);
    return inst?.instance?.owner ?? inst?.owner ?? null;
  }

  /** Deletes an instance from Evolution API. */
  async deleteInstance(instanceName: string): Promise<void> {
    await this.request('DELETE', `/instance/delete/${instanceName}`);
  }
}
