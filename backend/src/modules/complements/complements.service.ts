import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { CreateComplementDto } from './dto/create-complement.dto';
import { CreateComplementOptionDto } from './dto/create-complement-option.dto';
// NOTE: Prisma types for new models are generated on deploy (prisma generate)
// Using `any` casts here to avoid TS errors before client is regenerated

@Injectable()
export class ComplementsService {
  constructor(private prisma: PrismaService) {}

  // ── COMPLEMENTS ──────────────────────────────────────────────────────────────

  async findByProduct(productId: string, companyId: string) {
    return (this.prisma as any).complement.findMany({
      where: { productId, companyId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        options: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  async findAll(companyId: string) {
    return (this.prisma as any).complement.findMany({
      where: { companyId },
      orderBy: [{ productId: 'asc' }, { sortOrder: 'asc' }],
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
        product: { select: { id: true, name: true } },
      },
    });
  }

  async create(dto: CreateComplementDto, companyId: string) {
    return (this.prisma as any).complement.create({
      data: {
        companyId,
        name:           dto.name,
        productId:      dto.productId ?? null,
        categoryId:     dto.categoryId ?? null,
        type:           dto.type ?? 'INGREDIENTES',
        required:       dto.required ?? false,
        chargesExtra:   dto.chargesExtra ?? true,
        multipleChoice: dto.multipleChoice ?? false,
        minOptions:     dto.minOptions ?? 0,
        maxOptions:     dto.maxOptions ?? 1,
        sortOrder:      dto.sortOrder ?? 0,
      },
      include: { options: true },
    });
  }

  async update(id: string, companyId: string, data: Partial<CreateComplementDto>) {
    await this.assertOwnership(id, companyId);
    return (this.prisma as any).complement.update({
      where: { id },
      data: {
        ...(data.name           !== undefined && { name:           data.name }),
        ...(data.type           !== undefined && { type:           data.type }),
        ...(data.required       !== undefined && { required:       data.required }),
        ...(data.chargesExtra   !== undefined && { chargesExtra:   data.chargesExtra }),
        ...(data.multipleChoice !== undefined && { multipleChoice: data.multipleChoice }),
        ...(data.minOptions     !== undefined && { minOptions:     data.minOptions }),
        ...(data.maxOptions     !== undefined && { maxOptions:     data.maxOptions }),
        ...(data.sortOrder      !== undefined && { sortOrder:      data.sortOrder }),
      },
      include: { options: true },
    });
  }

  async remove(id: string, companyId: string) {
    await this.assertOwnership(id, companyId);
    return (this.prisma as any).complement.delete({ where: { id } });
  }

  // ── OPTIONS ──────────────────────────────────────────────────────────────────

  async findOptions(complementId: string, companyId: string) {
    await this.assertOwnership(complementId, companyId);
    return (this.prisma as any).complementOption.findMany({
      where: { complementId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createOption(complementId: string, dto: CreateComplementOptionDto, companyId: string) {
    await this.assertOwnership(complementId, companyId);
    return (this.prisma as any).complementOption.create({
      data: {
        complementId,
        name:      dto.name,
        price:     dto.price ?? 0,
        imageUrl:  dto.imageUrl ?? null,
        isActive:  dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateOption(
    optionId: string,
    complementId: string,
    dto: Partial<CreateComplementOptionDto>,
    companyId: string,
  ) {
    await this.assertOwnership(complementId, companyId);
    return (this.prisma as any).complementOption.update({
      where: { id: optionId },
      data: {
        ...(dto.name      !== undefined && { name:      dto.name }),
        ...(dto.price     !== undefined && { price:     dto.price }),
        ...(dto.imageUrl  !== undefined && { imageUrl:  dto.imageUrl }),
        ...(dto.isActive  !== undefined && { isActive:  dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async removeOption(optionId: string, complementId: string, companyId: string) {
    await this.assertOwnership(complementId, companyId);
    return (this.prisma as any).complementOption.delete({ where: { id: optionId } });
  }

  // ── helpers ──────────────────────────────────────────────────────────────────

  private async assertOwnership(complementId: string, companyId: string) {
    const comp = await (this.prisma as any).complement.findFirst({
      where: { id: complementId, companyId },
    });
    if (!comp) throw new NotFoundException('Complemento não encontrado');
  }
}
