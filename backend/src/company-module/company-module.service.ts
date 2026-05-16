import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class CompanyModuleService {
  constructor(
    private prisma: PrismaService,
  ) {}

  async findCompanies() {
    return this.prisma.company.findMany();
  }

  create(data: any) {
    return this.prisma.companyModule.create({
      data,
    });
  }

  findAll() {
    return this.prisma.companyModule.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}