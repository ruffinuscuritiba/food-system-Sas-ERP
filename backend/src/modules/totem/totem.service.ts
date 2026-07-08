import { Injectable } from '@nestjs/common';

interface TotemHeartbeatEntry {
  companyId: string;
  deviceId: string;
  tableNumber?: string;
  lastSeen: number;
}

// Em memória (mesmo padrão do Printer Agent) — sem escrita em banco, latência
// zero. TTL 90s porque o totem pinga a cada 30s (3 tentativas antes de sumir).
const heartbeats = new Map<string, TotemHeartbeatEntry>();
const TOTEM_ONLINE_TTL_MS = 90_000;

@Injectable()
export class TotemService {
  ping(companyId: string, deviceId: string, tableNumber?: string): { ok: boolean } {
    heartbeats.set(`${companyId}:${deviceId}`, {
      companyId,
      deviceId,
      tableNumber,
      lastSeen: Date.now(),
    });
    return { ok: true };
  }

  status(companyId: string) {
    const now = Date.now();
    const items = [...heartbeats.values()]
      .filter((h) => h.companyId === companyId)
      .map((h) => ({
        deviceId: h.deviceId,
        tableNumber: h.tableNumber ?? null,
        online: now - h.lastSeen < TOTEM_ONLINE_TTL_MS,
        lastSeen: new Date(h.lastSeen).toISOString(),
      }))
      .sort((a, b) => (a.tableNumber ?? '').localeCompare(b.tableNumber ?? ''));

    return {
      items,
      summary: {
        total: items.length,
        online: items.filter((i) => i.online).length,
      },
    };
  }
}
