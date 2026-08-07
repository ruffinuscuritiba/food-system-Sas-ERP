import { Injectable, Optional } from '@nestjs/common';

import { PrismaService } from '@/database/prisma.service';
import { CompanyService } from '@/modules/company/company.service';
import { SocketGateway } from '@/socket/socket.gateway';

@Injectable()
export class TableCartService {
  constructor(
    private prisma: PrismaService,
    private companyService: CompanyService,
    @Optional() private socketGateway?: SocketGateway,
  ) {}

  async get(companySlugOrId: string, tableNumber: string) {
    const companyId = await this.companyService.resolveId(companySlugOrId);
    if (!companyId) return { companyId: null, tableNumber, items: [] };

    const cart = await this.prisma.tableCart.findUnique({
      where: { companyId_tableNumber: { companyId, tableNumber } },
    });
    return { companyId, tableNumber, items: cart?.items ?? [] };
  }

  async save(companySlugOrId: string, tableNumber: string, items: unknown[]) {
    const companyId = await this.companyService.resolveId(companySlugOrId);
    if (!companyId) return { companyId: null, tableNumber, items: [] };

    const safeItems = Array.isArray(items) ? items : [];

    await this.prisma.tableCart.upsert({
      where: { companyId_tableNumber: { companyId, tableNumber } },
      create: { companyId, tableNumber, items: safeItems as any },
      update: { items: safeItems as any },
    });

    this.socketGateway?.emitTableCartUpdated(companyId, tableNumber, safeItems);
    return { companyId, tableNumber, items: safeItems };
  }
}
