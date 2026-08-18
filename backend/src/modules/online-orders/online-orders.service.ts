import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { SocketGateway } from '@/socket/socket.gateway';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { DeliveryConfigService } from '@/modules/delivery-config/delivery-config.service';
import { QrCampaignsService } from '@/modules/qr-campaigns/qr-campaigns.service';
import { LoyaltyMilestonesService } from '@/modules/loyalty-milestones/loyalty-milestones.service';
import { LoyaltyService } from '@/modules/loyalty/loyalty.service';
import { StockService } from '@/modules/stock/stock.service';
import { WhatsappAiService } from '@/modules/whatsapp-ai/whatsapp-ai.service';
import { PrintersService } from '@/modules/printers/printers.service';
import { AbandonedCartService } from '@/modules/abandoned-cart/abandoned-cart.service';
import { normalizePhoneBr } from '@/common/utils/phone';
import { isCompanyOpenNow, getNextOpening, type CompanyBusinessHours } from '@/common/utils/timezone';

const ORDER_TYPES = ['DELIVERY', 'DINE_IN', 'PICKUP'] as const;
const PAYMENT_METHODS = ['PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH'] as const;

type OnlineOrderType = (typeof ORDER_TYPES)[number];
type OnlinePaymentMethodType = (typeof PAYMENT_METHODS)[number];

export interface CreateOnlineOrderDto {
  companyId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  orderType: OnlineOrderType;
  address?: string;
  addressNumber?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  complement?: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    notes?: string;
    complements?: Array<{
      complementOptionId: string;
      complementName: string;
      optionName: string;
      price: number;
      quantity: number;
    }>;
  }>;
  subtotal: number;
  deliveryFee?: number;
  discount?: number;
  /** Quantos pontos de fidelidade o cliente quer gastar neste pedido (não o
   *  valor em R$) — debitado de verdade do saldo após o pedido persistir. */
  redeemPoints?: number;
  /** "ACCUMULATE" (padrão) — cashback deste pedido vai pro saldo, creditado
   *  quando a loja confirmar. "INSTANT" — cliente já escolheu usar o
   *  cashback como desconto neste próprio pedido (já embutido em `discount`
   *  pelo frontend, mesma taxa pública de GET /loyalty/cashback-config/public)
   *  — não credita cashback de novo na confirmação, só pontos. */
  cashbackMode?: 'ACCUMULATE' | 'INSTANT';
  total: number;
  paymentMethod: OnlinePaymentMethodType;
  notes?: string;
  /** "TOTEM" quando o pedido vem de um tablet fixo na mesa (?totem=1) */
  channel?: string;
  /** Opt-in de marketing marcado no checkout — nunca revoga se vier false/ausente. */
  marketingOptIn?: boolean;
  /** ISO datetime — cliente confirmou "agendar" sabendo que a loja está
   *  fechada agora. Sem isso, pedido com a loja fechada é rejeitado (400). */
  scheduledFor?: string;
}

@Injectable()
export class OnlineOrdersService {
  private readonly logger = new Logger(OnlineOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly socketGateway: SocketGateway,
    private readonly notifications: NotificationsService,
    private readonly deliveryConfigService: DeliveryConfigService,
    private readonly stockService: StockService,
    @Optional() private readonly qrCampaigns?: QrCampaignsService,
    @Optional() private readonly whatsappAi?: WhatsappAiService,
    @Optional() private readonly printersService?: PrintersService,
    @Optional() private readonly loyaltyMilestones?: LoyaltyMilestonesService,
    @Optional() private readonly loyaltyService?: LoyaltyService,
    @Optional() private readonly abandonedCart?: AbandonedCartService,
  ) {}

  /**
   * Creates an online order.
   *
   * Atomicity guarantee:
   * 1. Validate inputs
   * 2. Persist to DB (prisma.create — awaited, throws on failure)
   * 3. ONLY AFTER DB success → emit socket events to kitchen/dashboard
   *
   * Socket events never fire if DB write fails.
   */
  async create(dto: CreateOnlineOrderDto) {
    // ── 1. Validations ──────────────────────────────────────────────────────
    const company = await this.prisma.company.findFirst({
      where: { OR: [{ id: dto.companyId }, { slug: dto.companyId }] },
      select: { id: true, isBlocked: true, name: true, freeDeliveryAbove: true, businessHours: true },
    });

    if (!company) throw new NotFoundException('Empresa não encontrada.');
    // Normalize to real ID (slug may have been passed)
    dto.companyId = company.id;
    if (company.isBlocked)
      throw new BadRequestException('Empresa não está aceitando pedidos.');
    if (!dto.items?.length) throw new BadRequestException('Pedido sem itens.');

    // ── Horário de funcionamento — achado real: pedido aceito com a loja
    // fechada há 40min, cozinha só percebeu depois. Gate SEMPRE no backend
    // (nunca confia no relógio do navegador do cliente pra isso) — o
    // frontend já deve esconder o botão de pedido imediato quando fechado
    // (GET /company/business-status/public), mas essa é a trava real.
    // `scheduledFor` = cliente confirmou explicitamente "agendar sabendo
    // que está fechado" — passa direto, sem bloquear.
    let scheduledFor: Date | null = null;
    const businessHours = company.businessHours as CompanyBusinessHours | null;
    if (!isCompanyOpenNow(businessHours)) {
      if (!dto.scheduledFor) {
        const next = getNextOpening(businessHours);
        throw new BadRequestException(
          next
            ? `Estamos fechados agora. Reabrimos ${next.label} — você pode agendar seu pedido pra esse horário.`
            : 'Estamos fechados agora e sem horário de funcionamento configurado. Tente novamente mais tarde.',
        );
      }
      scheduledFor = new Date(dto.scheduledFor);
    }

    const subtotal = Number(dto.subtotal);
    let deliveryFee = Number(dto.deliveryFee ?? 0);
    const discount = Number(dto.discount ?? 0);
    const orderType = ORDER_TYPES.includes(dto.orderType)
      ? dto.orderType
      : 'DELIVERY';
    if (
      orderType === 'DELIVERY' &&
      (!dto.address?.trim() || !dto.addressNumber?.trim())
    ) {
      throw new BadRequestException(
        'Endereço de entrega incompleto — rua e número são obrigatórios.',
      );
    }
    const paymentMethod = PAYMENT_METHODS.includes(dto.paymentMethod)
      ? dto.paymentMethod
      : 'PIX';

    // Zone lookup: resolve real deliveryFee for DELIVERY orders (menu always sends 0)
    let deliveryZoneId: string | undefined;
    // Repasse do entregador — snapshot da zona no momento da criação, mesmo
    // padrão de Order.driverFee (item 76). Sem isso, DriverEarning nunca
    // tinha de onde tirar o valor pra pedido do cardápio digital.
    let driverFee: number | undefined;
    if (orderType === 'DELIVERY') {
      const addressLine = [dto.address, dto.addressNumber, dto.neighborhood, dto.city]
        .filter(Boolean)
        .join(', ');
      const zone = await this.deliveryConfigService.resolveDeliveryFee(dto.companyId, {
        neighborhood: dto.neighborhood,
        addressLine: addressLine || null,
      });
      if (zone) {
        if (deliveryFee === 0) deliveryFee = Number(zone.clientFee);
        deliveryZoneId = zone.id;
        driverFee = Number(zone.driverShare);
      }
      // Frete grátis (Company.freeDeliveryAbove) — campo existia desde a Fase
      // A de Entrega mas nunca era lido em lugar nenhum (configurável em
      // Configurações→Entrega, sem nenhum efeito real). Autoritativo aqui:
      // nunca confia no `deliveryFee` que o frontend mandou pra decidir isso,
      // sempre reconfere contra o subtotal real do pedido.
      if (
        company.freeDeliveryAbove != null &&
        subtotal >= Number(company.freeDeliveryAbove)
      ) {
        deliveryFee = 0;
      }
    }

    const total = subtotal - discount + deliveryFee;

    if (!isFinite(total) || total <= 0) {
      throw new BadRequestException('Valor total inválido.');
    }

    // ── 1a. Idempotência — evita pedido duplicado quando a resposta se perde
    // por queda de conexão e o cliente reenvia o mesmo carrinho. Janela curta
    // (20s) e comparação por telefone+total: suficiente pra pegar retry de
    // rede sem bloquear um segundo pedido legítimo do mesmo cliente.
    const recentDuplicate = await this.prisma.onlineOrder.findFirst({
      where: {
        companyId: dto.companyId,
        customerPhone: dto.customerPhone.trim(),
        total,
        createdAt: { gte: new Date(Date.now() - 20_000) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recentDuplicate) {
      this.logger.warn(
        `[OnlineOrder] possível reenvio duplicado — retornando pedido existente ${recentDuplicate.id}`,
      );
      return recentDuplicate;
    }

    // ── 1b. Disponibilidade de estoque em tempo real ────────────────────────
    // Soma o consumo de ingrediente exigido por todos os itens do carrinho
    // (produtos sem receita cadastrada não entram na checagem — mesma regra
    // do PDV: "sem receita → não consome/não bloqueia"). Bloqueia a criação
    // do pedido se faltar estoque de algum ingrediente, ao invés de aceitar
    // a venda e nunca decrementar nada (bug anterior).
    {
      const neededByIngredient = new Map<string, number>();
      const nameByIngredient = new Map<string, string>();
      for (const item of dto.items) {
        const recipe = await this.prisma.recipe.findFirst({
          where: { productId: item.productId },
          include: { items: { include: { ingredient: true } } },
        });
        if (!recipe) continue;
        for (const ri of recipe.items) {
          const qty = Number(ri.quantity) * Number(item.quantity || 1);
          neededByIngredient.set(
            ri.ingredientId,
            (neededByIngredient.get(ri.ingredientId) || 0) + qty,
          );
          nameByIngredient.set(ri.ingredientId, ri.ingredient.name);
        }
      }
      for (const [ingredientId, needed] of neededByIngredient) {
        const ingredient = await this.prisma.ingredient.findFirst({
          where: { id: ingredientId, companyId: dto.companyId },
          select: { stock: true, allowNegativeStock: true, name: true },
        });
        if (!ingredient) continue;
        if (
          Number(ingredient.stock) < needed &&
          !ingredient.allowNegativeStock
        ) {
          throw new BadRequestException(
            `"${nameByIngredient.get(ingredientId) || ingredient.name}" está com estoque insuficiente no momento. Remova ou ajuste a quantidade do item e tente novamente.`,
          );
        }
      }
    }

    // ── 1c. Validação server-side de complementos (Fase A — Item 4) ────────
    // Garante required / minOptions / maxOptions / multipleChoice mesmo
    // que o frontend seja burlado. Tudo filtrado por companyId.
    for (const item of dto.items) {
      const groups: any[] = await this.prisma.complement.findMany({
        where: {
          productId: item.productId,
          companyId: dto.companyId,
          isActive: true,
        },
        include: { options: { where: { isActive: true } } },
      });
      if (groups.length === 0) continue;

      // Indexa seleções recebidas por complementName (snapshot enviado pelo client)
      const sentByGroup = new Map<string, Array<{ id: string; qty: number }>>();
      for (const c of item.complements ?? []) {
        const arr = sentByGroup.get(c.complementName) ?? [];
        arr.push({ id: c.complementOptionId, qty: Number(c.quantity) || 1 });
        sentByGroup.set(c.complementName, arr);
      }

      for (const g of groups) {
        const sent = sentByGroup.get(g.name) ?? [];
        const count = sent.length;

        if (g.required && count < Math.max(1, g.minOptions || 1)) {
          throw new BadRequestException(
            `Complemento "${g.name}" é obrigatório para "${item.productName}" (mínimo ${g.minOptions || 1}).`,
          );
        }
        if (count > 0 && g.minOptions > 0 && count < g.minOptions) {
          throw new BadRequestException(
            `Selecione ao menos ${g.minOptions} em "${g.name}".`,
          );
        }
        if (g.maxOptions > 0 && count > g.maxOptions) {
          throw new BadRequestException(
            `Máximo ${g.maxOptions} em "${g.name}" (recebido ${count}).`,
          );
        }
        if (!g.multipleChoice && count > 1) {
          throw new BadRequestException(`"${g.name}" aceita apenas 1 escolha.`);
        }
        // Cada opção enviada precisa existir no grupo (anti-spoof de ID)
        const validIds = new Set<string>(g.options.map((o: any) => o.id));
        for (const s of sent) {
          if (!validIds.has(s.id)) {
            throw new BadRequestException(`Opção inválida em "${g.name}".`);
          }
        }
      }
    }

    // ── 2. Persist to database ─────────────────────────────────────────────
    // This is the ONLY source of truth. Events fire only after this resolves.
    const order = await this.prisma.onlineOrder.create({
      data: {
        companyId: dto.companyId,
        customerName: dto.customerName.trim(),
        customerPhone: dto.customerPhone.trim(),
        customerEmail: dto.customerEmail?.trim() || null,
        orderType,
        address: dto.address?.trim() || null,
        addressNumber: dto.addressNumber?.trim() || null,
        neighborhood: dto.neighborhood?.trim() || null,
        city: dto.city?.trim() || null,
        state: dto.state?.trim() || null,
        zipcode: dto.zipcode?.trim() || null,
        complement: dto.complement?.trim() || null,
        scheduledFor,
        items: dto.items as any,
        subtotal,
        deliveryFee,
        discount,
        total,
        paymentMethod,
        notes: dto.notes?.trim() || null,
        channel: dto.channel === 'TOTEM' ? 'TOTEM' : 'ONLINE',
        instantCashbackApplied: dto.cashbackMode === 'INSTANT',
        driverFee,
      },
    });

    // ── 3. Post-persistence side-effects (non-blocking, guarded) ───────────
    // These run ONLY because the DB write above succeeded.
    // Errors here are logged but do NOT roll back or affect the response.
    setImmediate(() => {
      try {
        // → Marca opt-in de marketing (se o cliente marcou a caixa no checkout).
        // Nunca roda síncrono com o pedido — não pode atrasar/derrubar a compra.
        this.syncCustomerOptIn(
          dto.companyId,
          dto.customerPhone,
          dto.customerName,
          dto.marketingOptIn,
        ).catch((e: any) =>
          this.logger.warn(`[OnlineOrder] syncCustomerOptIn falhou: ${e?.message}`),
        );

        // → Resgate de pontos de fidelidade (se o cliente marcou "usar pontos"
        // no checkout) — debita o saldo de verdade; antes o desconto era só
        // um número calculado no frontend, nunca decrementado no backend.
        if (this.loyaltyService && dto.redeemPoints && dto.redeemPoints > 0) {
          this.loyaltyService
            .applyPointsDiscount(dto.companyId, dto.customerPhone, dto.redeemPoints, order.id)
            .catch((e: any) =>
              this.logger.warn(`[OnlineOrder] resgate de pontos falhou: ${e?.message}`),
            );
        }

        // → Kitchen screen picks up new order
        this.socketGateway.emitOrderCreated(order);

        // → Dashboard KPI counters refresh
        this.socketGateway.emitDashboardUpdate(dto.companyId, {
          event: 'onlineOrderCreated',
          orderId: order.id,
          total,
        });

        this.logger.log(
          `[OnlineOrder] id=${order.id} company=${dto.companyId} ` +
            `total=${total} type=${orderType} — socket events emitted`,
        );

        // ── QR Recovery: gerar cupom para pedidos do cardápio próprio ──────
        if (this.qrCampaigns) {
          const qrSvc = this.qrCampaigns;
          const prisma = this.prisma;
          const logger = this.logger;
          void (async () => {
            try {
              const count = await prisma.onlineOrder.count({
                where: { companyId: dto.companyId, customerPhone: dto.customerPhone },
              });
              const isFirstOrder = count <= 1;
              const qr = await qrSvc.generateForOrder({
                companyId:     dto.companyId,
                orderId:       order.id,
                orderSource:   'PROPRIO',
                customerName:  dto.customerName,
                customerPhone: dto.customerPhone,
                isFirstOrder,
              });
              if (qr) logger.log(`[QR] token=${qr.token} gerado para onlineOrder=${order.id}`);
            } catch (e: any) {
              logger.warn(`[QR] falha ao gerar cupom: ${e?.message}`);
            }
          })();
        }

        // ── Cliente Fiel — detectar marco de N pedidos (fire-and-forget) ────
        if (this.loyaltyMilestones) {
          const loyaltyMilestones = this.loyaltyMilestones;
          const logger = this.logger;
          void loyaltyMilestones
            .checkAndRegisterMilestone(dto.companyId, dto.customerPhone, dto.customerName)
            .catch((e: any) => logger.warn(`[ClienteFiel] falha ao checar marco: ${e?.message}`));
        }

        // → Carrinho abandonado: se existia um episódio em aberto pra esse
        // telefone, fecha ele agora — o cliente completou a compra por este
        // mesmo canal, nunca deve receber o lembrete de "você esqueceu algo".
        if (this.abandonedCart) {
          this.abandonedCart
            .markRecovered(dto.companyId, dto.customerPhone)
            .catch((e: any) => this.logger.warn(`[CarrinhoAbandonado] falha ao marcar recuperado: ${e?.message}`));
        }

        // → New order confirmation email (fire-and-forget — never blocks the order)
        if (order.customerEmail) {
          this.notifications
            .send({
              to: order.customerEmail,
              type: 'NEW_ORDER',
              data: {
                orderId: order.id.slice(-8).toUpperCase(),
                customerName: order.customerName,
                total: Number(order.total).toFixed(2),
                orderType: order.orderType,
              },
            })
            .catch((e: any) =>
              this.logger.warn(`[OnlineOrder] email failed: ${e?.message}`),
            );
        }

        // → Resumo do pedido pro CLIENTE via WhatsApp (fire-and-forget, nunca
        // atrasa/derruba a compra). Fecha o gap real: até aqui, o cliente só
        // recebia confirmação por e-mail (nem sempre preenchido) — se ninguém
        // no estabelecimento notasse o pedido, o cliente também não tinha
        // nenhum sinal de que o pedido foi recebido.
        if (this.whatsappAi && order.customerPhone) {
          const itemsLines = (dto.items || [])
            .map((i) => `• ${i.quantity}x ${i.productName}`)
            .join('\n');
          const enderecoLine =
            orderType === 'DELIVERY'
              ? `\n📍 Entrega: ${[dto.address, dto.addressNumber, dto.neighborhood].filter(Boolean).join(', ')}`
              : orderType === 'DINE_IN'
                ? ''
                : '\n🏪 Retirada no balcão';
          // Pedido agendado (loja fechada no momento da compra) nunca deve
          // soar como "chegando já" — mensagem própria, sem prometer preparo
          // imediato nem hora de entrega que ainda não vai começar a contar.
          const resumo = order.scheduledFor
            ? `📅 *Pedido agendado!* #${order.id.slice(-6).toUpperCase()}\n\n` +
              `${itemsLines}\n\n` +
              `*Total: R$ ${Number(order.total).toFixed(2)}*${enderecoLine}\n\n` +
              `Sua loja está fechada agora — vamos preparar assim que reabrirmos. Obrigado pela preferência! 🍕`
            : `✅ *Pedido recebido!* #${order.id.slice(-6).toUpperCase()}\n\n` +
              `${itemsLines}\n\n` +
              `*Total: R$ ${Number(order.total).toFixed(2)}*${enderecoLine}\n\n` +
              `Assim que confirmarmos o preparo, avisamos por aqui. Obrigado pela preferência! 🍕`;
          this.whatsappAi
            .sendTextMessage(dto.companyId, order.customerPhone, resumo)
            .catch((e: any) =>
              this.logger.warn(`[OnlineOrder] resumo WhatsApp falhou: ${e?.message}`),
            );
        }

        // → Impressão automática via Printer Agent — mesma regra de
        // orders.service.ts (PDV), que até aqui nunca disparava pra pedidos
        // do cardápio digital/totem. Só enfileira se houver Agent online.
        // Pedido agendado NUNCA imprime na hora — imprimiria um ticket de
        // "preparar agora" horas antes de precisar, cozinha perderia o
        // controle de prioridade. Fica só registrado, sem trigger de cozinha,
        // até alguém (staff) confirmar o pedido manualmente mais perto da
        // hora — liberar isso sozinho por horário fica pra uma sessão futura
        // se virar dor real (hoje é decisão consciente, não esquecimento).
        if (!order.scheduledFor) {
          this.enqueuePrintJobs(dto.companyId, order, dto).catch((e: any) =>
            this.logger.warn(`[OnlineOrder] falha ao enfileirar impressão: ${e?.message}`),
          );
        }
      } catch (err: any) {
        // Socket failure must never affect the already-created order
        this.logger.warn(`[OnlineOrder] socket emit failed: ${err?.message}`);
      }
    });

    return order;
  }

  /**
   * Enfileira PrinterJob pro pedido do cardápio digital/totem — mesma regra
   * de setores de orders.service.ts (categoryType "bebidas" → BAR, resto →
   * KITCHEN, sempre gera COUNTER, gera DELIVERY se for entrega). Totem não
   * gera COUNTER (pré-conta não faz sentido pro cliente que já está na loja
   * — mesma regra já aplicada no PrintRouterService do frontend). O
   * enfileiramento em si delega pro PrintersService.enqueueSectorJobs, que
   * deduplica por impressora física — loja com 1 impressora só (perfis
   * KITCHEN/COUNTER/DELIVERY todos apontando pra ela) recebe só 1 ticket
   * por pedido, não 3.
   */
  private async enqueuePrintJobs(
    companyId: string,
    order: { id: string; total: unknown; paymentMethod: string; orderType: string },
    dto: CreateOnlineOrderDto,
  ) {
    if (!this.printersService) return;
    if (!this.printersService.getAgentStatus(companyId).online) return;

    const items = Array.isArray(dto.items) ? dto.items : [];
    if (items.length === 0) return;

    const productIds = items.map((it) => it.productId);
    const [products, company] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, category: { select: { categoryType: true } } },
      }),
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true },
      }),
    ]);
    const typeMap = new Map(
      products.map((p) => [p.id, p.category?.categoryType ?? 'normal']),
    );

    const kitchenItems: any[] = [];
    const barItems: any[] = [];
    for (const item of items) {
      const bucket =
        typeMap.get(item.productId) === 'bebidas' ? barItems : kitchenItems;
      bucket.push({ quantity: item.quantity, name: item.productName });
    }

    const deliveryAddress = [dto.address, dto.addressNumber, dto.neighborhood, dto.city]
      .filter(Boolean)
      .join(', ');

    const basePayload = {
      companyName: company?.name,
      orderNumber: order.id.slice(-6).toUpperCase(),
      source: dto.channel === 'TOTEM' ? 'TOTEM' : 'ONLINE',
      orderType: order.orderType,
      time: new Date().toLocaleTimeString('pt-BR'),
      total: Number(order.total),
      paymentMethod: order.paymentMethod,
      deliveryAddress,
    };

    const isTotem = dto.channel === 'TOTEM';
    const sectorJobs: Array<{ role: 'KITCHEN' | 'BAR' | 'COUNTER' | 'DELIVERY'; items: any[] }> = [];
    if (kitchenItems.length) sectorJobs.push({ role: 'KITCHEN', items: kitchenItems });
    if (barItems.length) sectorJobs.push({ role: 'BAR', items: barItems });
    if (!isTotem) sectorJobs.push({ role: 'COUNTER', items: [...kitchenItems, ...barItems] });
    if (order.orderType === 'DELIVERY') {
      sectorJobs.push({ role: 'DELIVERY', items: [...kitchenItems, ...barItems] });
    }

    await this.printersService.enqueueSectorJobs(
      companyId,
      order.id,
      sectorJobs,
      basePayload,
    );
  }

  /**
   * Marca marketingOptIn=true no Customer correspondente ao telefone do
   * pedido, quando o cliente marcou a caixa de opt-in no checkout do
   * cardápio digital. Nunca escreve `false` — ausência/desmarcado apenas
   * não mexe no que já existe (evita revogar consentimento dado antes por
   * outro canal, ex.: "Adicionar Contatos" do admin ou pedido anterior).
   */
  private async syncCustomerOptIn(
    companyId: string,
    rawPhone: string,
    name: string,
    marketingOptIn?: boolean,
  ) {
    if (!marketingOptIn) return;
    const phone = normalizePhoneBr(rawPhone);
    if (!phone || phone.length < 10) return;

    const existing = await this.prisma.customer.findFirst({
      where: { companyId, phone },
    });
    if (existing) {
      if (!existing.marketingOptIn) {
        await this.prisma.customer.update({
          where: { id: existing.id },
          data: { marketingOptIn: true },
        });
      }
    } else {
      await this.prisma.customer.create({
        data: {
          companyId,
          phone,
          name: name?.trim() || phone,
          marketingOptIn: true,
        },
      });
    }
  }

  /**
   * Polling do cliente público — retorna apenas info de status.
   * Sem endereço, itens ou dados pessoais. orderId é o "segredo" (cuid 25 chars).
   */
  async getPublicStatus(id: string) {
    const order = await this.prisma.onlineOrder.findUnique({
      where: { id },
      select: {
        id: true,
        orderStatus: true,
        paymentStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado.');
    return order;
  }

  async findOne(id: string, companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { OR: [{ id: companyId }, { slug: companyId }] },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('Empresa nao encontrada.');

    const order = await this.prisma.onlineOrder.findFirst({
      where: { id, companyId: company.id },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado.');
    return order;
  }

  async findByCompany(companyId: string, limit = 50) {
    return this.prisma.onlineOrder.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async updatePayment(
    id: string,
    data: {
      paymentStatus?:
        | 'PENDING'
        | 'APPROVED'
        | 'REJECTED'
        | 'REFUNDED'
        | 'EXPIRED';
      mercadopagoPaymentId?: string;
      mercadopagoPreferenceId?: string;
      pixQrcode?: string;
      pixCopyPaste?: string;
      pixExpiresAt?: Date;
      paidAt?: Date;
    },
  ) {
    const order = await this.prisma.onlineOrder.update({ where: { id }, data });

    // After payment confirmation → emit to kitchen (PIX approved, etc.)
    setImmediate(() => {
      try {
        this.socketGateway.emitOnlineOrderPaid(order.companyId, {
          orderId: id,
          paymentStatus: data.paymentStatus,
        });
      } catch {}
    });

    return order;
  }

  async updateOrderStatus(id: string, orderStatus: string) {
    const updated = await this.prisma.onlineOrder.update({
      where: { id },
      data: { orderStatus: orderStatus as any },
    });

    // Pagamento já foi capturado pelo gateway nesse ponto (webhook) — não dá
    // pra "rejeitar" a confirmação por falta de estoque. Só registra e loga
    // pra o lojista resolver manualmente (fire-and-forget, nunca bloqueia).
    if (orderStatus === 'CONFIRMED') {
      this.consumeStockForOrder(id, updated.companyId).catch((e: any) =>
        this.logger.warn(`[OnlineOrder] consumo de estoque falhou (${id}): ${e?.message}`),
      );
    } else if (orderStatus === 'CANCELED') {
      this.restoreStockForOrder(id, updated.companyId).catch((e: any) =>
        this.logger.warn(`[OnlineOrder] restauração de estoque falhou (${id}): ${e?.message}`),
      );
    }

    return updated;
  }

  /**
   * Consome os ingredientes da receita de cada item do pedido, uma única vez
   * por pedido (idempotente via StockMovement.referenceId — protege contra
   * chamada dupla vinda do webhook de pagamento E de uma ação manual da
   * cozinha para o mesmo pedido). Produtos sem receita não consomem nada,
   * mesma regra do PDV.
   */
  async consumeStockForOrder(id: string, companyId: string, userId = 'SYSTEM') {
    const already = await this.prisma.stockMovement.findFirst({
      where: { referenceId: id, referenceType: 'ONLINE_ORDER' },
      select: { id: true },
    });
    if (already) return;

    const order = await this.prisma.onlineOrder.findFirst({ where: { id, companyId } });
    if (!order) return;
    const items: any[] = Array.isArray(order.items) ? (order.items as any[]) : [];

    await this.prisma.$transaction(
      async (tx) => {
        for (const item of items) {
          if (!item?.productId) continue;
          const recipe = await tx.recipe.findFirst({
            where: { productId: item.productId },
            include: { items: { include: { ingredient: true } } },
          });
          if (!recipe) continue;
          for (const recipeItem of recipe.items) {
            const qty = Number(recipeItem.quantity) * Number(item.quantity || 1);
            await this.stockService.consumeIngredientTransactional(tx, {
              ingredientId: recipeItem.ingredientId,
              quantity: qty,
              companyId,
              performedById: userId,
              reason: `Consumo automático pedido online ${id}`,
              referenceId: id,
              referenceType: 'ONLINE_ORDER',
            });
          }
        }
      },
      { isolationLevel: 'Serializable' },
    );
  }

  /** Reverte o consumo feito por consumeStockForOrder — só age se algo foi de fato consumido. */
  async restoreStockForOrder(id: string, companyId: string, userId = 'SYSTEM') {
    const consumed = await this.prisma.stockMovement.findMany({
      where: { referenceId: id, referenceType: 'ONLINE_ORDER', type: 'SALE' },
    });
    if (consumed.length === 0) return;
    const alreadyRestored = await this.prisma.stockMovement.findFirst({
      where: { referenceId: id, referenceType: 'ONLINE_ORDER', type: 'RETURN' },
    });
    if (alreadyRestored) return;

    await this.prisma.$transaction(
      async (tx) => {
        for (const m of consumed) {
          if (!m.ingredientId) continue;
          await this.stockService.restoreIngredientTransactional(tx, {
            ingredientId: m.ingredientId,
            quantity: Number(m.quantity),
            companyId,
            performedById: userId,
            reason: `Cancelamento pedido online ${id}`,
            referenceId: id,
            referenceType: 'ONLINE_ORDER',
          });
        }
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
