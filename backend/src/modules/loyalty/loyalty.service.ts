import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { normalizePhoneBr } from '@/common/utils/phone';

// Regras configuráveis por loja (idealmente viria de Company settings)
const POINTS_PER_REAL = 1; // 1 ponto por R$ 1,00
const CASHBACK_RATE = 0.02; // 2% cashback
const POINTS_TO_BRL_RATE = 0.05; // 100 pontos = R$ 5,00 (mesma regra de redeemPoints)

/** Últimos 8 dígitos — ignora DDI/DDC/formatação, mesma regra usada em
 *  reports.service.ts e loyalty-milestones.service.ts pra casar telefone
 *  entre canais (PDV/WhatsApp gravam sem normalizar, cardápio digital sim). */
function phoneLast8(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 8 ? digits.slice(-8) : null;
}

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Acha (ou cria) o Customer dono desse telefone nessa empresa — sem isso,
   * pontos nunca eram creditados de verdade pra pedidos do PDV/WhatsApp
   * (Order.customerId quase nunca é preenchido) nem do cardápio digital
   * (OnlineOrder nunca chamava fidelidade nenhuma vez).
   */
  private async findOrCreateCustomerByPhone(
    companyId: string,
    rawPhone: string | null | undefined,
    name?: string | null,
  ): Promise<string | null> {
    const last8 = phoneLast8(rawPhone);
    if (!last8) return null;

    const existing = await this.prisma.customer.findFirst({
      where: { companyId, phone: { endsWith: last8 } },
    });
    if (existing) return existing.id;

    const normalized = normalizePhoneBr(rawPhone!) || rawPhone!.replace(/\D/g, '');
    const created = await this.prisma.customer.create({
      data: {
        companyId,
        phone: normalized,
        name: name?.trim() || normalized,
      },
    });
    return created.id;
  }

  /** Wrapper de processOrderReward por telefone — usado pelos hooks reais
   *  (Order/OnlineOrder nunca têm customerId confiável preenchido). */
  async processOrderRewardByPhone(
    companyId: string,
    phone: string | null | undefined,
    name: string | null | undefined,
    orderId: string,
    orderAmount: number,
  ) {
    const customerId = await this.findOrCreateCustomerByPhone(companyId, phone, name);
    if (!customerId) return null;
    return this.processOrderReward(customerId, companyId, orderId, orderAmount);
  }

  // ── Chamado após pedido APROVADO (hook em orders.service) ──
  async processOrderReward(
    customerId: string,
    companyId: string,
    orderId: string,
    orderAmount: number,
  ) {
    const points = Math.floor(orderAmount * POINTS_PER_REAL);
    const cashback = new Decimal(orderAmount * CASHBACK_RATE).toDecimalPlaces(
      2,
    );

    const account = await this.upsertAccount(customerId, companyId);

    await this.prisma.$transaction([
      // Adiciona pontos
      this.prisma.pointTransaction.create({
        data: {
          loyaltyAccountId: account.id,
          orderId,
          points,
          type: 'EARNED',
          description: `Pontos pelo pedido #${orderId.slice(-6).toUpperCase()}`,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 ano
        },
      }),
      // Atualiza saldo
      this.prisma.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          totalPoints: { increment: points },
          totalCashback: { increment: cashback },
        },
      }),
    ]);

    this.logger.log(
      `Fidelidade: +${points} pontos para cliente ${customerId} no pedido ${orderId}`,
    );

    return { points, cashback };
  }

  // ── Valida e aplica cupom num pedido ──────────────────────
  //
  // Regra de negócio: cupom NUNCA se aplica (1) a bebidas, nem (2) a produtos
  // que já têm promoção própria (Product.originalPrice) acima de 40% off —
  // evita empilhar cupom em cima de item já com desconto profundo. A base de
  // cálculo do cupom exclui o valor desses itens; o resto do carrinho paga
  // preço normal. Reavaliado 100% no servidor (re-busca categoria/preço por
  // productId) — nunca confia em flag enviada pelo cliente.
  async validateCoupon(
    code: string,
    companyId: string,
    orderAmount: number,
    customerId?: string,
    items?: { productId: string; quantity: number; unitPrice: number }[],
  ) {
    const coupon = await this.prisma.coupon.findFirst({
      where: {
        code: code.toUpperCase().trim(),
        companyId,
        active: true,
        AND: [
          { OR: [{ customerId: null }, { customerId }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        ],
      },
    });

    if (!coupon) throw new NotFoundException('Cupom inválido ou expirado');

    if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
      throw new NotFoundException('Cupom inválido ou expirado');
    }

    if (coupon.minOrderAmount && orderAmount < Number(coupon.minOrderAmount)) {
      throw new BadRequestException(
        `Pedido mínimo para este cupom: R$ ${coupon.minOrderAmount}`,
      );
    }

    // Base de cálculo — por padrão o carrinho inteiro; reduzida abaixo
    // quando há itens de bebida ou já em promoção > 40%.
    let discountableAmount = orderAmount;
    let excludedAmount = 0;

    if (items && items.length > 0) {
      const productIds = [...new Set(items.map((i) => i.productId))];
      const products = await this.prisma.product.findMany({
        where: { id: { in: productIds }, companyId },
        select: {
          id: true,
          salePrice: true,
          originalPrice: true,
          category: { select: { categoryType: true } },
        },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      let itemsSubtotal = 0;
      for (const item of items) {
        const lineTotal = item.unitPrice * item.quantity;
        itemsSubtotal += lineTotal;

        const product = productMap.get(item.productId);
        const isBeverage = product?.category?.categoryType === 'bebidas';

        const original = Number(product?.originalPrice ?? 0);
        const current = Number(product?.salePrice ?? 0);
        const ownDiscountPct =
          original > 0 && current > 0 && original > current
            ? ((original - current) / original) * 100
            : 0;
        const isDeepPromo = ownDiscountPct > 40;

        if (isBeverage || isDeepPromo) excludedAmount += lineTotal;
      }
      discountableAmount = Math.max(itemsSubtotal - excludedAmount, 0);
    }

    let discount = 0;
    if (coupon.type === 'PERCENTAGE') {
      discount = discountableAmount * (Number(coupon.value) / 100);
      if (coupon.maxDiscount)
        discount = Math.min(discount, Number(coupon.maxDiscount));
    } else if (coupon.type === 'FIXED_AMOUNT') {
      discount = Math.min(Number(coupon.value), discountableAmount);
    }

    const valueLabel =
      coupon.type === 'PERCENTAGE'
        ? `${Number(coupon.value)}%`
        : `R$ ${Number(coupon.value).toFixed(2)}`;
    const message =
      excludedAmount > 0
        ? `${valueLabel} de desconto aplicado — bebidas e itens já em promoção não entram no cálculo. 🎉`
        : `${valueLabel} de desconto aplicado! 🎉`;

    return {
      couponId: coupon.id,
      code: coupon.code,
      type: coupon.type,
      discount: new Decimal(discount).toDecimalPlaces(2),
      finalAmount: new Decimal(orderAmount - discount).toDecimalPlaces(2),
      excludedAmount: new Decimal(excludedAmount).toDecimalPlaces(2),
      message,
    };
  }

  // ── Marca cupom como usado (chamado após pedido criado) ───
  async redeemCoupon(couponId: string) {
    return this.prisma.coupon
      .update({
        where: { id: couponId },
        data: { usageCount: { increment: 1 } },
      })
      .catch((err) =>
        this.logger.warn(`Coupon redeem failed: ${err?.message}`),
      );
  }

  // ── Admin: lista cupons da empresa ────────────────────────
  async listCoupons(companyId: string) {
    return this.prisma.coupon.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Admin: ativa/desativa cupom ───────────────────────────
  async toggleCoupon(id: string, companyId: string) {
    const coupon = await this.prisma.coupon.findFirst({
      where: { id, companyId },
    });
    if (!coupon) throw new NotFoundException('Cupom não encontrado');
    return this.prisma.coupon.update({
      where: { id },
      data: { active: !coupon.active },
    });
  }

  // ── Resgate de pontos por cupom ───────────────────────────
  async redeemPoints(
    customerId: string,
    companyId: string,
    pointsToRedeem: number,
  ) {
    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { customerId_companyId: { customerId, companyId } },
    });

    if (!account)
      throw new NotFoundException('Conta de fidelidade não encontrada');
    if (account.totalPoints < pointsToRedeem) {
      throw new BadRequestException(
        `Saldo insuficiente. Você tem ${account.totalPoints} pontos`,
      );
    }

    // 100 pontos = R$ 5,00
    const discountValue = new Decimal(
      (pointsToRedeem / 100) * 5,
    ).toDecimalPlaces(2);

    // Gera cupom temporário
    const couponCode = `PONTOS${Date.now().toString(36).toUpperCase()}`;
    await this.prisma.$transaction([
      this.prisma.coupon.create({
        data: {
          companyId,
          code: couponCode,
          type: 'FIXED_AMOUNT',
          value: discountValue,
          customerId,
          usageLimit: 1,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
          pointsCost: pointsToRedeem,
        },
      }),
      this.prisma.pointTransaction.create({
        data: {
          loyaltyAccountId: account.id,
          points: -pointsToRedeem,
          type: 'REDEEMED',
          description: `Resgate de ${pointsToRedeem} pontos — cupom ${couponCode}`,
        },
      }),
      this.prisma.loyaltyAccount.update({
        where: { id: account.id },
        data: { totalPoints: { decrement: pointsToRedeem } },
      }),
    ]);

    return { couponCode, discountValue };
  }

  // ── Saldo da conta de fidelidade — por telefone (nunca por customerId:
  // o chamador público, o checkout do cardápio, só conhece o telefone) ──────
  async getBalance(phone: string, companyId: string) {
    const empty = { totalPoints: 0, totalCashback: 0, redeemableValue: 0, transactions: [] as any[] };
    const last8 = phoneLast8(phone);
    if (!last8) return empty;

    const customer = await this.prisma.customer.findFirst({
      where: { companyId, phone: { endsWith: last8 } },
    });
    if (!customer) return empty;

    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { customerId_companyId: { customerId: customer.id, companyId } },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!account) return empty;

    return {
      ...account,
      redeemableValue: Number(
        new Decimal(account.totalPoints).mul(POINTS_TO_BRL_RATE).toDecimalPlaces(2),
      ),
    };
  }

  /**
   * Resgate de pontos direto no checkout do cardápio digital — debita de
   * verdade o saldo (antes o desconto era só um número calculado no
   * frontend, nunca decrementado no backend). `pointsToRedeem` é a
   * quantidade de pontos a gastar (não um valor em R$); a conversão pra
   * desconto usa a mesma taxa de `redeemPoints` (100 pontos = R$5).
   * Mesmo modelo de confiança já usado pra cupom/QR neste checkout — não
   * bloqueia o pedido se o saldo não bater (cap no que existe), fire-and-
   * forget chamado depois do pedido já persistido.
   */
  async applyPointsDiscount(
    companyId: string,
    phone: string,
    pointsToRedeem: number,
    orderId: string,
  ): Promise<{ pointsRedeemed: number; discountValue: number }> {
    const none = { pointsRedeemed: 0, discountValue: 0 };
    if (!pointsToRedeem || pointsToRedeem <= 0) return none;

    const last8 = phoneLast8(phone);
    if (!last8) return none;

    const customer = await this.prisma.customer.findFirst({
      where: { companyId, phone: { endsWith: last8 } },
    });
    if (!customer) return none;

    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { customerId_companyId: { customerId: customer.id, companyId } },
    });
    if (!account || account.totalPoints <= 0) return none;

    const points = Math.min(Math.floor(pointsToRedeem), account.totalPoints);
    const discountValue = new Decimal(points).mul(POINTS_TO_BRL_RATE).toDecimalPlaces(2);

    await this.prisma.$transaction([
      this.prisma.pointTransaction.create({
        data: {
          loyaltyAccountId: account.id,
          orderId,
          points: -points,
          type: 'REDEEMED',
          description: `Resgate de ${points} pontos no pedido #${orderId.slice(-6).toUpperCase()}`,
        },
      }),
      this.prisma.loyaltyAccount.update({
        where: { id: account.id },
        data: { totalPoints: { decrement: points } },
      }),
    ]);

    return { pointsRedeemed: points, discountValue: Number(discountValue) };
  }

  // ── Cria cupom manual (admin) ─────────────────────────────
  async createCoupon(data: {
    companyId: string;
    code: string;
    type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
    value: number;
    minOrderAmount?: number;
    maxDiscount?: number;
    usageLimit?: number;
    expiresAt?: Date;
    customerId?: string;
  }) {
    return this.prisma.coupon.create({
      data: {
        ...data,
        code: data.code.toUpperCase().trim(),
      },
    });
  }

  private async upsertAccount(customerId: string, companyId: string) {
    return this.prisma.loyaltyAccount.upsert({
      where: { customerId_companyId: { customerId, companyId } },
      create: { customerId, companyId, totalPoints: 0 },
      update: {},
    });
  }
}
