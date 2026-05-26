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

  async createAlert(data: {
    companyId: string;
    type: string;
    severity: string;
    title: string;
    message: string;
    metadata?: any;
  }) {
    return this.prisma.alert.create({ data: data as any });
  }
}
