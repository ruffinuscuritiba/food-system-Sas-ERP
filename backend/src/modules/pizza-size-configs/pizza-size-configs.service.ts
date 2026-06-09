import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

type PizzaSize = 'PEQUENA' | 'MEDIA' | 'GRANDE' | 'FAMILIA' | 'EXTRA_GRANDE';

// Defaults criados quando a empresa ainda não tem configuração
const DEFAULT_SIZES: Array<{
  size: PizzaSize;
  label: string;
  slices: number;
  maxFlavors: number;
  sortOrder: number;
}> = [
  { size: 'PEQUENA', label: 'Pequena', slices: 4, maxFlavors: 1, sortOrder: 0 },
  { size: 'MEDIA', label: 'Média', slices: 6, maxFlavors: 2, sortOrder: 1 },
  { size: 'GRANDE', label: 'Grande', slices: 8, maxFlavors: 3, sortOrder: 2 },
  {
    size: 'FAMILIA',
    label: 'Família',
    slices: 16,
    maxFlavors: 4,
    sortOrder: 3,
  },
  {
    size: 'EXTRA_GRANDE',
    label: 'Extra Grande',
    slices: 12,
    maxFlavors: 4,
    sortOrder: 4,
  },
];

@Injectable()
export class PizzaSizeConfigsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Retorna as configs da empresa, criando os defaults se ainda não existirem.
   */
  async findAll(companyId: string) {
    const existing = await this.prisma.pizzaSizeConfig.findMany({
      where: { companyId },
      orderBy: { sortOrder: 'asc' },
    });

    if (existing.length === 0) {
      // Cria defaults para a empresa
      await this.prisma.pizzaSizeConfig.createMany({
        data: DEFAULT_SIZES.map((d) => ({ ...d, companyId })),
        skipDuplicates: true,
      });

      return this.prisma.pizzaSizeConfig.findMany({
        where: { companyId },
        orderBy: { sortOrder: 'asc' },
      });
    }

    return existing;
  }

  async update(
    companyId: string,
    size: PizzaSize,
    data: {
      slices?: number;
      maxFlavors?: number;
      isActive?: boolean;
      label?: string;
    },
  ) {
    // Garante que o registro existe antes de atualizar (upsert)
    const defaults = DEFAULT_SIZES.find((d) => d.size === size);

    return this.prisma.pizzaSizeConfig.upsert({
      where: { companyId_size: { companyId, size } },
      create: {
        companyId,
        size,
        label: data.label ?? defaults?.label ?? size,
        slices: data.slices ?? defaults?.slices ?? 8,
        maxFlavors: data.maxFlavors ?? defaults?.maxFlavors ?? 1,
        isActive: data.isActive ?? true,
        sortOrder: defaults?.sortOrder ?? 0,
      },
      update: {
        ...(data.label !== undefined && { label: data.label }),
        ...(data.slices !== undefined && { slices: data.slices }),
        ...(data.maxFlavors !== undefined && { maxFlavors: data.maxFlavors }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  /**
   * Retorna o maxFlavors de um tamanho específico (para validação no pedido).
   */
  async getMaxFlavors(companyId: string, size: PizzaSize): Promise<number> {
    const config = await this.prisma.pizzaSizeConfig.findUnique({
      where: { companyId_size: { companyId, size } },
    });

    if (config) return config.maxFlavors;

    // fallback nos defaults hard-coded
    const def = DEFAULT_SIZES.find((d) => d.size === size);
    return def?.maxFlavors ?? 1;
  }
}
