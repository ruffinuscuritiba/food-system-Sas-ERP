import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'food-system-backend',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('version')
  getVersion() {
    return {
      version: '1.0.6-aggressive-cors',
      status: 'active',
      cors_mode: 'manual-middleware'
    };
  }

  @Get('init-db')
  async initDb(@Headers('x-init-token') token: string) {
    if (token !== 'food2026init') throw new UnauthorizedException();
    const prisma = new PrismaClient();
    try {
      const hash = await bcrypt.hash('123456', 10);
      const company = await prisma.company.upsert({
        where: { id: 'company-seed-001' },
        update: {},
        create: { id: 'company-seed-001', name: 'Ruffinus Food System', email: 'contato@ruffinus.com', phone: '(41) 99999-9999', plan: 'ENTERPRISE', subscriptionStatus: 'ACTIVE', isBlocked: false },
      });
      const u1 = await prisma.user.upsert({
        where: { email: 'admin@teste.com' },
        update: { password: hash, role: 'SUPER_ADMIN', isActive: true },
        create: { name: 'Admin Padrão', email: 'admin@teste.com', password: hash, role: 'SUPER_ADMIN', isActive: true, companyId: company.id },
      });
      const u2 = await prisma.user.upsert({
        where: { email: 'admin@food.com' },
        update: { password: hash, role: 'ADMIN', isActive: true },
        create: { name: 'Admin Food', email: 'admin@food.com', password: hash, role: 'ADMIN', isActive: true, companyId: company.id },
      });
      return { ok: true, company: company.id, users: [u1.email, u2.email] };
    } finally {
      await prisma.$disconnect();
    }
  }
}
