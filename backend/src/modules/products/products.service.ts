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
      },
    });
  }

  async create(
    data: any,
  ) {

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