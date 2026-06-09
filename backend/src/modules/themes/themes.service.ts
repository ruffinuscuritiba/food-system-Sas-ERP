import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ThemesService {
  constructor(private prisma: PrismaService) {}

  async getTheme(companyId: string) {
    let theme = await this.prisma.companyTheme.findUnique({
      where: {
        companyId,
      },
    });

    if (!theme) {
      theme = await this.prisma.companyTheme.create({
        data: {
          companyId,
        },
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
