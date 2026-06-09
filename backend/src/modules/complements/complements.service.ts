import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { CreateComplementDto } from './dto/create-complement.dto';
import { CreateComplementOptionDto } from './dto/create-complement-option.dto';
// NOTE: campos novos (sortOrder, isFeatured, categoryId) já no schema.prisma.
// `(this.prisma as any)` mantido onde Prisma client não foi regenerado em alguns ambientes.

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * COMPLEMENTOS — Regras de hierarquia e deduplicação
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cada Complement pertence a UM dos 3 escopos (mutuamente exclusivos):
 *
 *   ESCOPO        | productId | categoryId  | prioridade
 *   --------------|-----------|-------------|------------
 *   PRODUCT (P)   |   set     |    null     |   0  (vence)
 *   CATEGORY (C)  |   null    |    set      |   1
 *   GLOBAL (G)    |   null    |    null     |   2  (cede)
 *
 * RESOLUÇÃO P > C > G:
 *   findByProduct(productId) carrega todos os 3 escopos relevantes,
 *   ordena por [priority, sortOrder, createdAt] e DEDUPLICA por
 *   `name.toLowerCase().trim()`. A primeira ocorrência vence — ou seja,
 *   a de maior prioridade. Isso permite que o operador crie um grupo
 *   "Adicionais" global e sobrescreva apenas em produtos específicos
 *   sem precisar excluir o global.
 *
 * EXCLUSIVIDADE garantida em CREATE/UPDATE:
 *   se productId E categoryId vierem no DTO, rejeita 400.
 *   Tenant guard valida que productId/categoryId pertencem à empresa.
 *
 * REORDER por escopo:
 *   sortOrder é por escopo. DnD no admin é separado por lista (P/C/G)
 *   para evitar reorder cruzado que quebraria a estabilidade do dedup.
 * ═══════════════════════════════════════════════════════════════════════════
 */

type Scope = 'PRODUCT' | 'CATEGORY' | 'GLOBAL';
const SCOPE_PRIORITY: Record<Scope, number> = {
  PRODUCT: 0,
  CATEGORY: 1,
  GLOBAL: 2,
};

function dedupKey(name: string): string {
  return (name ?? '').toLowerCase().trim();
}

function scopeOf(c: {
  productId: string | null;
  categoryId: string | null;
}): Scope {
  if (c.productId) return 'PRODUCT';
  if (c.categoryId) return 'CATEGORY';
  return 'GLOBAL';
}

@Injectable()
export class ComplementsService {
  constructor(private prisma: PrismaService) {}

  // ── HIERARQUIA — método único de prioridade ────────────────────────────────

  /**
   * Aplica regra P>C>G + dedup por nome. Recebe lista mista e devolve
   * apenas os "vencedores". Centralizado para que futuras regras
   * (ex.: dia da semana, faixa horária) entrem aqui em vez de ramificar.
   */
  private applyComplementsPriority(groups: any[]): any[] {
    // Anota prioridade
    const annotated = groups.map((g) => ({
      ...g,
      _scope: scopeOf(g),
      _priority: SCOPE_PRIORITY[scopeOf(g)],
      _key: dedupKey(g.name),
    }));

    // Ordena: prioridade (P=0 primeiro), depois sortOrder, depois createdAt asc (estável)
    annotated.sort((a, b) => {
      if (a._priority !== b._priority) return a._priority - b._priority;
      const sa = Number(a.sortOrder ?? 0),
        sb = Number(b.sortOrder ?? 0);
      if (sa !== sb) return sa - sb;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    // Dedup mantendo o primeiro (= maior prioridade)
    const seen = new Set<string>();
    const winners: any[] = [];
    for (const g of annotated) {
      if (seen.has(g._key)) continue;
      seen.add(g._key);
      winners.push(g);
    }

    // Limpa campos internos antes de devolver
    return winners.map(({ _scope, _priority, _key, ...rest }) => rest);
  }

  // ── PUBLIC LIST (cardápio digital + PDV consomem este) ─────────────────────

  async findByProduct(productId: string, companyId: string) {
    // 1. Resolve categoria do produto (escopo intermediário)
    const product = await this.prisma.product.findFirst({
      where: { id: productId, companyId },
      select: { id: true, categoryId: true },
    });
    if (!product) return []; // produto inexistente/outra empresa → sem grupos

    // 2. Query única cobrindo os 3 escopos relevantes
    const groups: any[] = await this.prisma.complement.findMany({
      where: {
        companyId,
        isActive: true,
        OR: [
          { productId }, // P
          ...(product.categoryId
            ? [{ productId: null, categoryId: product.categoryId }]
            : []), // C
          { productId: null, categoryId: null }, // G
        ],
      },
      include: {
        options: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    // 3. Aplica regra centralizada
    return this.applyComplementsPriority(groups);
  }

  // ── ADMIN LIST (mostra TUDO; UI agrupa por escopo) ─────────────────────────

  async findAll(companyId: string) {
    return this.prisma.complement.findMany({
      where: { companyId },
      orderBy: [
        { productId: 'asc' },
        { categoryId: 'asc' },
        { sortOrder: 'asc' },
      ],
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
        product: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    });
  }

  // ── CREATE ─────────────────────────────────────────────────────────────────

  async create(dto: CreateComplementDto, companyId: string) {
    await this.assertScopeAndOwnership(
      dto.productId,
      dto.categoryId,
      companyId,
    );
    return this.prisma.complement.create({
      data: {
        companyId,
        name: dto.name,
        productId: dto.productId ?? null,
        categoryId: dto.categoryId ?? null,
        type: dto.type ?? 'INGREDIENTES',
        required: dto.required ?? false,
        chargesExtra: dto.chargesExtra ?? true,
        multipleChoice: dto.multipleChoice ?? false,
        minOptions: dto.minOptions ?? 0,
        maxOptions: dto.maxOptions ?? 1,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: { options: true },
    });
  }

  async update(
    id: string,
    companyId: string,
    data: Partial<CreateComplementDto>,
  ) {
    await this.assertOwnership(id, companyId);
    // Se trocar escopo no edit, revalida
    if (data.productId !== undefined || data.categoryId !== undefined) {
      await this.assertScopeAndOwnership(
        data.productId,
        data.categoryId,
        companyId,
      );
    }
    return this.prisma.complement.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.productId !== undefined && {
          productId: data.productId || null,
        }),
        ...(data.categoryId !== undefined && {
          categoryId: data.categoryId || null,
        }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.required !== undefined && { required: data.required }),
        ...(data.chargesExtra !== undefined && {
          chargesExtra: data.chargesExtra,
        }),
        ...(data.multipleChoice !== undefined && {
          multipleChoice: data.multipleChoice,
        }),
        ...(data.minOptions !== undefined && { minOptions: data.minOptions }),
        ...(data.maxOptions !== undefined && { maxOptions: data.maxOptions }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
      include: { options: true },
    });
  }

  async remove(id: string, companyId: string) {
    await this.assertOwnership(id, companyId);
    return this.prisma.complement.delete({ where: { id } });
  }

  // ── B2 — DUPLICAR GRUPO ────────────────────────────────────────────────────

  async duplicate(id: string, companyId: string) {
    await this.assertOwnership(id, companyId);
    const src = await this.prisma.complement.findUnique({
      where: { id },
      include: { options: true },
    });
    if (!src) throw new NotFoundException('Complemento não encontrado.');

    // Próximo sortOrder dentro do mesmo escopo
    const max = await this.prisma.complement.aggregate({
      where: {
        companyId,
        productId: src.productId,
        categoryId: src.categoryId,
      },
      _max: { sortOrder: true },
    });

    return this.prisma.complement.create({
      data: {
        companyId,
        name: `${src.name} (cópia)`,
        productId: src.productId,
        categoryId: src.categoryId,
        type: src.type,
        required: src.required,
        chargesExtra: src.chargesExtra,
        multipleChoice: src.multipleChoice,
        minOptions: src.minOptions,
        maxOptions: src.maxOptions,
        sortOrder: (max._max.sortOrder ?? 0) + 1,
        options: {
          create: src.options.map((o: any, idx: number) => ({
            name: o.name,
            price: o.price,
            imageUrl: o.imageUrl,
            isActive: o.isActive,
            sortOrder: idx,
          })),
        },
      },
      include: { options: true },
    });
  }

  // ── B4 — REORDER GRUPOS (por escopo) ───────────────────────────────────────

  async reorderGroups(
    companyId: string,
    items: { id: string; sortOrder: number }[],
  ) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('items é obrigatório');
    }
    const ids = items.map((i) => i.id);
    const owned: any[] = await this.prisma.complement.findMany({
      where: { id: { in: ids }, companyId },
      select: { id: true },
    });
    if (owned.length !== ids.length) {
      throw new BadRequestException('Complemento fora da empresa');
    }
    await this.prisma.$transaction(
      items.map((i) =>
        this.prisma.complement.update({
          where: { id: i.id },
          data: { sortOrder: i.sortOrder },
        }),
      ),
    );
    return { ok: true, updated: items.length };
  }

  // ── OPTIONS CRUD (igual antes, mas com sortOrder no create) ────────────────

  async findOptions(complementId: string, companyId: string) {
    await this.assertOwnership(complementId, companyId);
    return this.prisma.complementOption.findMany({
      where: { complementId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createOption(
    complementId: string,
    dto: CreateComplementOptionDto,
    companyId: string,
  ) {
    await this.assertOwnership(complementId, companyId);
    const max = await this.prisma.complementOption.aggregate({
      where: { complementId },
      _max: { sortOrder: true },
    });
    return this.prisma.complementOption.create({
      data: {
        complementId,
        name: dto.name,
        price: dto.price ?? 0,
        imageUrl: dto.imageUrl ?? null, // B3 — aceita base64/URL
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? (max._max.sortOrder ?? 0) + 1,
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
    return this.prisma.complementOption.update({
      where: { id: optionId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }), // B3
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async removeOption(
    optionId: string,
    complementId: string,
    companyId: string,
  ) {
    await this.assertOwnership(complementId, companyId);
    return this.prisma.complementOption.delete({ where: { id: optionId } });
  }

  // ── B4 — REORDER OPÇÕES ────────────────────────────────────────────────────

  async reorderOptions(
    complementId: string,
    companyId: string,
    items: { id: string; sortOrder: number }[],
  ) {
    await this.assertOwnership(complementId, companyId);
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('items é obrigatório');
    }
    const ids = items.map((i) => i.id);
    const owned: any[] = await this.prisma.complementOption.findMany({
      where: { id: { in: ids }, complementId },
      select: { id: true },
    });
    if (owned.length !== ids.length) {
      throw new BadRequestException('Opção fora do grupo');
    }
    await this.prisma.$transaction(
      items.map((i) =>
        this.prisma.complementOption.update({
          where: { id: i.id },
          data: { sortOrder: i.sortOrder },
        }),
      ),
    );
    return { ok: true, updated: items.length };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private async assertOwnership(complementId: string, companyId: string) {
    const comp = await this.prisma.complement.findFirst({
      where: { id: complementId, companyId },
    });
    if (!comp) throw new NotFoundException('Complemento não encontrado');
  }

  /**
   * Garante (a) escopos mutuamente exclusivos e (b) tenant ownership do
   * productId/categoryId. Usado em CREATE e em UPDATE quando o escopo muda.
   */
  private async assertScopeAndOwnership(
    productId: string | undefined | null,
    categoryId: string | undefined | null,
    companyId: string,
  ) {
    if (productId && categoryId) {
      throw new BadRequestException(
        'Defina apenas UM escopo: produto, categoria ou global.',
      );
    }
    if (productId) {
      const p = await this.prisma.product.findFirst({
        where: { id: productId, companyId },
        select: { id: true },
      });
      if (!p)
        throw new NotFoundException('Produto não encontrado nesta empresa.');
    }
    if (categoryId) {
      const c = await this.prisma.category.findFirst({
        where: { id: categoryId, companyId },
        select: { id: true },
      });
      if (!c)
        throw new NotFoundException('Categoria não encontrada nesta empresa.');
    }
  }
}
