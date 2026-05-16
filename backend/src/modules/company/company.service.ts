import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class CompanyService {
  constructor(
    private prisma: PrismaService,
  ) {}

  async findAll() {
    return this.prisma.company.findMany({
      include: {
        modules: true,
        users: true,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  create(data: any) {
    return this.prisma.company.create({
      data,
    });
  }

  blockCompany(id: string) {
    return this.prisma.company.update({
      where: {
        id,
      },

      data: {
        isBlocked: true,
      },
    });
  }

  unblockCompany(id: string) {
    return this.prisma.company.update({
      where: {
        id,
      },

      data: {
        isBlocked: false,
      },
    });
  }
}