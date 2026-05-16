import {
  Injectable,
} from "@nestjs/common";

import { PrismaService } from "src/database/prisma.service";

@Injectable()
export class CashService {

  constructor(
    private prisma: PrismaService,
  ) {}

  async current() {

    const cash =
      await this.prisma.cash.findFirst({
        orderBy: {
          createdAt: "desc",
        },
      });

    return cash;
  }

  async open(
    openingValue: number,
    companyId: string,
  ) {

    return this.prisma.cash.create({
      data: {

        openingValue,

        balance: openingValue,

        entries: 0,

        exits: 0,

        isOpen: true,

        company: {
          connect: {
            id: companyId,
          },
        },
      },
    });
  }

  async movement(
    type: string,
    value: number,
  ) {

    const cash =
      await this.prisma.cash.findFirst({
        orderBy: {
          createdAt: "desc",
        },
      });

    if (!cash) {
      return;
    }

    const entries =
      type === "SUPPLY"

        ? Number(cash.entries) + value

        : Number(cash.entries);

    const exits =
      type === "WITHDRAW"

        ? Number(cash.exits) + value

        : Number(cash.exits);

    const balance =
      type === "SUPPLY"

        ? Number(cash.balance) + value

        : Number(cash.balance) - value;

    return this.prisma.cash.update({
      where: {
        id: cash.id,
      },

      data: {
        entries,
        exits,
        balance,
      },
    });
  }

  async close() {

    const cash =
      await this.prisma.cash.findFirst({
        orderBy: {
          createdAt: "desc",
        },
      });

    if (!cash) {
      return;
    }

    return this.prisma.cash.update({
      where: {
        id: cash.id,
      },

      data: {
        isOpen: false,
      },
    });
  }
}