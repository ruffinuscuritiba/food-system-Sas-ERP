import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';

type PizzaSize = 'PEQUENA' | 'MEDIA' | 'GRANDE' | 'FAMILIA' | 'EXTRA_GRANDE';

export interface BorderSizeDto {
  size: PizzaSize;
  price: number;
}

export interface CreateBorderDto {
  name: string;
  sizes: BorderSizeDto[];
}

export interface UpdateBorderDto {
  name?: string;
  isActive?: boolean;
  sizes?: BorderSizeDto[];
}

@Injectable()
export class PizzaBordersService {
  constructor(private prisma: PrismaService) {}

  findAll(companyId: string) {
    return this.prisma.pizzaBorder.findMany({
      where: { companyId },
      include: { sizes: { orderBy: { size: 'asc' } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(companyId: string, dto: CreateBorderDto) {
    const last = await this.prisma.pizzaBorder.findFirst({
      where: { companyId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    return this.prisma.pizzaBorder.create({
      data: {
        name: dto.name,
        sortOrder: (last?.sortOrder ?? 0) + 1,
        company: { connect: { id: companyId } },
        sizes: {
          create: dto.sizes.map((s) => ({
            size: s.size,
            price: s.price,
          })),
        },
      },
      include: { sizes: true },
    });
  }

  /** Reordena bordas (mover para cima/baixo). Valida que todas pertencem à empresa. */
  async reorder(companyId: string, items: { id: string; sortOrder: number }[]) {
    const ids = items.map((i) => i.id);
    const owned = await this.prisma.pizzaBorder.findMany({
      where: { id: { in: ids }, companyId },
      select: { id: true },
    });
    if (owned.length !== ids.length) {
      throw new NotFoundException('Borda fora da empresa');
    }

    await this.prisma.$transaction(
      items.map((i) =>
        this.prisma.pizzaBorder.update({
          where: { id: i.id },
          data: { sortOrder: i.sortOrder },
        }),
      ),
    );
    return { updated: items.length };
  }

  async update(id: string, companyId: string, dto: UpdateBorderDto) {
    const border = await this.prisma.pizzaBorder.findFirst({
      where: { id, companyId },
    });
    if (!border) throw new NotFoundException('Borda não encontrada');

    return this.prisma.$transaction(async (tx) => {
      if (dto.sizes !== undefined) {
        await tx.pizzaBorderSize.deleteMany({ where: { pizzaBorderId: id } });
        await tx.pizzaBorderSize.createMany({
          data: dto.sizes.map((s) => ({
            pizzaBorderId: id,
            size: s.size,
            price: s.price,
          })),
        });
      }

      return tx.pizzaBorder.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
        include: { sizes: { orderBy: { size: 'asc' } } },
      });
    });
  }

  async remove(id: string, companyId: string) {
    const border = await this.prisma.pizzaBorder.findFirst({
      where: { id, companyId },
    });
    if (!border) throw new NotFoundException('Borda não encontrada');
    return this.prisma.pizzaBorder.delete({ where: { id } });
  }
}
