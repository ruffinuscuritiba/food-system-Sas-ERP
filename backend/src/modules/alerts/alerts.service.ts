import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class AlertsService {
  constructor(private prisma: PrismaService) {}

  findAll(companyId: string, onlyUnread = false) {
    return this.prisma.alert.findMany({
      where: { companyId, ...(onlyUnread ? { read: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(id: string, companyId: string) {
    return this.prisma.alert.updateMany({
      where: { id, companyId },
      data: { read: true },
    });
  }

  async markAllRead(companyId: string) {
    return this.prisma.alert.updateMany({
      where: { companyId, read: false },
      data: { read: true },
    });
  }

  /**
   * O scheduler (alerts.scheduler.ts) roda a cada hora e chama isso de novo
   * sempre que a condição (ex: cancelamento > 15%) continua verdadeira — sem
   * dedup, cada rodada criava uma linha NOVA, empilhando dezenas de alertas
   * quase idênticos do mesmo tipo em poucos dias (achado real: 50 alertas
   * não lidos, quase todos "Alta Taxa de Cancelamentos" com % ligeiramente
   * diferente). Agora só existe 1 alerta NÃO LIDO por empresa+tipo por vez —
   * se já existir um, atualiza a mensagem/severidade no lugar em vez de
   * duplicar; um novo só nasce depois que o atual for marcado como lido.
   */
  async createAlert(data: {
    companyId: string;
    type: string;
    severity: string;
    title: string;
    message: string;
    metadata?: any;
  }) {
    const existing = await this.prisma.alert.findFirst({
      where: { companyId: data.companyId, type: data.type as any, read: false },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return this.prisma.alert.update({
        where: { id: existing.id },
        data: {
          severity: data.severity as any,
          title: data.title,
          message: data.message,
          metadata: data.metadata,
        },
      });
    }
    return this.prisma.alert.create({ data: data as any });
  }
}
