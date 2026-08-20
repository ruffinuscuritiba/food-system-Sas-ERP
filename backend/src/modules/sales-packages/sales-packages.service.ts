import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@/database/prisma.service';
import { PaymentsService } from '@/modules/payments/payments.service';
import { WhatsappAiService } from '@/modules/whatsapp-ai/whatsapp-ai.service';
import { normalizePhoneBr } from '@/common/utils/phone';

type BillingCycle = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

interface IncludedItem {
  productId: string;
  quantity: number;
}

/**
 * SalesPackagesService — pacotes/combos com cobrança recorrente ("10
 * marmitas por mês" etc).
 *
 * Decisão de arquitetura: a cobrança de cada ciclo reaproveita 100% o
 * pipeline de PIX/webhook/Wallet/Split fiscal já existente e testado
 * (PaymentsService.createOnlinePix + applyMpPaymentResult) — nunca duplica
 * lógica de pagamento. O OnlineOrder de cada ciclo é criado DIRETO via
 * Prisma (não via OnlineOrdersService.create()) porque essa validação é
 * pensada pra checkout ao vivo de cliente (horário de funcionamento,
 * disponibilidade de estoque em tempo real) — não faz sentido pra uma
 * cobrança agendada de um cron: a loja já se comprometeu com a assinatura
 * no momento em que o cliente assinou. Consumo real de estoque (receita)
 * continua acontecendo normalmente quando o operador confirma o pedido no
 * board da cozinha (updateKitchenStatus → consumeStockForOrder) — nada
 * disso é pulado, só a checagem prévia de "aceitar o pedido" é.
 *
 * MVP: pacote precisa ter ao menos 1 item incluído (produto real da
 * empresa) — não existe ainda o modo "crédito genérico sem produto".
 */
@Injectable()
export class SalesPackagesService {
  private readonly logger = new Logger(SalesPackagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    @Optional()
    @Inject(forwardRef(() => WhatsappAiService))
    private readonly whatsappAi?: WhatsappAiService,
  ) {}

  // ─── Pacotes (CRUD) ─────────────────────────────────────────────────────

  async listPackages(companyId: string) {
    return this.prisma.salesPackage.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { subscriptions: true } } },
    });
  }

  async createPackage(
    companyId: string,
    dto: {
      name: string;
      description?: string;
      price: number;
      billingCycle?: BillingCycle;
      includedItems: IncludedItem[];
    },
  ) {
    if (!dto.name?.trim()) throw new BadRequestException('Nome do pacote é obrigatório.');
    if (!(dto.price > 0)) throw new BadRequestException('Preço deve ser maior que zero.');
    if (!dto.includedItems?.length) {
      throw new BadRequestException('Selecione ao menos 1 produto incluído no pacote.');
    }
    await this.assertItemsBelongToCompany(companyId, dto.includedItems);

    return this.prisma.salesPackage.create({
      data: {
        companyId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        price: dto.price,
        billingCycle: dto.billingCycle ?? 'MONTHLY',
        includedItems: dto.includedItems as any,
        isActive: true,
      },
    });
  }

  async updatePackage(
    id: string,
    companyId: string,
    dto: Partial<{
      name: string;
      description: string;
      price: number;
      billingCycle: BillingCycle;
      includedItems: IncludedItem[];
      isActive: boolean;
    }>,
  ) {
    const existing = await this.prisma.salesPackage.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Pacote não encontrado.');
    if (dto.includedItems) await this.assertItemsBelongToCompany(companyId, dto.includedItems);

    return this.prisma.salesPackage.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        price: dto.price,
        billingCycle: dto.billingCycle,
        includedItems: dto.includedItems as any,
        isActive: dto.isActive,
      },
    });
  }

  async deletePackage(id: string, companyId: string) {
    const existing = await this.prisma.salesPackage.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Pacote não encontrado.');

    const activeSubs = await this.prisma.packageSubscription.count({
      where: { packageId: id, companyId, status: 'ACTIVE' },
    });
    if (activeSubs > 0) {
      throw new BadRequestException(
        `Existem ${activeSubs} assinante(s) ativo(s) neste pacote — desative o pacote em vez de excluir.`,
      );
    }
    await this.prisma.salesPackage.delete({ where: { id } });
    return { success: true };
  }

  private async assertItemsBelongToCompany(companyId: string, items: IncludedItem[]) {
    const ids = items.map((i) => i.productId).filter(Boolean);
    if (!ids.length) throw new BadRequestException('Itens do pacote inválidos.');
    const count = await this.prisma.product.count({ where: { id: { in: ids }, companyId } });
    if (count !== new Set(ids).size) {
      throw new BadRequestException('Um ou mais produtos não pertencem a esta empresa.');
    }
  }

  // ─── Assinantes ─────────────────────────────────────────────────────────

  async listSubscriptions(companyId: string, packageId?: string) {
    return this.prisma.packageSubscription.findMany({
      where: { companyId, ...(packageId ? { packageId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        package: { select: { name: true, price: true, billingCycle: true } },
        billings: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
  }

  async subscribe(
    companyId: string,
    dto: { packageId: string; customerPhone: string; customerName?: string },
  ) {
    const pkg = await this.prisma.salesPackage.findFirst({
      where: { id: dto.packageId, companyId, isActive: true },
    });
    if (!pkg) throw new NotFoundException('Pacote não encontrado ou inativo.');
    if (!dto.customerPhone?.trim()) throw new BadRequestException('Telefone do cliente é obrigatório.');

    const phone = normalizePhoneBr(dto.customerPhone);
    const sub = await this.prisma.packageSubscription.create({
      data: {
        companyId,
        packageId: pkg.id,
        customerPhone: phone,
        customerName: dto.customerName?.trim() || null,
        status: 'ACTIVE',
        nextBillingAt: new Date(),
      },
    });

    // Cobra o 1º ciclo na hora — nunca deixa o cliente esperando até o cron
    // do dia seguinte pra receber o primeiro PIX.
    await this.chargeCycle(sub.id).catch((e: any) =>
      this.logger.warn(`[sales-packages] cobrança inicial falhou (sub ${sub.id}): ${e?.message}`),
    );

    return this.prisma.packageSubscription.findUnique({
      where: { id: sub.id },
      include: { package: true, billings: true },
    });
  }

  async pauseSubscription(id: string, companyId: string) {
    await this.assertSubscriptionOwnership(id, companyId);
    return this.prisma.packageSubscription.update({
      where: { id },
      data: { status: 'PAUSED', pausedAt: new Date() },
    });
  }

  async resumeSubscription(id: string, companyId: string) {
    await this.assertSubscriptionOwnership(id, companyId);
    return this.prisma.packageSubscription.update({
      where: { id },
      data: { status: 'ACTIVE', pausedAt: null, nextBillingAt: new Date() },
    });
  }

  async cancelSubscription(id: string, companyId: string) {
    await this.assertSubscriptionOwnership(id, companyId);
    return this.prisma.packageSubscription.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
  }

  private async assertSubscriptionOwnership(id: string, companyId: string) {
    const sub = await this.prisma.packageSubscription.findFirst({ where: { id, companyId } });
    if (!sub) throw new NotFoundException('Assinatura não encontrada.');
    return sub;
  }

  // ─── Cobrança de ciclo ──────────────────────────────────────────────────

  async chargeCycle(subscriptionId: string) {
    const sub = await this.prisma.packageSubscription.findUnique({
      where: { id: subscriptionId },
      include: { package: true },
    });
    if (!sub || sub.status !== 'ACTIVE') return null;

    const cycleNumber = (await this.prisma.packageBilling.count({ where: { subscriptionId } })) + 1;
    const included = (sub.package.includedItems as unknown as IncludedItem[]) ?? [];
    const products = await this.prisma.product.findMany({
      where: { id: { in: included.map((i) => i.productId) }, companyId: sub.companyId },
      select: { id: true, name: true },
    });
    const items = included.map((inc) => {
      const p = products.find((pp) => pp.id === inc.productId);
      return {
        productId: inc.productId,
        productName: p?.name ?? 'Item do pacote',
        quantity: inc.quantity,
        unitPrice: 0, // preço embutido no valor fixo da assinatura, não por item
        notes: `Assinatura: ${sub.package.name} (ciclo ${cycleNumber})`,
      };
    });

    const price = Number(sub.package.price);
    const onlineOrder = await this.prisma.onlineOrder.create({
      data: {
        companyId: sub.companyId,
        customerName: sub.customerName ?? 'Assinante',
        customerPhone: sub.customerPhone,
        orderType: 'PICKUP',
        items: items as any,
        subtotal: price,
        deliveryFee: 0,
        discount: 0,
        total: price,
        paymentMethod: 'PIX',
        paymentStatus: 'PENDING',
        orderStatus: 'PENDING',
        notes: `Cobrança recorrente — ${sub.package.name} (ciclo ${cycleNumber})`,
      },
    });

    const billing = await this.prisma.packageBilling.create({
      data: {
        companyId: sub.companyId,
        subscriptionId: sub.id,
        cycleNumber,
        amount: price,
        status: 'PENDING',
        dueDate: new Date(),
        onlineOrderId: onlineOrder.id,
      },
    });

    // Agenda o próximo ciclo desde já — mesma lógica de qualquer cobrança
    // recorrente: a próxima data é por tempo decorrido, não por "esse aqui
    // já foi pago" (o pagamento deste ciclo é assíncrono via webhook).
    const nextBillingAt = this.addCycle(new Date(), sub.package.billingCycle as BillingCycle);
    await this.prisma.packageSubscription.update({
      where: { id: sub.id },
      data: { nextBillingAt },
    });

    try {
      const pix = await this.paymentsService.createOnlinePix(onlineOrder.id, sub.companyId);
      await this.notifyCustomer(sub, pix, cycleNumber, price);
    } catch (e: any) {
      this.logger.warn(
        `[sales-packages] falha ao gerar PIX (ciclo ${cycleNumber}, sub ${sub.id}): ${e?.message}`,
      );
    }

    return billing;
  }

  private addCycle(base: Date, cycle: BillingCycle): Date {
    const d = new Date(base);
    if (cycle === 'WEEKLY') d.setDate(d.getDate() + 7);
    else if (cycle === 'BIWEEKLY') d.setDate(d.getDate() + 14);
    else d.setMonth(d.getMonth() + 1);
    return d;
  }

  private async notifyCustomer(
    sub: { companyId: string; customerPhone: string; customerName: string | null },
    pix: { pixCopyPaste?: string; mock?: boolean },
    cycleNumber: number,
    price: number,
  ) {
    if (!this.whatsappAi || !pix.pixCopyPaste) return;
    const firstName = sub.customerName?.split(' ')[0] ?? '';
    const priceLabel = price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const msg =
      `🔁 Oi${firstName ? ` ${firstName}` : ''}! Chegou a hora do ciclo ${cycleNumber} da sua assinatura.\n\n` +
      `Valor: ${priceLabel}\n\n` +
      `Pague com o Pix Copia e Cola abaixo:\n${pix.pixCopyPaste}`;
    await this.whatsappAi
      .sendTextMessage(sub.companyId, sub.customerPhone, msg)
      .catch(() => false);
  }

  /** Chamado por PaymentsService quando o webhook confirma o pagamento de um
   *  OnlineOrder — marca a cobrança do ciclo como paga (no-op se não for uma
   *  cobrança de assinatura). */
  async markBillingPaidByOnlineOrder(onlineOrderId: string) {
    try {
      const billing = await this.prisma.packageBilling.findUnique({ where: { onlineOrderId } });
      if (!billing || billing.status === 'PAID') return;
      await this.prisma.packageBilling.update({
        where: { id: billing.id },
        data: { status: 'PAID', paidAt: new Date() },
      });
      this.logger.log(`[sales-packages] ciclo ${billing.cycleNumber} pago (sub ${billing.subscriptionId})`);
    } catch (e: any) {
      this.logger.warn(`[sales-packages] markBillingPaidByOnlineOrder falhou: ${e?.message}`);
    }
  }

  // ─── Cron diário — cobra assinaturas vencidas ──────────────────────────
  @Cron('0 8 * * *')
  async runDueBillings() {
    const due = await this.prisma.packageSubscription.findMany({
      where: { status: 'ACTIVE', nextBillingAt: { lte: new Date() } },
      select: { id: true },
    });
    if (!due.length) return;
    this.logger.log(`[sales-packages] cobrando ${due.length} assinatura(s) vencida(s)`);
    for (const s of due) {
      await this.chargeCycle(s.id).catch((e: any) =>
        this.logger.warn(`[sales-packages] cron falhou pra assinatura ${s.id}: ${e?.message}`),
      );
    }
  }
}
