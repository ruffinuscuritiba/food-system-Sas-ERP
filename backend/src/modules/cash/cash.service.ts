import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { getStartOfTodayBrazil } from '@/common/utils/timezone';

@Injectable()
export class CashService {
  constructor(private prisma: PrismaService) {}

  // cashId explícito (PDV Mercado, múltiplos caixas) busca aquele registro
  // específico. Sem ele, comportamento antigo (o mais recente aberto).
  async current(companyId: string, cashId?: string) {
    if (cashId) {
      return this.prisma.cash.findFirst({ where: { id: cashId, companyId } });
    }
    return this.prisma.cash.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Todos os caixas abertos AGORA — painel de controle (módulo Mercado,
  // "até 5 caixas"). Vazio/lista de 1 item preserva o fluxo de restaurante.
  async listOpenRegisters(companyId: string) {
    return this.prisma.cash.findMany({
      where: { companyId, isOpen: true },
      orderBy: [{ registerNumber: 'asc' }, { createdAt: 'asc' }],
    });
  }

  // Vendas em dinheiro de HOJE (dia comercial de Brasília), somando a parte
  // física de cada pedido via `cashReceived` — `entries` não serve pra esse
  // KPI: ele só é incrementado em suprimento (SUPPLY), nunca em venda.
  // Pedidos CANCELLED são excluídos; pedidos sem cashReceived (PIX/cartão
  // puro) contribuem zero.
  async todayCashSales(companyId: string) {
    const today = getStartOfTodayBrazil();
    const orders = await this.prisma.order.findMany({
      where: {
        companyId,
        status: { not: 'CANCELLED' },
        createdAt: { gte: today },
      },
      select: { paymentMethod: true, total: true, cashReceived: true },
    });

    let totalCash = 0;
    let totalSales = 0;
    for (const o of orders) {
      const total = Number(o.total);
      totalSales += total;
      totalCash +=
        o.cashReceived != null
          ? Number(o.cashReceived)
          : o.paymentMethod === 'CASH'
            ? total
            : 0;
    }

    return {
      todayCashSales: Number(totalCash.toFixed(2)),
      todayTotalSales: Number(totalSales.toFixed(2)),
      orderCount: orders.length,
    };
  }

  async open(
    openingValue: number,
    companyId: string,
    registerNumber?: number,
    terminalName?: string,
    openedByUserId?: string,
    openedByName?: string,
  ) {
    // registerNumber presente = fluxo multi-caixa (Mercado) — bloqueia abrir
    // o MESMO número de caixa duas vezes; ausente = fluxo antigo, sem
    // restrição nenhuma (idêntico ao comportamento anterior).
    if (registerNumber != null) {
      const already = await this.prisma.cash.findFirst({
        where: { companyId, registerNumber, isOpen: true },
      });
      if (already) {
        throw new BadRequestException(
          `Caixa ${registerNumber} já está aberto.`,
        );
      }
    }
    return this.prisma.cash.create({
      data: {
        openingValue,
        balance: openingValue,
        entries: 0,
        exits: 0,
        isOpen: true,
        registerNumber: registerNumber ?? null,
        terminalName: terminalName ?? null,
        openedByUserId: openedByUserId ?? null,
        openedByName: openedByName ?? null,
        company: { connect: { id: companyId } },
      },
    });
  }

  // paymentMethod é opcional: quando ausente (sangria/suprimento manual do
  // operador), o movimento SEMPRE é dinheiro físico de verdade. Quando vem
  // de uma venda (ex: fechamento de mesa), só afeta o saldo se for CASH —
  // PIX/cartão não passam pela gaveta física, então não podem inflar o
  // "Sistema" do fechamento às cegas.
  async movement(
    type: string,
    value: number,
    companyId: string,
    paymentMethod?: string,
    cashId?: string,
  ) {
    // Valida o tipo ANTES de qualquer leitura — um `type` diferente de
    // SUPPLY/WITHDRAW (typo, campo vazio, valor inesperado) sempre cai no
    // ramo `: decrement` do cálculo antigo, subtraindo do caixa sem aviso
    // nenhum. Falha explícita é melhor que dinheiro somindo silenciosamente.
    if (type !== 'SUPPLY' && type !== 'WITHDRAW') {
      throw new BadRequestException(
        `Tipo de movimento de caixa inválido: "${type}". Use SUPPLY ou WITHDRAW.`,
      );
    }

    // cashId explícito mira o caixa certo entre vários abertos ao mesmo
    // tempo (Mercado); sem ele, mesmo lookup ambíguo de sempre (1 caixa).
    const cash = cashId
      ? await this.prisma.cash.findFirst({
          where: { id: cashId, companyId, isOpen: true },
        })
      : await this.prisma.cash.findFirst({
          where: { companyId, isOpen: true },
          orderBy: { createdAt: 'desc' },
        });
    if (!cash) return null;

    if (paymentMethod && paymentMethod !== 'CASH') {
      return cash;
    }

    const isSupply = type === 'SUPPLY';
    // Increment/decrement atômico no próprio UPDATE (não lê balance em JS e
    // escreve de volta) — 2 sangrias simultâneas não perdem atualização uma
    // da outra, o cálculo acontece no banco, não no processo Node.
    return this.prisma.cash.update({
      where: { id: cash.id },
      data: {
        entries: isSupply ? { increment: value } : undefined,
        exits: isSupply ? undefined : { increment: value },
        balance: isSupply ? { increment: value } : { decrement: value },
      },
    });
  }

  // Fechamento às cegas: o operador informa o valor contado (declaredValue)
  // SEM ver o saldo do sistema. O sistema calcula a diferença só depois.
  async close(
    companyId: string,
    userId: string | null,
    declaredValue: number,
    cashId?: string,
  ) {
    const cash = cashId
      ? await this.prisma.cash.findFirst({
          where: { id: cashId, companyId, isOpen: true },
        })
      : await this.prisma.cash.findFirst({
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
  // contar recibo por recibo. Não inclui a PARTE em dinheiro — essa já está
  // no saldo físico. Usa findMany + soma manual (não groupBy) porque um
  // pedido SPLIT (parte PIX + parte dinheiro) precisa da diferença
  // total-cashReceived, não do total inteiro agrupado por paymentMethod —
  // um groupBy simples inflaria a "conferência" com a parte que já é
  // dinheiro físico contado na gaveta.
  async auditSummary(cashId: string, companyId: string) {
    const cash = await this.prisma.cash.findFirst({
      where: { id: cashId, companyId },
    });
    if (!cash) return null;

    const orders = await this.prisma.order.findMany({
      where: { cashId, companyId, status: { not: 'CANCELLED' } },
      select: { paymentMethod: true, total: true, cashReceived: true },
    });

    const byMethod = new Map<string, { total: number; count: number }>();
    for (const o of orders) {
      const total = Number(o.total);
      const cashPortion =
        o.cashReceived != null
          ? Number(o.cashReceived)
          : o.paymentMethod === 'CASH'
            ? total
            : 0;
      const nonCashPortion = total - cashPortion;
      if (nonCashPortion <= 0) continue; // 100% dinheiro — já contado na gaveta
      const entry = byMethod.get(o.paymentMethod) ?? { total: 0, count: 0 };
      entry.total += nonCashPortion;
      entry.count += 1;
      byMethod.set(o.paymentMethod, entry);
    }

    const byPaymentMethod = Array.from(byMethod.entries()).map(
      ([paymentMethod, v]) => ({ paymentMethod, ...v }),
    );

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
