import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  RawBodyRequest,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { IntegrationsService } from './integrations.service';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] as const;

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly service: IntegrationsService) {}

  // ── Config ────────────────────────────────────────────────────────────────

  @Get('config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  getConfig(@Req() req: any, @Query('provider') provider?: string) {
    return this.service.getConfig(req.user.companyId, provider);
  }

  @Put('config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  upsertConfig(
    @Req() req: any,
    @Body()
    body: {
      provider: string;
      clientId?: string;
      clientSecret?: string;
      merchantId?: string;
      webhookSecret?: string;
      sandboxMode?: boolean;
      isActive?: boolean;
    },
  ) {
    return this.service.upsertConfig(req.user.companyId, body);
  }

  // ── Catalog maps ──────────────────────────────────────────────────────────

  @Get('catalog/maps')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  listCatalogMaps(@Req() req: any, @Query('provider') provider?: string) {
    return this.service.listCatalogMaps(req.user.companyId, provider);
  }

  @Put('catalog/maps')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  upsertCatalogMap(
    @Req() req: any,
    @Body()
    body: {
      provider: string;
      externalProductId: string;
      internalProductId: string;
      externalVariantId?: string;
      sizeMapping?: Record<string, unknown>;
    },
  ) {
    return this.service.upsertCatalogMap(req.user.companyId, body);
  }

  @Delete('catalog/maps/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  deleteCatalogMap(@Param('id') id: string, @Req() req: any) {
    return this.service.deleteCatalogMap(id, req.user.companyId);
  }

  // ── Validação de conexão + sincronização de catálogo ─────────────────────

  @Post('test-connection')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  testConnection(@Req() req: any, @Body() body: { provider: string }) {
    return this.service.testConnection(req.user.companyId, body.provider);
  }

  @Post('push-catalog')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  pushCatalog(@Req() req: any, @Body() body: { provider: string }) {
    return this.service.pushCatalog(req.user.companyId, body.provider);
  }

  // ── Event log ──────────────────────────────────────────────────────────────

  @Get('events')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  listEvents(@Req() req: any, @Query('limit') limit?: string) {
    return this.service.listEvents(
      req.user.companyId,
      limit ? Number(limit) : 50,
    );
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  listIntegrationOrders(@Req() req: any, @Query('limit') limit?: string) {
    return this.service.listIntegrationOrders(
      req.user.companyId,
      limit ? Number(limit) : 50,
    );
  }

  // ── Mock simulation (PASSO 6) ─────────────────────────────────────────────

  @Post('mock/simulate-order')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  simulateMockOrder(
    @Req() req: any,
    @Body()
    body: {
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
    return this.service.simulateMockOrder(req.user.companyId, body);
  }

  // ── Callback URL do OAuth iFood (campo exigido no cadastro do app) ───────
  // Placeholder seguro: existe pra o formulário de "Criar App" no Portal do
  // Parceiro ter um destino válido. A troca do "code" por token será ligada
  // assim que soubermos o formato exato exigido nessa etapa (ver nota no
  // service). Nunca expõe o code recebido na resposta.

  @Get('ifood/oauth/callback')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async ifoodOAuthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    await this.service.recordOAuthCallback(state, code);
    res
      .status(200)
      .type('html')
      .send(
        `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>R_FoodSaaS — Autorização iFood</title></head>` +
          `<body style="font-family:system-ui,sans-serif;background:#07090f;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">` +
          `<div style="text-align:center;max-width:420px;padding:24px">` +
          `<h1 style="color:#f97316;font-size:20px">Autorização recebida ✅</h1>` +
          `<p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.5">` +
          `Recebemos a autorização do iFood. Nossa equipe vai concluir a vinculação da loja em instantes. ` +
          `Se precisar de ajuda, fale com o suporte.</p></div></body></html>`,
      );
  }

  // ── Webhook público (sem JWT — callback externo) ───────────────────────────
  // Rota: POST /api/integrations/webhook/:companyId/:provider
  // O restaurante configura essa URL no painel do marketplace.

  @Post('webhook/:companyId/:provider')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async handleWebhook(
    @Param('companyId') companyId: string,
    @Param('provider') provider: string,
    @Req() req: RawBodyRequest<Request>,
    @Body() body: unknown,
  ) {
    const headers = req.headers as Record<string, string>;
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(body));
    return this.service.processWebhook(
      companyId,
      provider,
      headers,
      body,
      rawBody,
    );
  }
}
