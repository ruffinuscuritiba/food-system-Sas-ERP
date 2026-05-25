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
        allowMultipleFlavors: data.allowMultipleFlavors ?? false,

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

  update(id: string, data: { name?: string; allowMultipleFlavors?: boolean }) {
    return this.prisma.category.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.allowMultipleFlavors !== undefined && { allowMultipleFlavors: data.allowMultipleFlavors }),
      },
    })
  }

  remove(id: string) {
    return this.prisma.category.delete({
      where: { id },
    })
  }
}
