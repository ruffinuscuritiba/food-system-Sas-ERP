import { Injectable } from '@nestjs/common'

import { PrismaService } from 'src/database/prisma.service'

@Injectable()
export class CategoriesService {
  constructor(
    private prisma: PrismaService,
  ) {}

  create(data: any) {
    return this.prisma.category.create({
      data: {
        name: data.name,

        company: {
          connect: {
            id: data.companyId,
          },
        },
      },
    })
  }

  findAll(companyId: string) {
    return this.prisma.category.findMany({
      where: {
        companyId,
      },

      orderBy: {
        name: 'asc',
      },
    })
  }
}