import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ThemesService {
  constructor(private prisma: PrismaService) {}

  async getTheme(slugOrId: string) {
    const company = await this.prisma.company.findFirst({
      where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
      select: { id: true },
    });
    const companyId = company?.id ?? slugOrId;

    let theme = await this.prisma.companyTheme.findUnique({
      where: { companyId },
    });

    if (!theme && company) {
      theme = await this.prisma.companyTheme.create({
        data: { companyId },
      });
    }

    return theme;
  }

  async updateTheme(companyId: string, data: any) {
    return this.prisma.companyTheme.upsert({
      where: {
        companyId,
      },

      update: data,

      create: {
        companyId,

        ...data,
      },
    });
  }
}
