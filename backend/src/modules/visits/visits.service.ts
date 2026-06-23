import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class VisitsService {
  constructor(private prisma: PrismaService) {}

  track(page: string) {
    return (this.prisma as any).pageVisit.create({ data: { page } });
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
}
