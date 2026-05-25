import { Injectable }
from "@nestjs/common";

import { PrismaService }
from "@/database/prisma.service";

import { AuditService }
from "@/modules/audit/audit.service";

@Injectable()
export class ProductsService {

  constructor(
    private prisma: PrismaService,

    private auditService: AuditService,
  ) {}

  findAll(companyId: string) {

    return this.prisma.product.findMany({

      where: {
        companyId,
        deletedAt: null,
      },

      include: {
        category: true,
        sizes: { orderBy: { size: 'asc' } },
      },
    });
  }

  async create(
    data: any,
  ) {

    const rawSizes = data.sizes ?? [];
    const sizes: Array<{ size: string; price: number }> = typeof rawSizes === 'string'
      ? JSON.parse(rawSizes)
      : rawSizes;

    const product =
      await this.prisma.product.create({

        data: {

          name:
            data.name,

          description:
            data.description,

          sku:
            data.sku,

          barcode:
            data.barcode,

          unit:
            data.unit,

          size:
            data.size,

          weight:
            parseFloat(
              data.weight || 0,
            ),

          imageUrl:
            data.imageUrl,

          costPrice:
            parseFloat(
              data.costPrice || 0,
            ),

          profitMargin:
            parseFloat(
              data.profitMargin || 0,
            ),

          salePrice:
            parseFloat(
              data.salePrice ?? data.price ?? 0,
            ),

          isActive:
            data.isActive ?? true,

          trackStock:
            data.trackStock ?? true,

          allowNegativeStock:
            data.allowNegativeStock ?? false,

          company: {

            connect: {
              id:
                data.companyId,
            },
          },

          ...(data.categoryId && {

            category: {

              connect: {
                id:
                  data.categoryId,
              },
            },
          }),

          ...(sizes.length > 0 && {
            sizes: {
              create: sizes.map((s) => ({
                size: s.size as any,
                price: Number(s.price),
                companyId: data.companyId,
              })),
            },
          }),
        },

        include: {
          category: true,
          sizes: { orderBy: { size: 'asc' } },
        },
      });

    await this.auditService.log({

      action:
        "CREATE_PRODUCT",

      entity:
        "Product",

      entityId:
        product.id,

      description:
        `Produto criado: ${product.name}`,

      companyId:
        data.companyId,

      metadata: {

        name:
          product.name,

        salePrice:
          product.salePrice,
      },
    });

    return product;
  }

  async update(id: string, data: any) {
    const rawSizes = data.sizes;
    const sizes: Array<{ size: string; price: number }> | undefined = rawSizes === undefined
      ? undefined
      : typeof rawSizes === 'string' ? JSON.parse(rawSizes) : rawSizes;

    if (sizes !== undefined) {
      await this.prisma.productSize.deleteMany({ where: { productId: id } });
      if (sizes.length > 0) {
        await this.prisma.productSize.createMany({
          data: sizes.map((s) => ({
            productId: id,
            size: s.size as any,
            price: Number(s.price),
            companyId: data.companyId ?? '',
          })),
        });
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.salePrice !== undefined && { salePrice: parseFloat(data.salePrice) }),
        ...(data.costPrice !== undefined && { costPrice: parseFloat(data.costPrice) }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.categoryId !== undefined && data.categoryId !== '' && {
          category: { connect: { id: data.categoryId } },
        }),
      },
      include: {
        category: true,
        sizes: { orderBy: { size: 'asc' } },
      },
    });
  }

  async publicMenu(
    companyId: string,
  ) {

    return this.prisma.product.findMany({

      where: {

        companyId,

        isActive: true,

        deletedAt: null,
      },

      include: {
        category: true,
        sizes: { orderBy: { size: 'asc' } },
      },

      orderBy: {
        name: "asc",
      },
    });
  }
  findTrash() {

  return this.prisma.product.findMany({

    where: {

      deletedAt: {
        not: null,
      },
    },

    include: {
      category: true,
    },

    orderBy: {
      deletedAt: "desc",
    },
  });
}

async restore(
  id: string,
) {

  const product =
    await this.prisma.product.update({

      where: {
        id,
      },

      data: {

        deletedAt:
          null,

        isActive:
          true,
      },
    });

  await this.auditService.log({

    action:
      "RESTORE_PRODUCT",

    entity:
      "Product",

    entityId:
      product.id,

    description:
      `Produto restaurado: ${product.name}`,

    companyId:
      product.companyId,

    metadata: {

      name:
        product.name,
    },
  });

  return product;
}
  async remove(
  id: string,
) {

  const product =
    await this.prisma.product.update({

      where: {
        id,
      },

      data: {

        deletedAt:
          new Date(),

        isActive:
          false,
      },
    });

  await this.auditService.log({

    action:
      "DELETE_PRODUCT",

    entity:
      "Product",

    entityId:
      product.id,

    description:
      `Produto removido: ${product.name}`,

    companyId:
      product.companyId,

    metadata: {

      name:
        product.name,
    },
  });

  return product;
}
}