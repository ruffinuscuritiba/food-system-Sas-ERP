import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { OrdersService } from '@/modules/orders/orders.service';
import { IntegrationProviderFactory } from './providers/integration-provider.factory';
import { IntegrationEvent } from './providers/integration-provider.interface';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly providerFactory: IntegrationProviderFactory,
  ) {}

  // ── Config ──────────────────────────────────────────────────────────────

  async upsertConfig(
    companyId: string,
    dto: {
      provider: string;
      clientId?: string;
      clientSecret?: string;   // persiste em apiKeyEncrypted
      merchantId?: string;
      webhookSecret?: string;
      sandboxMode?: boolean;
      isActive?: boolean;
    },
  ) {
    const providerEnum = dto.provider as any;
    const { provider: _p, clientSecret, ...rest } = dto;

    const data: Record<string, any> = { ...rest };
    if (clientSecret) data.apiKeyEncrypted = clientSecret;

    const saved = await this.prisma.integrationConfig.upsert({
      where: { companyId_provider: { companyId, provider: providerEnum } },
      create: { companyId, provider: providerEnum, ...data },
      update: { ...data, updatedAt: new Date() },
    });

    // Para iFood com credenciais completas e isActive=true: obtém token imediatamente
    if (
      dto.provider === 'IFOOD' &&
      dto.isActive &&
      saved.clientId &&
      saved.apiKeyEncrypted
    ) {
      try {
        await this.getValidToken(saved);
      } catch (e: any) {
        this.logger.warn(`[Integrations] OAuth2 iFood na upsertConfig falhou: ${e?.message}`);
      }
    }

    return saved;
  }

  async getConfig(companyId: string, provider?: string) {
    if (provider) {
      return this.prisma.integrationConfig.findUnique({
        where: { companyId_provider: { companyId, provider: provider as any } },
        select: {
          id: true,
          provider: true,
          isActive: true,
          sandboxMode: true,
          merchantId: true,
          tokenExpiresAt: true,
          updatedAt: true,
          // nunca retornar apiKeyEncrypted / webhookSecret / tokens
        },
      });
    }
    return this.prisma.integrationConfig.findMany({
      where: { companyId },
      select: {
        id: true,
        provider: true,
        isActive: true,
        sandboxMode: true,
        merchantId: true,
        tokenExpiresAt: true,
        updatedAt: true,
      },
    });
  }

  // ── Catalog maps ─────────────────────────────────────────────────────────

  async listCatalogMaps(companyId: string, provider?: string) {
    return this.prisma.productCatalogMap.findMany({
      where: {
        companyId,
        ...(provider && { provider: provider as any }),
        isActive: true,
      },
      include: {
        product: {
          select: { id: true, name: true, imageUrl: true, salePrice: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upsertCatalogMap(
    companyId: string,
    dto: {
      provider: string;
      externalProductId: string;
      internalProductId: string;
      externalVariantId?: string;
      sizeMapping?: Record<string, unknown>;
    },
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.internalProductId, companyId, deletedAt: null },
    });
    if (!product)
      throw new NotFoundException('Produto interno não encontrado.');

    return this.prisma.productCatalogMap.upsert({
      where: {
        companyId_provider_externalProductId: {
          companyId,
          provider: dto.provider as any,
          externalProductId: dto.externalProductId,
        },
      },
      create: { companyId, ...(dto as any), isActive: true },
      update: { ...(dto as any), isActive: true, updatedAt: new Date() },
    });
  }

  async deleteCatalogMap(id: string, companyId: string) {
    const map = await this.prisma.productCatalogMap.findFirst({
      where: { id, companyId },
    });
    if (!map) throw new NotFoundException('Mapeamento não encontrado.');
    return this.prisma.productCatalogMap.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ── Event log (leitura) ───────────────────────────────────────────────────

  async listEvents(companyId: string, limit = 50) {
    return this.prisma.integrationEventLog.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        provider: true,
        eventType: true,
        externalOrderId: true,
        status: true,
        errorMessage: true,
        processedAt: true,
        createdAt: true,
      },
    });
  }

  async listIntegrationOrders(companyId: string, limit = 50) {
    return this.prisma.integrationOrder.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: limit,
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
      where: {
        companyId_provider: { companyId, provider: providerName as any },
      },
    });
    if (!config || !config.isActive) {
      this.logger.warn(
        `[Integrations] webhook rejeitado — config inexistente ou inativa: ${companyId}/${providerName}`,
      );
      return { received: false };
    }

    // 2. Valida assinatura (pula em sandboxMode)
    const provider = this.providerFactory.get(providerName);
    if (!config.sandboxMode && config.webhookSecret) {
      const valid = provider.validateWebhookSignature(
        config.webhookSecret,
        headers,
        rawBody,
      );
      if (!valid) {
        this.logger.warn(
          `[Integrations] assinatura inválida: ${companyId}/${providerName}`,
        );
        return { received: false };
      }
    }

    // 3. Parse → evento canônico
    let event: IntegrationEvent;
    try {
      event = provider.parseEvent(body, headers);
    } catch (err: any) {
      await this.logEvent(
        companyId,
        providerName,
        'PARSE_ERROR',
        null,
        'ERROR',
        err?.message,
        body,
      );
      return { received: true }; // ACK para não gerar retry
    }

    // 4. Log do evento (append-only)
    await this.logEvent(
      companyId,
      providerName,
      event.type,
      event.externalOrderId,
      'RECEIVED',
      null,
      body,
    );

    // 5. Dispara ACK para iFood imediatamente (< 10 s do PLACED)
    if (providerName === 'IFOOD' && event.type === 'ORDER_CREATED') {
      const ifoodProvider = provider as any;
      if (typeof ifoodProvider.sendAck === 'function') {
        this.getValidToken(config)
          .then((token) => {
            if (token) {
              ifoodProvider
                .sendAck(event.externalOrderId, token)
                .catch((e: any) =>
                  this.logger.warn(`[Integrations] iFood ACK falhou: ${e?.message}`),
                );
            }
          })
          .catch((e: any) =>
            this.logger.warn(`[Integrations] getValidToken para ACK falhou: ${e?.message}`),
          );
      }
    }

    // 6. Processa de forma assíncrona (sem bloquear o ACK)
    setImmediate(() =>
      this.handleEvent(companyId, config.id, providerName, event),
    );

    return { received: true };
  }

  // ── Token OAuth2 iFood (cache DB + in-memory) ──────────────────────────────
  private async getValidToken(config: {
    id: string;
    clientId?: string | null;
    apiKeyEncrypted?: string | null;
    accessToken?: string | null;
    tokenExpiresAt?: Date | null;
  }): Promise<string | null> {
    if (!config.clientId || !config.apiKeyEncrypted) {
      return config.accessToken ?? null;
    }

    // Token ainda válido (buffer de 60 s)
    if (
      config.accessToken &&
      config.tokenExpiresAt &&
      config.tokenExpiresAt.getTime() > Date.now() + 60_000
    ) {
      return config.accessToken;
    }

    // Refresh via IfoodProvider (in-memory cache + novo fetch)
    const ifoodProvider = this.providerFactory.get('IFOOD') as any;
    const token: string = await ifoodProvider.getAccessToken(
      config.clientId,
      config.apiKeyEncrypted,
    );
    const expiresAt = new Date(ifoodProvider.tokenExpiry as number);

    // Persiste no DB para sobreviver a restarts
    await this.prisma.integrationConfig.update({
      where: { id: config.id },
      data: { accessToken: token, tokenExpiresAt: expiresAt, updatedAt: new Date() },
    });

    return token;
  }

  // ── OAuth callback (Passo 2 do cadastro no Portal do Parceiro) ───────────
  // NOTA: o mecanismo exato de troca do "code" por token (redirect clássico
  // vs. fluxo de userCode/device-code) só fica claro na tela real do Portal
  // do Parceiro. Este endpoint existe para o campo "Callback URL" do
  // formulário ter um destino válido; a troca do code por token será ligada
  // assim que soubermos o formato exato exigido nessa etapa.
  async recordOAuthCallback(companyIdOrState: string | undefined, code: string) {
    // companyId real é necessário (FK) — sem ele, só loga (não quebra o callback do iFood).
    if (!companyIdOrState) {
      this.logger.warn(
        `[Integrations] OAuth callback do iFood recebido sem state/companyId — code=${code?.slice(0, 8)}...`,
      );
      return;
    }
    const company = await this.prisma.company.findUnique({ where: { id: companyIdOrState } });
    if (!company) {
      this.logger.warn(
        `[Integrations] OAuth callback do iFood — state não corresponde a nenhuma empresa: ${companyIdOrState}`,
      );
      return;
    }
    await this.logEvent(
      companyIdOrState,
      'IFOOD',
      'OAUTH_CALLBACK',
      null,
      'RECEIVED',
      null,
      { code, receivedAt: new Date().toISOString() },
    );
  }

  // ── Validação de conexão (botão "Validar" no painel) ────────────────────

  async testConnection(companyId: string, providerName: string) {
    const config = await this.prisma.integrationConfig.findUnique({
      where: { companyId_provider: { companyId, provider: providerName as any } },
    });
    if (!config) {
      throw new BadRequestException('Configure a integração antes de validar.');
    }

    if (providerName === 'MOCK') {
      return { ok: true, message: 'Sandbox Mock sempre disponível — nenhuma credencial externa necessária.' };
    }

    if (providerName === 'IFOOD') {
      if (!config.clientId || !config.apiKeyEncrypted) {
        throw new BadRequestException('Informe Client ID e Client Secret antes de validar.');
      }
      try {
        await this.getValidToken(config);
      } catch (e: any) {
        throw new BadRequestException(
          `Client ID/Secret inválidos ou iFood indisponível: ${e?.message ?? 'erro desconhecido'}`,
        );
      }
      return {
        ok: true,
        message: config.merchantId
          ? 'Client ID e Secret válidos — token OAuth2 obtido com sucesso.'
          : 'Client ID e Secret válidos. Informe o Merchant ID para habilitar o Merchant Portal completo.',
      };
    }

    throw new BadRequestException(`Validação ainda não implementada para ${providerName}.`);
  }

  // ── Sincronização de catálogo (PASSO 5 — pushCatalog) ────────────────────

  async pushCatalog(companyId: string, providerName: string) {
    if (providerName !== 'IFOOD') {
      throw new BadRequestException(
        'Sincronização de catálogo disponível apenas para iFood no momento.',
      );
    }

    const config = await this.prisma.integrationConfig.findUnique({
      where: { companyId_provider: { companyId, provider: providerName as any } },
    });
    if (!config || !config.isActive) {
      throw new BadRequestException('Ative a integração iFood antes de sincronizar o catálogo.');
    }
    if (!config.merchantId) {
      throw new BadRequestException('Informe o Merchant ID antes de sincronizar o catálogo.');
    }

    const maps = await this.prisma.productCatalogMap.findMany({
      where: { companyId, provider: providerName as any, isActive: true },
      include: {
        product: { include: { category: true } },
      },
    });
    if (maps.length === 0) {
      throw new BadRequestException(
        'Nenhum produto mapeado ainda. Configure o Mapeamento de Catálogo antes de sincronizar.',
      );
    }

    // Agrupa por categoria interna → categorias do iFood
    const byCategory = new Map<string, { name: string; items: unknown[] }>();
    for (const map of maps) {
      const catId = map.product.categoryId ?? 'sem-categoria';
      const catName = map.product.category?.name ?? 'Cardápio';
      if (!byCategory.has(catId)) byCategory.set(catId, { name: catName, items: [] });
      byCategory.get(catId)!.items.push({
        id: map.externalProductId,
        name: map.product.name,
        externalCode: map.externalProductId,
        status: map.product.isActive ? 'AVAILABLE' : 'UNAVAILABLE',
        price: { value: Number(map.product.salePrice) },
      });
    }
    const categories = Array.from(byCategory.entries()).map(([externalCode, c]) => ({
      externalCode,
      name: c.name,
      items: c.items,
    }));

    const token = await this.getValidToken(config);
    if (!token) throw new BadRequestException('Não foi possível obter token OAuth2 do iFood.');

    const provider = this.providerFactory.get('IFOOD') as any;
    await provider.pushCatalog(config.merchantId, categories, token);

    const itemCount = categories.reduce((s, c) => s + c.items.length, 0);
    this.logger.log(
      `[Integrations] pushCatalog OK: ${companyId} — ${categories.length} categorias, ${itemCount} itens`,
    );
    return { ok: true, categories: categories.length, items: itemCount };
  }

  // ── Simulação manual (PASSO 6 — Mock) ────────────────────────────────────

  async simulateMockOrder(
    companyId: string,
    dto: {
      customerName: string;
      customerPhone: string;
      neighborhood?: string;
      items: Array<{
        internalProductId: string;
        quantity: number;
        unitPrice: number;
      }>;
      paymentMethod?: string;
      deliveryFee?: number;
      notes?: string;
    },
  ) {
    const config = await this.prisma.integrationConfig.findUnique({
      where: { companyId_provider: { companyId, provider: 'MOCK' as any } },
    });
    if (!config) {
      throw new BadRequestException(
        'Configure o provider MOCK antes de simular.',
      );
    }

    const externalOrderId = `MOCK-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const subtotal = dto.items.reduce(
      (s, i) => s + i.unitPrice * i.quantity,
      0,
    );
    const deliveryFee = dto.deliveryFee ?? 0;

    const mockBody = {
      type: 'ORDER_CREATED',
      externalOrderId,
      status: 'PLACED',
      orderType: 'DELIVERY',
      customer: {
        name: dto.customerName,
        phone: dto.customerPhone,
        neighborhood: dto.neighborhood ?? '',
      },
      items: dto.items.map((i) => ({
        externalProductId: i.internalProductId, // Mock: ID externo = ID interno
        productName: 'Produto Mock',
        quantity: i.quantity,
        unitPrice: i.unitPrice,
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
      await this.logEvent(
        companyId,
        providerName,
        event.type,
        event.externalOrderId,
        'PROCESSED',
        null,
        null,
      );
    } catch (err: any) {
      this.logger.error(
        `[Integrations] handleEvent failed: ${err?.message}`,
        err?.stack,
      );
      await this.logEvent(
        companyId,
        providerName,
        event.type,
        event.externalOrderId,
        'ERROR',
        err?.message,
        null,
      );
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
      this.logger.log(
        `[Integrations] ORDER_CREATED ignorado — já existe: ${event.externalOrderId}`,
      );
      return;
    }

    // Cria IntegrationOrder com orderId=null (ainda processando)
    const intOrder = await this.prisma.integrationOrder.create({
      data: {
        companyId,
        configId,
        provider: providerName as any,
        externalOrderId: event.externalOrderId,
        externalStatus: event.externalStatus ?? 'PLACED',
        rawPayload: event.rawPayload as any,
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
      throw new BadRequestException(
        'Nenhum item do pedido pôde ser mapeado para produtos internos.',
      );
    }

    // Cria pedido via OrdersService (fonte de verdade — dispara estoque, loyalty, socket, WhatsApp)
    const order = await this.ordersService.create({
      companyId,
      channel: providerName,
      externalOrderId: event.externalOrderId,
      orderType: event.orderType ?? 'DELIVERY',
      customerName: event.customer?.name ?? 'Cliente',
      customerPhone: event.customer?.phone ?? '',
      deliveryAddress: this.formatAddress(event.customer),
      neighborhood: event.customer?.neighborhood,
      paymentMethod: provider.mapPaymentMethod(event.paymentMethod ?? 'PIX'),
      items: resolvedItems,
      deliveryFee: event.deliveryFee ?? 0,
      notes: event.notes,
    });

    // Vincula IntegrationOrder ao Order interno
    await this.prisma.integrationOrder.update({
      where: { id: intOrder.id },
      data: { orderId: order.id, ackSentAt: new Date() },
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
      this.logger.warn(
        `[Integrations] STATUS_CHANGED sem orderId interno: ${event.externalOrderId}`,
      );
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
      data: { externalStatus: event.externalStatus, updatedAt: new Date() },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async resolveItems(
    companyId: string,
    providerName: string,
    externalItems: Array<{
      externalProductId: string;
      quantity: number;
      unitPrice: number;
      notes?: string;
    }>,
    isMock: boolean,
  ) {
    if (isMock) {
      // Mock: externalProductId === internalProductId — sem necessidade de mapeamento
      return externalItems.map((i) => ({
        productId: i.externalProductId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        notes: i.notes,
      }));
    }

    const externalIds = externalItems.map((i) => i.externalProductId);
    const maps = await this.prisma.productCatalogMap.findMany({
      where: {
        companyId,
        provider: providerName as any,
        externalProductId: { in: externalIds },
        isActive: true,
      },
    });

    const mapIndex = new Map(
      maps.map((m) => [m.externalProductId, m.internalProductId]),
    );

    return externalItems
      .filter((i) => mapIndex.has(i.externalProductId))
      .map((i) => ({
        productId: mapIndex.get(i.externalProductId)!,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        notes: i.notes,
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
    ]
      .filter(Boolean)
      .join(', ');
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
          provider: provider as any,
          eventType,
          externalOrderId: externalOrderId ?? null,
          status,
          errorMessage: errorMessage ?? null,
          rawPayload: rawPayload ? (rawPayload as any) : undefined,
          processedAt: status !== 'RECEIVED' ? new Date() : undefined,
        },
      });
    } catch (e: any) {
      this.logger.warn(`[Integrations] logEvent failed: ${e?.message}`);
    }
  }
}
