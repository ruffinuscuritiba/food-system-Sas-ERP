import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService }              from '@/database/prisma.service';
import { OrdersService }              from '@/modules/orders/orders.service';
import { IntegrationProviderFactory } from './providers/integration-provider.factory';
import { IntegrationEvent }           from './providers/integration-provider.interface';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly prisma:           PrismaService,
    private readonly ordersService:    OrdersService,
    private readonly providerFactory:  IntegrationProviderFactory,
  ) {}

  // ── Config ──────────────────────────────────────────────────────────────

  async upsertConfig(companyId: string, dto: {
    provider:       string;
    merchantId?:    string;
    webhookSecret?: string;
    sandboxMode?:   boolean;
    isActive?:      boolean;
  }) {
    const provider = dto.provider as any;
    const { provider: _p, ...rest } = dto;
    return this.prisma.integrationConfig.upsert({
      where:  { companyId_provider: { companyId, provider } },
      create: { companyId, provider, ...rest },
      update: { provider, ...rest, updatedAt: new Date() },
    });
  }

  async getConfig(companyId: string, provider?: string) {
    if (provider) {
      return this.prisma.integrationConfig.findUnique({
        where:  { companyId_provider: { companyId, provider: provider as any } },
        select: {
          id: true, provider: true, isActive: true, sandboxMode: true,
          merchantId: true, tokenExpiresAt: true, updatedAt: true,
          // nunca retornar apiKeyEncrypted / webhookSecret / tokens
        },
      });
    }
    return this.prisma.integrationConfig.findMany({
      where:  { companyId },
      select: {
        id: true, provider: true, isActive: true, sandboxMode: true,
        merchantId: true, tokenExpiresAt: true, updatedAt: true,
      },
    });
  }

  // ── Catalog maps ─────────────────────────────────────────────────────────

  async listCatalogMaps(companyId: string, provider?: string) {
    return this.prisma.productCatalogMap.findMany({
      where: { companyId, ...(provider && { provider: provider as any }), isActive: true },
      include: { product: { select: { id: true, name: true, imageUrl: true, salePrice: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upsertCatalogMap(companyId: string, dto: {
    provider:          string;
    externalProductId: string;
    internalProductId: string;
    externalVariantId?: string;
    sizeMapping?:       Record<string, unknown>;
  }) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.internalProductId, companyId, deletedAt: null },
    });
    if (!product) throw new NotFoundException('Produto interno não encontrado.');

    return this.prisma.productCatalogMap.upsert({
      where: {
        companyId_provider_externalProductId: {
          companyId,
          provider:          dto.provider as any,
          externalProductId: dto.externalProductId,
        },
      },
      create: { companyId, ...dto as any, isActive: true },
      update: { ...dto as any, isActive: true, updatedAt: new Date() },
    });
  }

  async deleteCatalogMap(id: string, companyId: string) {
    const map = await this.prisma.productCatalogMap.findFirst({ where: { id, companyId } });
    if (!map) throw new NotFoundException('Mapeamento não encontrado.');
    return this.prisma.productCatalogMap.update({ where: { id }, data: { isActive: false } });
  }

  // ── Event log (leitura) ───────────────────────────────────────────────────

  async listEvents(companyId: string, limit = 50) {
    return this.prisma.integrationEventLog.findMany({
      where:   { companyId },
      orderBy: { createdAt: 'desc' },
      take:    limit,
      select:  {
        id: true, provider: true, eventType: true,
        externalOrderId: true, status: true,
        errorMessage: true, processedAt: true, createdAt: true,
      },
    });
  }

  async listIntegrationOrders(companyId: string, limit = 50) {
    return this.prisma.integrationOrder.findMany({
      where:   { companyId },
      orderBy: { createdAt: 'desc' },
      take:    limit,
    });
  }

  // ── Webhook entrypoint ────────────────────────────────────────────────────

  async processWebhook(
    companyId: string,
    providerName: string,
    headers: Record<string, string>,
    body: unknown,
    rawBody: Buffer,
  ): Promise<{ received: boolean }> {

    // 1. Carrega config
    const config = await this.prisma.integrationConfig.findUnique({
      where: { companyId_provider: { companyId, provider: providerName as any } },
    });
    if (!config || !config.isActive) {
      this.logger.warn(`[Integrations] webhook rejeitado — config inexistente ou inativa: ${companyId}/${providerName}`);
      return { received: false };
    }

    // 2. Valida assinatura (pula em sandboxMode)
    const provider = this.providerFactory.get(providerName);
    if (!config.sandboxMode && config.webhookSecret) {
      const valid = provider.validateWebhookSignature(config.webhookSecret, headers, rawBody);
      if (!valid) {
        this.logger.warn(`[Integrations] assinatura inválida: ${companyId}/${providerName}`);
        return { received: false };
      }
    }

    // 3. Parse → evento canônico
    let event: IntegrationEvent;
    try {
      event = provider.parseEvent(body, headers);
    } catch (err: any) {
      await this.logEvent(companyId, providerName, 'PARSE_ERROR', null, 'ERROR', err?.message, body);
      return { received: true }; // ACK para não gerar retry
    }

    // 4. Log do evento (append-only)
    await this.logEvent(companyId, providerName, event.type, event.externalOrderId, 'RECEIVED', null, body);

    // 5. Processa de forma assíncrona — ACK imediato
    setImmediate(() => this.handleEvent(companyId, config.id, providerName, event));

    return { received: true };
  }

  // ── Simulação manual (PASSO 6 — Mock) ────────────────────────────────────

  async simulateMockOrder(companyId: string, dto: {
    customerName:  string;
    customerPhone: string;
    neighborhood?: string;
    items: Array<{ internalProductId: string; quantity: number; unitPrice: number }>;
    paymentMethod?: string;
    deliveryFee?:   number;
    notes?:         string;
  }) {
    const config = await this.prisma.integrationConfig.findUnique({
      where: { companyId_provider: { companyId, provider: 'MOCK' as any } },
    });
    if (!config) {
      throw new BadRequestException('Configure o provider MOCK antes de simular.');
    }

    const externalOrderId = `MOCK-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const subtotal = dto.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const deliveryFee = dto.deliveryFee ?? 0;

    const mockBody = {
      type:            'ORDER_CREATED',
      externalOrderId,
      status:          'PLACED',
      orderType:       'DELIVERY',
      customer: {
        name:         dto.customerName,
        phone:        dto.customerPhone,
        neighborhood: dto.neighborhood ?? '',
      },
      items: dto.items.map((i) => ({
        externalProductId: i.internalProductId, // Mock: ID externo = ID interno
        productName:       'Produto Mock',
        quantity:          i.quantity,
        unitPrice:         i.unitPrice,
      })),
      paymentMethod: dto.paymentMethod ?? 'PIX',
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee,
      notes: dto.notes ?? '',
    };

    return this.processWebhook(
      companyId,
      'MOCK',
      {},
      mockBody,
      Buffer.from(JSON.stringify(mockBody)),
    );
  }

  // ── Handler interno ───────────────────────────────────────────────────────

  private async handleEvent(
    companyId: string,
    configId: string,
    providerName: string,
    event: IntegrationEvent,
  ) {
    try {
      if (event.type === 'ORDER_CREATED') {
        await this.handleOrderCreated(companyId, configId, providerName, event);
      } else if (event.type === 'STATUS_CHANGED') {
        await this.handleStatusChanged(companyId, providerName, event);
      } else if (event.type === 'ORDER_CANCELLED') {
        await this.handleStatusChanged(companyId, providerName, {
          ...event,
          externalStatus: 'CANCELLED',
        });
      }
      await this.logEvent(companyId, providerName, event.type, event.externalOrderId, 'PROCESSED', null, null);
    } catch (err: any) {
      this.logger.error(`[Integrations] handleEvent failed: ${err?.message}`, err?.stack);
      await this.logEvent(companyId, providerName, event.type, event.externalOrderId, 'ERROR', err?.message, null);
    }
  }

  private async handleOrderCreated(
    companyId: string,
    configId: string,
    providerName: string,
    event: IntegrationEvent,
  ) {
    // Idempotência: se externalOrderId já existe, ignora silenciosamente
    const existing = await this.prisma.integrationOrder.findUnique({
      where: { externalOrderId: event.externalOrderId },
    });
    if (existing) {
      this.logger.log(`[Integrations] ORDER_CREATED ignorado — já existe: ${event.externalOrderId}`);
      return;
    }

    // Cria IntegrationOrder com orderId=null (ainda processando)
    const intOrder = await this.prisma.integrationOrder.create({
      data: {
        companyId,
        configId,
        provider:        providerName as any,
        externalOrderId: event.externalOrderId,
        externalStatus:  event.externalStatus ?? 'PLACED',
        rawPayload:      event.rawPayload as any,
      },
    });

    // Resolve itens via ProductCatalogMap (Mock usa ID direto)
    const provider = this.providerFactory.get(providerName);
    const resolvedItems = await this.resolveItems(
      companyId,
      providerName,
      event.items ?? [],
      provider.providerName === 'MOCK',
    );

    if (resolvedItems.length === 0) {
      throw new BadRequestException('Nenhum item do pedido pôde ser mapeado para produtos internos.');
    }

    // Cria pedido via OrdersService (fonte de verdade — dispara estoque, loyalty, socket, WhatsApp)
    const order = await this.ordersService.create({
      companyId,
      channel:          providerName,
      externalOrderId:  event.externalOrderId,
      orderType:        event.orderType ?? 'DELIVERY',
      customerName:     event.customer?.name ?? 'Cliente',
      customerPhone:    event.customer?.phone ?? '',
      deliveryAddress:  this.formatAddress(event.customer),
      neighborhood:     event.customer?.neighborhood,
      paymentMethod:    provider.mapPaymentMethod(event.paymentMethod ?? 'PIX'),
      items:            resolvedItems,
      deliveryFee:      event.deliveryFee ?? 0,
      notes:            event.notes,
    });

    // Vincula IntegrationOrder ao Order interno
    await this.prisma.integrationOrder.update({
      where: { id: intOrder.id },
      data:  { orderId: order.id, ackSentAt: new Date() },
    });

    this.logger.log(
      `[Integrations] ORDER_CREATED: external=${event.externalOrderId} → internal=${order.id} provider=${providerName}`,
    );
  }

  private async handleStatusChanged(
    companyId: string,
    providerName: string,
    event: IntegrationEvent,
  ) {
    const intOrder = await this.prisma.integrationOrder.findUnique({
      where: { externalOrderId: event.externalOrderId },
    });
    if (!intOrder?.orderId) {
      this.logger.warn(`[Integrations] STATUS_CHANGED sem orderId interno: ${event.externalOrderId}`);
      return;
    }

    const provider = this.providerFactory.get(providerName);
    const mappedStatus = provider.mapOrderStatus(event.externalStatus ?? '');

    await this.ordersService.updateStatus(
      intOrder.orderId,
      mappedStatus as any,
      'INTEGRATION_SYSTEM',
      companyId,
    );

    await this.prisma.integrationOrder.update({
      where: { id: intOrder.id },
      data:  { externalStatus: event.externalStatus, updatedAt: new Date() },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async resolveItems(
    companyId: string,
    providerName: string,
    externalItems: Array<{ externalProductId: string; quantity: number; unitPrice: number; notes?: string }>,
    isMock: boolean,
  ) {
    if (isMock) {
      // Mock: externalProductId === internalProductId — sem necessidade de mapeamento
      return externalItems.map((i) => ({
        productId: i.externalProductId,
        quantity:  i.quantity,
        unitPrice: i.unitPrice,
        notes:     i.notes,
      }));
    }

    const externalIds = externalItems.map((i) => i.externalProductId);
    const maps = await this.prisma.productCatalogMap.findMany({
      where: {
        companyId,
        provider:          providerName as any,
        externalProductId: { in: externalIds },
        isActive:          true,
      },
    });

    const mapIndex = new Map(maps.map((m) => [m.externalProductId, m.internalProductId]));

    return externalItems
      .filter((i) => mapIndex.has(i.externalProductId))
      .map((i) => ({
        productId: mapIndex.get(i.externalProductId)!,
        quantity:  i.quantity,
        unitPrice: i.unitPrice,
        notes:     i.notes,
      }));
  }

  private formatAddress(customer?: IntegrationEvent['customer']): string {
    if (!customer) return '';
    return [
      customer.address,
      customer.addressNumber,
      customer.neighborhood,
      customer.city,
      customer.state,
    ].filter(Boolean).join(', ');
  }

  private async logEvent(
    companyId: string,
    provider: string,
    eventType: string,
    externalOrderId: string | null | undefined,
    status: string,
    errorMessage: string | null | undefined,
    rawPayload: unknown,
  ) {
    try {
      await this.prisma.integrationEventLog.create({
        data: {
          companyId,
          provider:       provider as any,
          eventType,
          externalOrderId: externalOrderId ?? null,
          status,
          errorMessage:   errorMessage ?? null,
          rawPayload:     rawPayload ? (rawPayload as any) : undefined,
          processedAt:    status !== 'RECEIVED' ? new Date() : undefined,
        },
      });
    } catch (e: any) {
      this.logger.warn(`[Integrations] logEvent failed: ${e?.message}`);
    }
  }
}
