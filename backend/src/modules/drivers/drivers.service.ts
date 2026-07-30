import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';
import { OrdersService } from '@/modules/orders/orders.service';
import { SocketGateway } from '@/socket/socket.gateway';

@Injectable()
export class DriversService {
  constructor(
    private prisma: PrismaService,
    private ordersService: OrdersService,
    private socketGateway: SocketGateway,
  ) {}

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
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const drivers = await this.prisma.driverProfile.findMany({
      where: { companyId },
      include: {
        user: { select: { id: true, name: true, email: true, isActive: true } },
        _count: {
          select: {
            orders: {
              where: { status: 'DELIVERED', createdAt: { gte: startOfToday } },
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
  ) {
    const driver = await this.prisma.driverProfile.findFirst({
      where: { id: driverId, companyId },
    });
    if (!driver) throw new NotFoundException('Entregador não encontrado');

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

  async availableOrders(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Perfil não encontrado');

    return this.prisma.order.findMany({
      where: {
        companyId: profile.companyId,
        status: OrderStatus.READY,
        driverId: null,
      },
      orderBy: { readyAt: 'desc' },
      take: 50,
      include: { items: { select: { productName: true, quantity: true } } },
    });
  }

  async acceptOrder(userId: string, orderId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Perfil não encontrado');

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

  async myOrders(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Perfil não encontrado');

    return this.prisma.order.findMany({
      where: {
        driverId: profile.id,
        status: { in: ['READY', 'OUT_FOR_DELIVERY', 'DELIVERED'] },
      },
      orderBy: { assignedAt: 'desc' },
      take: 20,
      include: { customer: true },
    });
  }

  async myProfile(userId: string) {
    return this.prisma.driverProfile.findUnique({
      where: { userId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  // ── Earnings & Payments ─────────────────────────────────────────────────

  listEarnings(driverProfileId: string, companyId: string) {
    return this.prisma.driverEarning.findMany({
      where: { driverProfileId, companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: {
            id: true,
            createdAt: true,
            total: true,
            deliveryAddress: true,
          },
        },
      },
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
}