import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class CashService {
  constructor(private prisma: PrismaService) {}

  async current(companyId: string) {
    return this.prisma.cash.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async open(openingValue: number, companyId: string) {
    return this.prisma.cash.create({
      data: {
        openingValue,
        balance: openingValue,
        entries: 0,
        exits: 0,
        isOpen: true,
        company: { connect: { id: companyId } },
      },
    });
  }

  async movement(type: string, value: number, companyId: string) {
    const cash = await this.prisma.cash.findFirst({
      where: { companyId, isOpen: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!cash) return null;

    const entries =
      type === 'SUPPLY' ? Number(cash.entries) + value : Number(cash.entries);
    const exits =
      type === 'WITHDRAW' ? Number(cash.exits) + value : Number(cash.exits);
    const balance =
      type === 'SUPPLY'
        ? Number(cash.balance) + value
        : Number(cash.balance) - value;

    return this.prisma.cash.update({
      where: { id: cash.id },
      data: { entries, exits, balance },
    });
  }

  // Fechamento às cegas: o operador informa o valor contado (declaredValue)
  // SEM ver o saldo do sistema. O sistema calcula a diferença só depois.
  async close(companyId: string, userId: string | null, declaredValue: number) {
    const cash = await this.prisma.cash.findFirst({
      where: { companyId, isOpen: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!cash) return null;

    const systemValue = Number(cash.balance);
    const difference = Number((declaredValue - systemValue).toFixed(2));

    let closedByName: string | null = null;
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      closedByName = user?.name ?? null;
    }

    return this.prisma.cash.update({
      where: { id: cash.id },
      data: {
        isOpen: false,
        declaredValue,
        systemValue,
        difference,
        closedByUserId: userId,
        closedByName,
        closedAt: new Date(),
      },
    });
  }

  // Histórico de fechamentos — só para gestor/admin conferir as diferenças.
  async history(companyId: string) {
    return this.prisma.cash.findMany({
      where: { companyId, isOpen: false },
      orderBy: { closedAt: 'desc' },
      take: 60,
    });
  }

  // Cupom de Auditoria: resumo de cartão/PIX/transferência daquela sessão de
  // caixa (Order.cashId), pra facilitar a conferência física do dinheiro sem
  // contar recibo por recibo. Não inclui CASH — esse já está no saldo físico.
  async auditSummary(cashId: string, companyId: string) {
    const cash = await this.prisma.cash.findFirst({
      where: { id: cashId, companyId },
    });
    if (!cash) return null;

    const grouped = await this.prisma.order.groupBy({
      by: ['paymentMethod'],
      where: { cashId, companyId, status: { not: 'CANCELLED' } },
      _sum: { total: true },
      _count: { _all: true },
    });

    const byPaymentMethod = grouped
      .filter((g) => g.paymentMethod !== 'CASH')
      .map((g) => ({
        paymentMethod: g.paymentMethod,
        total: Number(g._sum.total ?? 0),
        count: g._count._all,
      }));

    const grandTotal = byPaymentMethod.reduce((s, g) => s + g.total, 0);

    return {
      cashId,
      isOpen: cash.isOpen,
      openedAt: cash.createdAt,
      closedAt: cash.closedAt,
      byPaymentMethod,
      grandTotal,
    };
  }
}
