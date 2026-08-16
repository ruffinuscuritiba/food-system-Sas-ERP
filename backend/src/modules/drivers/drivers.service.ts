import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';
import { OrdersService } from '@/modules/orders/orders.service';
import { SocketGateway } from '@/socket/socket.gateway';
import { getStartOfTodayBrazil } from '@/common/utils/timezone';
import { WhatsappAiService } from '@/modules/whatsapp-ai/whatsapp-ai.service';
import { TrackingGateway } from '@/modules/tracking/tracking.gateway';

const DRIVER_INVITE_PURPOSE = 'driver_invite';

@Injectable()
export class DriversService {
  constructor(
    private prisma: PrismaService,
    private ordersService: OrdersService,
    private socketGateway: SocketGateway,
    private jwtService: JwtService,
    private config: ConfigService,
    @Optional() private whatsappAiService?: WhatsappAiService,
    @Optional() private trackingGateway?: TrackingGateway,
  ) {}

  // Notifica o entregador assim que ele é selecionado no painel (despacho
  // inicial OU troca de entregador) — antes disso o entregador só ficava
  // sabendo abrindo o app manualmente/reiniciando-o. 2 canais: (1) socket em
  // tempo real (driver:orderAssigned, sala driver:${driverId}) — o app do
  // entregador escuta e recarrega a lista sozinho, sem precisar sair/entrar
  // de novo (achado real: 15/08/2026); (2) WhatsApp, fire-and-forget, nunca
  // atrasa nem derruba a atribuição se falhar (mesmo padrão de
  // sendOrderNotification já usado pra avisar o cliente).
  private notifyDriverAssignment(
    driverId: string,
    driver: { phone: string | null; name?: string | null },
    order: { id: string; number: number; deliveryAddress: string | null; neighborhood: string | null; customerName: string | null },
    companyId: string,
  ) {
    this.trackingGateway?.emitOrderAssignedToDriver(driverId, {
      orderId: order.id,
      orderNumber: order.number || null,
    });

    const address = order.deliveryAddress || order.neighborhood || '';
    // OnlineOrder não tem número sequencial (esse campo é exclusivo de
    // Order/PDV, ver item 95 do CLAUDE.md) — sem esse fallback, o WhatsApp
    // pro entregador mostraria sempre "#0" pra qualquer pedido do cardápio.
    const orderLabel = order.number
      ? `#${order.number}`
      : `#${order.id.slice(-6).toUpperCase()}`;
    if (!this.whatsappAiService || !driver.phone) {
      // Sem WhatsApp configurado ou entregador sem telefone cadastrado —
      // mesmo alerta de falha que uma falha de envio real, porque o efeito
      // pro entregador é idêntico: ele nunca soube do pedido/endereço.
      this.socketGateway.emitDriverNotificationFailed(companyId, {
        orderId: order.id,
        orderNumber: order.number,
        driverName: driver.name ?? null,
        driverPhone: driver.phone ?? '',
        address,
      });
      return;
    }
    setImmediate(async () => {
      const mapsLink = address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
        : null;
      const lines = [
        `🛵 Novo pedido pra você — ${orderLabel}`,
        order.customerName ? `Cliente: ${order.customerName}` : null,
        address ? `Endereço: ${address}` : null,
        mapsLink ? `Ver rota: ${mapsLink}` : null,
      ].filter(Boolean);
      // sendTextMessage() nunca rejeita (dispatchMessage engole o erro e
      // resolve `false`) — por isso o `.catch(()=>{})` de antes nunca disparava
      // e a falha real ficava 100% invisível (só um log.error no backend, sem
      // ninguém no painel saber). Checar o retorno é o que faltava.
      let sent = false;
      try {
        sent = await this.whatsappAiService!.sendTextMessage(
          companyId,
          driver.phone!,
          lines.join('\n'),
        );
      } catch {
        sent = false;
      }
      if (!sent) {
        this.socketGateway.emitDriverNotificationFailed(companyId, {
          orderId: order.id,
          orderNumber: order.number,
          driverName: driver.name ?? null,
          driverPhone: driver.phone!,
          address,
        });
      }
    });
  }

  // FIX: agora retorna, para cada entregador, quantas entregas ele já
  // finalizou (_count.orders, filtrado por status DELIVERED) e o total já
  // pago em ganhos (totalEarnings, somando DriverEarning com status PAID).
  // Antes o findAll não trazia nenhum desses dados — por isso a tela de
  // entregadores mostrava sempre "—" nos cards de Entregas e Ganhos.
  async findAll(companyId: string) {
    // "Entregas" no card é contagem DIÁRIA (zera todo dia) -- sem o filtro
    // de data era um total acumulado desde sempre, e um entregador que
    // entregou ontem continuava aparecendo com a mesma contagem hoje,
    // como se tivesse entregue de novo sem ter saído pra rua.
    //
    // Dois fixes em cima do fix original: (1) `new Date(); setHours(0,0,0,0)`
    // usa o fuso do CONTAINER (UTC no VPS), não o de Brasília — perto da
    // meia-noite UTC (21h em Brasília) isso incluía/excluía pedidos do dia
    // errado (achado real: "não dá pra saber se foi a de ontem que não
    // zerou"); trocado por getStartOfTodayBrazil(). (2) o filtro era por
    // `createdAt` (quando o PEDIDO foi criado), não por quando a entrega foi
    // de fato concluída — um pedido criado ontem à noite e entregue já
    // hoje de manhã nunca contava; trocado pra `deliveredAt`, o campo que
    // realmente representa "quando essa entrega aconteceu".
    const startOfToday = getStartOfTodayBrazil();

    const drivers = await this.prisma.driverProfile.findMany({
      where: { companyId },
      include: {
        user: { select: { id: true, name: true, email: true, isActive: true } },
        _count: {
          select: {
            orders: {
              where: { status: 'DELIVERED', deliveredAt: { gte: startOfToday } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Soma os ganhos já pagos de cada entregador numa única query agregada
    // (evita N+1 — uma query só, não uma por entregador)
    const earningsByDriver = await this.prisma.driverEarning.groupBy({
      by: ['driverProfileId'],
      where: { companyId, status: 'PAID' },
      _sum: { driverAmount: true },
    });
    const earningsMap = new Map(
      earningsByDriver.map((e) => [
        e.driverProfileId,
        Number(e._sum.driverAmount ?? 0),
      ]),
    );

    return drivers.map((d) => ({
      ...d,
      totalEarnings: earningsMap.get(d.id) ?? 0,
    }));
  }

  findOne(id: string, companyId: string) {
    return this.prisma.driverProfile.findFirst({
      where: { id, companyId },
      include: {
        user: { select: { id: true, name: true, email: true, isActive: true } },
        orders: {
          where: {
            status: {
              in: ['CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'],
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  /**
   * Lista de entregas concluídas HOJE por um entregador — alimenta o clique
   * no número do card "Entregas" (antes só existia a contagem, sem jeito de
   * abrir e conferir quais pedidos são, mesmo pedido de usuário real depois
   * de ver a contagem parecer "errada"). Mesmo filtro/fuso de `findAll()`.
   */
  async listTodayDeliveries(driverId: string, companyId: string) {
    const startOfToday = getStartOfTodayBrazil();
    const orders = await this.prisma.order.findMany({
      where: {
        companyId,
        driverId,
        status: 'DELIVERED',
        deliveredAt: { gte: startOfToday },
      },
      select: {
        id: true,
        number: true,
        customerName: true,
        customerPhone: true,
        customer: { select: { name: true, phone: true } },
        deliveryAddress: true,
        total: true,
        driverFee: true,
        deliveredAt: true,
        createdAt: true,
      },
      orderBy: { deliveredAt: 'desc' },
    });

    return orders.map((o) => ({
      id: o.id,
      number: o.number,
      customerName: o.customerName ?? o.customer?.name ?? null,
      customerPhone: o.customerPhone ?? o.customer?.phone ?? null,
      deliveryAddress: o.deliveryAddress,
      total: Number(o.total),
      driverFee: o.driverFee != null ? Number(o.driverFee) : null,
      deliveredAt: o.deliveredAt,
      createdAt: o.createdAt,
    }));
  }

  async create(companyId: string, data: any) {
    const { name, email, password, phone, vehicleType, vehiclePlate } = data;

    const bcrypt = await import('bcrypt');
    const hashed = await bcrypt.hash(password || 'Entregador@123', 10);

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role: 'DELIVERY',
        isActive: true,
        companyId,
      },
    });

    return this.prisma.driverProfile.create({
      data: {
        userId: user.id,
        phone,
        vehicleType,
        vehiclePlate,
        companyId,
      },
      include: {
        user: { select: { id: true, name: true, email: true, isActive: true } },
      },
    });
  }

  async update(id: string, companyId: string, data: any) {
    const profile = await this.prisma.driverProfile.findFirst({
      where: { id, companyId },
    });
    if (!profile) throw new NotFoundException('Entregador não encontrado');

    const { name, isActive, phone, vehicleType, vehiclePlate, isAvailable } =
      data;

    if (name || isActive !== undefined) {
      await this.prisma.user.update({
        where: { id: profile.userId },
        data: {
          ...(name && { name }),
          ...(isActive !== undefined && { isActive }),
        },
      });
    }

    return this.prisma.driverProfile.update({
      where: { id },
      data: {
        ...(phone !== undefined && { phone }),
        ...(vehicleType !== undefined && { vehicleType }),
        ...(vehiclePlate !== undefined && { vehiclePlate }),
        ...(isAvailable !== undefined && { isAvailable }),
      },
      include: {
        user: { select: { id: true, name: true, email: true, isActive: true } },
      },
    });
  }

  async updateLocation(id: string, lat: number, lng: number) {
    return this.prisma.driverProfile.update({
      where: { id },
      data: { currentLat: lat, currentLng: lng },
    });
  }

  // Cobre 2 casos com o mesmo endpoint (o painel usa o mesmo seletor de
  // entregador nos dois): (1) despacho inicial — pedido READY sem
  // entregador, assume + avança pra OUT_FOR_DELIVERY (dispara estoque/
  // notificação via OrdersService, como sempre fez); (2) reatribuição —
  // pedido já tem um entregador (normalmente já OUT_FOR_DELIVERY), só troca
  // quem está levando, SEM re-rodar a máquina de status/estoque/WhatsApp
  // (já rodou na 1ª atribuição — repetir mandaria "saiu para entrega" de
  // novo pro cliente e tentaria consumir estoque uma 2ª vez).
  async assignOrder(
    orderId: string,
    driverId: string,
    companyId: string,
    userId: string,
    source?: string,
  ) {
    const driver = await this.prisma.driverProfile.findFirst({
      where: { id: driverId, companyId },
      include: { user: { select: { name: true } } },
    });
    if (!driver) throw new NotFoundException('Entregador não encontrado');

    // Pedido do cardápio digital/totem vive na tabela OnlineOrder, não Order
    // — sem esse desvio, a busca abaixo nunca encontrava nada e o painel
    // sempre dava 404 "Pedido não encontrado" pra qualquer pedido ONLINE
    // (achado real: 13/08/2026, todo pedido do cardápio ficava impossível
    // de despachar pra um entregador).
    if (source === 'ONLINE') {
      return this.assignOnlineOrder(orderId, driverId, companyId, userId, {
        phone: driver.phone,
        name: driver.user?.name ?? null,
      });
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, companyId },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado');

    const isInitialDispatch =
      order.driverId === null && order.status === OrderStatus.READY;

    await this.prisma.order.update({
      where: { id: orderId },
      data: { driverId, assignedAt: new Date() },
    });

    this.notifyDriverAssignment(
      driverId,
      { phone: driver.phone, name: driver.user?.name ?? null },
      order,
      companyId,
    );

    if (isInitialDispatch) {
      // Delegate status transition via OrdersService (stock, socket, loyalty, audit)
      return this.ordersService.updateStatus(
        orderId,
        OrderStatus.OUT_FOR_DELIVERY,
        userId,
        companyId,
      );
    }

    // Reatribuição: só avisa quem está olhando o rastreamento em tempo real.
    this.socketGateway.emitOrderStatusChanged(orderId, {
      status: order.status,
      source: 'PDV',
    });
    return this.prisma.order.findFirst({
      where: { id: orderId },
      include: { customer: true },
    });
  }

  // Espelha assignOrder() acima pra pedidos ONLINE (cardápio digital/totem) —
  // tabela e enum de status diferentes (OnlineOrder.orderStatus), então não
  // dá pra só reaproveitar a query de Order. mapeamento de endereço replica
  // exatamente a mesma concatenação de orders.service.ts findAllForKitchen().
  private async assignOnlineOrder(
    orderId: string,
    driverId: string,
    companyId: string,
    userId: string,
    driver: { phone: string | null; name: string | null },
  ) {
    const order = await this.prisma.onlineOrder.findFirst({
      where: { id: orderId, companyId },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado');

    const isInitialDispatch =
      order.driverId === null && order.orderStatus === 'READY';

    await this.prisma.onlineOrder.update({
      where: { id: orderId },
      data: { driverId, assignedAt: new Date() },
    });

    const deliveryAddress =
      [order.address, order.addressNumber, order.neighborhood, order.city]
        .filter(Boolean)
        .join(', ') || null;

    this.notifyDriverAssignment(
      driverId,
      driver,
      {
        id: order.id,
        number: 0,
        deliveryAddress,
        neighborhood: order.neighborhood,
        customerName: order.customerName,
      },
      companyId,
    );

    if (isInitialDispatch) {
      // Mesmo caminho usado pelo board da cozinha pra ONLINE — consumo de
      // estoque, fidelidade, socket, tudo já tratado ali (ver
      // orders.service.ts updateKitchenStatus).
      return this.ordersService.updateKitchenStatus(
        'ONLINE',
        orderId,
        'OUT_FOR_DELIVERY',
        userId,
        companyId,
      );
    }

    this.socketGateway.emitOrderStatusChanged(orderId, {
      status: order.orderStatus,
      source: 'ONLINE',
    });
    return this.prisma.onlineOrder.findFirst({ where: { id: orderId } });
  }

  // Manda pro CLIENTE (não pro entregador — ver notifyDriverAssignment
  // acima, que é o inverso) um WhatsApp com a localização ATUAL do
  // entregador em tempo real. Pedido explícito do usuário: quando o
  // cliente liga perguntando "cadê meu pedido", o operador clica um botão
  // em vez de ficar de operador humano de central de rastreamento.
  async shareDriverLocation(orderId: string, companyId: string, source?: string) {
    let driverId: string | null;
    let customerPhone: string | null;
    let customerName: string | null;

    if (source === 'ONLINE') {
      const order = await this.prisma.onlineOrder.findFirst({
        where: { id: orderId, companyId },
      });
      if (!order) throw new NotFoundException('Pedido não encontrado');
      driverId = order.driverId;
      customerPhone = order.customerPhone;
      customerName = order.customerName;
    } else {
      const order = await this.prisma.order.findFirst({
        where: { id: orderId, companyId },
        include: { customer: true },
      });
      if (!order) throw new NotFoundException('Pedido não encontrado');
      driverId = order.driverId;
      customerPhone = order.customer?.phone ?? order.customerPhone ?? null;
      customerName = order.customer?.name ?? order.customerName ?? null;
    }

    if (!driverId)
      throw new BadRequestException('Este pedido ainda não tem entregador atribuído.');
    if (!customerPhone)
      throw new BadRequestException('Pedido sem telefone de cliente cadastrado.');

    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
    });
    if (!driver?.currentLat || !driver?.currentLng) {
      // GPS só chega depois que o app do entregador conecta e emite pelo
      // menos uma vez (ver TrackingGateway.handleLocation) — sem isso não
      // há coordenada nenhuma pra mandar, e mandar um link vazio seria pior
      // que não mandar nada.
      throw new BadRequestException(
        'Localização do entregador ainda não disponível — peça pra ele abrir o app com o GPS ativo.',
      );
    }

    if (!this.whatsappAiService)
      throw new BadRequestException('WhatsApp não configurado nesta empresa.');

    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${driver.currentLat},${driver.currentLng}`;
    const greeting = customerName ? `Olá, ${customerName}! ` : '';
    const message = `${greeting}🛵 Seu entregador está a caminho! Acompanhe a localização em tempo real:\n${mapsLink}`;

    const sent = await this.whatsappAiService.sendTextMessage(
      companyId,
      customerPhone,
      message,
    );
    if (!sent)
      throw new BadRequestException(
        'Falha ao enviar WhatsApp — verifique a conexão em /whatsapp-ia.',
      );

    return { ok: true };
  }

  async updateMyLocation(userId: string, lat: number, lng: number) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Perfil não encontrado');
    return this.prisma.driverProfile.update({
      where: { id: profile.id },
      data: { currentLat: lat, currentLng: lng, lastSeenAt: new Date() },
    });
  }

  // Heartbeat leve do app do entregador (chamado a cada ~30s enquanto o app
  // está aberto, independente do GPS estar ativo) -- junto com o
  // updateMyLocation acima, é o que faz "Online" no painel refletir
  // atividade real, e não só o toggle manual isAvailable (que nasce true e
  // nunca muda sozinho -- achado real: entregador que nunca abriu o app
  // aparecia "Online" pra sempre).
  async heartbeat(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Perfil não encontrado');
    await this.prisma.driverProfile.update({
      where: { id: profile.id },
      data: { lastSeenAt: new Date() },
    });
    return { ok: true };
  }

  // Self-service: entregador liga/desliga a própria disponibilidade. Sem
  // isso, isAvailable nasce true (default do schema) e nunca muda sozinho —
  // o painel do admin (Entregadores/Rastreamento) mostrava todo entregador
  // como "Online"/"Disponível" pra sempre, mesmo sem estar de fato
  // trabalhando, porque só um ADMIN editando manualmente mudava o campo.
  async setMyAvailability(userId: string, isAvailable: boolean) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Perfil não encontrado');
    return this.prisma.driverProfile.update({
      where: { id: profile.id },
      data: { isAvailable },
    });
  }

  // Une Order (PDV/WhatsApp/iFood) + OnlineOrder (cardápio digital/totem) —
  // achado real: 13/08/2026, o app do entregador só listava pedidos do PDV;
  // um pedido do cardápio digital atribuído pelo painel admin (ver
  // assignOrder/assignOnlineOrder acima) nunca aparecia pro entregador,
  // mesmo o WhatsApp de notificação já chegando certo. Normaliza os dois
  // pro MESMO formato que o app já espera (customer:{name,phone}), pra não
  // precisar mudar a tipagem do frontend.
  async availableOrders(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Perfil não encontrado');

    const [pdv, online] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          companyId: profile.companyId,
          status: OrderStatus.READY,
          driverId: null,
        },
        orderBy: { readyAt: 'desc' },
        take: 50,
        include: {
          customer: true,
          items: { select: { productName: true, quantity: true } },
        },
      }),
      this.prisma.onlineOrder.findMany({
        where: {
          companyId: profile.companyId,
          orderStatus: 'READY',
          driverId: null,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const pdvMapped = pdv.map((o) => ({
      id: o.id,
      source: 'PDV' as const,
      total: Number(o.total),
      driverFee: o.driverFee != null ? Number(o.driverFee) : null,
      deliveryAddress: o.deliveryAddress,
      customer: o.customer
        ? { name: o.customer.name, phone: o.customer.phone }
        : o.customerName
          ? { name: o.customerName, phone: o.customerPhone ?? '' }
          : null,
      items: o.items,
    }));

    const onlineMapped = online.map((o) => ({
      id: o.id,
      source: 'ONLINE' as const,
      total: Number(o.total),
      driverFee: null,
      deliveryAddress:
        [o.address, o.addressNumber, o.neighborhood, o.city]
          .filter(Boolean)
          .join(', ') || null,
      customer: { name: o.customerName, phone: o.customerPhone },
      items: (Array.isArray(o.items) ? (o.items as any[]) : []).map(
        (it) => ({ productName: it.productName, quantity: it.quantity }),
      ),
    }));

    return [...pdvMapped, ...onlineMapped];
  }

  async acceptOrder(userId: string, orderId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Perfil não encontrado');

    // orderId é cuid globalmente único — nunca colide entre Order e
    // OnlineOrder, então dá pra checar qual tabela tem o registro sem
    // precisar que o app mande a origem.
    const onlineOrder = await this.prisma.onlineOrder.findFirst({
      where: { id: orderId, companyId: profile.companyId },
    });
    if (onlineOrder) return this.acceptOnlineOrder(profile, userId, onlineOrder);

    // Serializable transaction: check-and-assign atomically to prevent double-assignment
    await this.prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findFirst({
          where: { id: orderId, companyId: profile.companyId },
        });
        if (!order) throw new NotFoundException('Pedido não encontrado');
        if (order.driverId !== null)
          throw new ConflictException(
            'Pedido já foi aceito por outro entregador',
          );

        await tx.order.update({
          where: { id: orderId },
          data: { driverId: profile.id, assignedAt: new Date() },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    // Status transition outside transaction (triggers stock, socket, loyalty, audit)
    return this.ordersService.updateStatus(
      orderId,
      OrderStatus.OUT_FOR_DELIVERY,
      userId,
      profile.companyId,
    );
  }

  private async acceptOnlineOrder(
    profile: { id: string; companyId: string },
    userId: string,
    onlineOrder: { id: string; driverId: string | null },
  ) {
    await this.prisma.$transaction(
      async (tx) => {
        const fresh = await tx.onlineOrder.findFirst({
          where: { id: onlineOrder.id, companyId: profile.companyId },
        });
        if (!fresh) throw new NotFoundException('Pedido não encontrado');
        if (fresh.driverId !== null)
          throw new ConflictException(
            'Pedido já foi aceito por outro entregador',
          );

        await tx.onlineOrder.update({
          where: { id: onlineOrder.id },
          data: { driverId: profile.id, assignedAt: new Date() },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.ordersService.updateKitchenStatus(
      'ONLINE',
      onlineOrder.id,
      'OUT_FOR_DELIVERY',
      userId,
      profile.companyId,
    );
  }

  async myOrders(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Perfil não encontrado');

    const [pdv, online] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          driverId: profile.id,
          status: { in: ['READY', 'OUT_FOR_DELIVERY', 'DELIVERED'] },
        },
        orderBy: { assignedAt: 'desc' },
        take: 20,
        include: { customer: true },
      }),
      this.prisma.onlineOrder.findMany({
        where: {
          driverId: profile.id,
          orderStatus: { in: ['READY', 'DELIVERING', 'COMPLETED'] },
        },
        orderBy: { assignedAt: 'desc' },
        take: 20,
      }),
    ]);

    const ONLINE_STATUS_MAP: Record<string, string> = {
      READY: 'READY',
      DELIVERING: 'OUT_FOR_DELIVERY',
      COMPLETED: 'DELIVERED',
    };

    const pdvMapped = pdv.map((o) => ({
      id: o.id,
      source: 'PDV' as const,
      status: o.status,
      total: Number(o.total),
      driverFee: o.driverFee != null ? Number(o.driverFee) : null,
      deliveryAddress: o.deliveryAddress,
      customer: o.customer
        ? { name: o.customer.name, phone: o.customer.phone }
        : o.customerName
          ? { name: o.customerName, phone: o.customerPhone ?? '' }
          : null,
      assignedAt: o.assignedAt,
    }));

    const onlineMapped = online.map((o) => ({
      id: o.id,
      source: 'ONLINE' as const,
      status: ONLINE_STATUS_MAP[o.orderStatus] ?? o.orderStatus,
      total: Number(o.total),
      driverFee: null,
      deliveryAddress:
        [o.address, o.addressNumber, o.neighborhood, o.city]
          .filter(Boolean)
          .join(', ') || null,
      customer: { name: o.customerName, phone: o.customerPhone },
      assignedAt: o.assignedAt,
    }));

    return [...pdvMapped, ...onlineMapped].sort((a, b) => {
      const at = a.assignedAt ? new Date(a.assignedAt).getTime() : 0;
      const bt = b.assignedAt ? new Date(b.assignedAt).getTime() : 0;
      return bt - at;
    });
  }

  async myProfile(userId: string) {
    return this.prisma.driverProfile.findUnique({
      where: { userId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  // ── Earnings & Payments ─────────────────────────────────────────────────

  // `order` sempre vem preenchido, seja o ganho de um pedido PDV ou ONLINE —
  // achado real: 13/08/2026, ganho de pedido do cardápio digital passou a
  // existir (ver updateKitchenStatus em orders.service.ts) mas apontava só
  // pra onlineOrderId; sem essa normalização, o frontend (que só lê
  // `earning.order`) mostraria "Pedido —" pra qualquer ganho ONLINE mesmo
  // com o dado certo no banco.
  async listEarnings(driverProfileId: string, companyId: string) {
    const rows = await this.prisma.driverEarning.findMany({
      where: { driverProfileId, companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: { id: true, createdAt: true, total: true, deliveryAddress: true },
        },
        onlineOrder: {
          select: { id: true, createdAt: true, total: true, address: true, addressNumber: true, neighborhood: true, city: true },
        },
      },
    });
    return rows.map((r) => {
      const { onlineOrder, ...rest } = r;
      if (rest.order) return rest;
      if (onlineOrder) {
        return {
          ...rest,
          order: {
            id: onlineOrder.id,
            createdAt: onlineOrder.createdAt,
            total: Number(onlineOrder.total),
            deliveryAddress:
              [onlineOrder.address, onlineOrder.addressNumber, onlineOrder.neighborhood, onlineOrder.city]
                .filter(Boolean)
                .join(', ') || null,
          },
        };
      }
      return rest;
    });
  }

  listPayments(driverProfileId: string, companyId: string) {
    return this.prisma.driverPayment.findMany({
      where: { driverProfileId, companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        earnings: {
          select: { id: true, orderId: true, driverAmount: true, status: true },
        },
      },
    });
  }

  async myEarnings(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Perfil não encontrado');
    return this.listEarnings(profile.id, profile.companyId);
  }

  async myPayments(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Perfil não encontrado');
    return this.listPayments(profile.id, profile.companyId);
  }

  async createPayment(driverProfileId: string, companyId: string) {
    const driver = await this.prisma.driverProfile.findFirst({
      where: { id: driverProfileId, companyId },
    });
    if (!driver) throw new NotFoundException('Entregador não encontrado');

    const earnings = await this.prisma.driverEarning.findMany({
      where: {
        driverProfileId,
        companyId,
        status: 'PENDING',
        driverPaymentId: null,
      },
    });
    if (!earnings.length)
      throw new BadRequestException(
        'Nenhum repasse pendente para este entregador',
      );

    const totalAmount = earnings.reduce(
      (sum, e) => sum + Number(e.driverAmount),
      0,
    );

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.driverPayment.create({
        data: { companyId, driverProfileId, totalAmount },
      });
      await tx.driverEarning.updateMany({
        where: { id: { in: earnings.map((e) => e.id) } },
        data: { driverPaymentId: payment.id },
      });
      return payment;
    });
  }

  async payPayment(paymentId: string, companyId: string) {
    const payment = await this.prisma.driverPayment.findFirst({
      where: { id: paymentId, companyId },
      include: {
        driverProfile: { include: { user: { select: { name: true } } } },
      },
    });
    if (!payment) throw new NotFoundException('Pagamento não encontrado');
    if (payment.status === 'PAID')
      throw new BadRequestException('Pagamento já quitado');

    return this.prisma.$transaction(async (tx) => {
      const financial = await tx.financial.create({
        data: {
          companyId,
          type: 'EXPENSE',
          category: 'REPASSE_ENTREGADOR',
          description: `Repasse entregador ${payment.driverProfile.user.name ?? payment.driverProfileId}`,
          amount: payment.totalAmount,
        },
      });
      await tx.driverEarning.updateMany({
        where: { driverPaymentId: paymentId },
        data: { status: 'PAID' },
      });
      return tx.driverPayment.update({
        where: { id: paymentId },
        data: { status: 'PAID', paidAt: new Date(), financialId: financial.id },
      });
    });
  }

  // ── Convite de instalação — entregador define a própria senha ────────────
  // Antes o admin precisava inventar uma senha na hora de criar o entregador
  // e repassar ela por fora (WhatsApp/papel) — 2 informações pra comunicar
  // (link + senha), risco de erro de digitação. Agora o admin manda só o
  // link; o entregador define a própria senha e já cai logado no app.

  async generateInviteLink(driverId: string, companyId: string) {
    const driver = await this.prisma.driverProfile.findFirst({
      where: { id: driverId, companyId },
      include: { user: { select: { id: true, name: true } } },
    });
    if (!driver) throw new NotFoundException('Entregador não encontrado');

    const token = this.jwtService.sign(
      { sub: driver.user.id, purpose: DRIVER_INVITE_PURPOSE },
      { expiresIn: '7d' },
    );
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ||
      'https://food-system-sas-erp-frontend.vercel.app';

    return {
      link: `${frontendUrl}/driver-invite/${token}`,
      driverName: driver.user.name,
    };
  }

  async acceptInvite(token: string, password: string) {
    let payload: { sub?: string; purpose?: string };
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new BadRequestException(
        'Link de convite inválido ou expirado — peça um novo link.',
      );
    }
    if (payload.purpose !== DRIVER_INVITE_PURPOSE || !payload.sub) {
      throw new BadRequestException('Link de convite inválido.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || user.role !== 'DELIVERY') {
      throw new NotFoundException('Conta de entregador não encontrada.');
    }

    const bcrypt = await import('bcrypt');
    const hashed = await bcrypt.hash(password, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, isActive: true },
    });

    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        companyId: user.companyId,
        role: user.role,
      },
      { expiresIn: '7d' },
    );

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      },
    };
  }
}