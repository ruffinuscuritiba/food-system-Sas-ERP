import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(data: {
    action: string;

    entity: string;

    entityId?: string;

    description?: string;

    metadata?: any;

    companyId: string;

    userId?: string;

    ipAddress?: string;

    userAgent?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        action: data.action,

        entity: data.entity,

        entityId: data.entityId,

        description: data.description,

        metadata: data.metadata,

        companyId: data.companyId,

        userId: data.userId,

        ipAddress: data.ipAddress,

        userAgent: data.userAgent,
      },
    });
  }
}
