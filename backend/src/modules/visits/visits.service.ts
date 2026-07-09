import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class VisitsService {
  constructor(private prisma: PrismaService) {}

  track(page: string, eventType = 'VIEW', label?: string) {
    return (this.prisma as any).pageVisit.create({
      data: { page, eventType, label: label || null },
    });
  }

  async getStats(page: string) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, today, thisWeek, thisMonth] = await Promise.all([
      (this.prisma as any).pageVisit.count({ where: { page } }),
      (this.prisma as any).pageVisit.count({ where: { page, createdAt: { gte: startOfDay } } }),
      (this.prisma as any).pageVisit.count({ where: { page, createdAt: { gte: startOfWeek } } }),
      (this.prisma as any).pageVisit.count({ where: { page, createdAt: { gte: startOfMonth } } }),
    ]);

    return { total, today, thisWeek, thisMonth };
  }

  /** Ranking dos botões/CTAs mais clicados (page+label), para orientar conversão. */
  async getTopClicks(limit = 15) {
    const rows = await (this.prisma as any).pageVisit.groupBy({
      by: ['page', 'label'],
      where: { eventType: 'CLICK', label: { not: null } },
      _count: { _all: true },
    });
    return rows
      .map((r: any) => ({ page: r.page, label: r.label, count: r._count._all }))
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, limit);
  }
}
