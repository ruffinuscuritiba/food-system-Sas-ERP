import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
  Res,
  HttpCode,
  Headers,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { WhatsappAiService } from './whatsapp-ai.service';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Controller('whatsapp-ai')
export class WhatsappAiController {
  constructor(private service: WhatsappAiService) {}

  // ── HEALTH CHECK (sem auth) ───────────────────────────────────────────────

  /**
   * GET /api/whatsapp-ai/health
   * Returns env key presence + DB connection counts.
   * No auth — safe (returns only booleans and counts, no secrets).
   */
  @Get('health')
  @HttpCode(200)
  @SkipThrottle()
  async health() {
    return this.service.getHealth();
  }

  // ── BRIDGE (sem auth — para script local Baileys) ─────────────────────────

  /**
   * Bridge: retorna mensagens ASSISTANT pendentes de envio (criadas nos últimos 30s).
   * GET /api/whatsapp-ai/bridge/outbox/:connectionId?after=lastMessageId
   */
  @Get('bridge/outbox/:connectionId')
  @HttpCode(200)
  @SkipThrottle()
  async bridgeOutbox(
    @Param('connectionId') connectionId: string,
    @Query('after') afterId?: string,
  ) {
    return this.service.getBridgeOutbox(connectionId, afterId);
  }

  // ── WEBHOOKS (sem auth) ───────────────────────────────────────────────────

  /**
   * Mercado Pago webhook for WhatsApp orders (exact path — must precede /:connectionId).
   * POST /api/whatsapp-ai/webhook/mp-payment
   */
  @Post('webhook/mp-payment')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async webhookMpPayment(@Body() body: any, @Query() query: any) {
    await this.service.handleMpPaymentWebhook(body, query).catch(() => {});
    return { ok: true };
  }

  /**
   * Evolution API webhook verification (GET) + Cloud API challenge
   * GET /api/whatsapp-ai/webhook/:connectionId?hub.verify_token=xxx&hub.challenge=yyy
   */
  @Get('webhook/:connectionId')
  @HttpCode(200)
  async webhookVerify(
    @Param('connectionId') connectionId: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    // Cloud API challenge
    if (challenge) {
      res.status(200).send(challenge);
      return;
    }
    res.status(200).json({ ok: true });
  }

  /**
   * Incoming messages webhook
   * POST /api/whatsapp-ai/webhook/:connectionId
   */
  @Post('webhook/:connectionId')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async webhookIncoming(
    @Param('connectionId') connectionId: string,
    @Body() body: any,
  ) {
    // Detect provider from payload shape
    if (body?.entry) {
      // Cloud API (Meta)
      return this.service.handleCloudApiWebhook(connectionId, body);
    }
    // Default: Evolution API
    return this.service.handleEvolutionWebhook(connectionId, body);
  }

  // ── CONNECTIONS ───────────────────────────────────────────────────────────

  @Get('connections')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  findConnections(@Request() req: any) {
    return this.service.findConnections(req.user.companyId);
  }

  @Post('connections')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  createConnection(@Body() dto: CreateConnectionDto, @Request() req: any) {
    return this.service.createConnection(req.user.companyId, dto);
  }

  /**
   * POST /api/whatsapp-ai/connections/provision
   * Creates a managed connection + Evolution API instance. Returns QR code.
   * Body: { name: string }
   */
  @Post('connections/provision')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  provisionConnection(@Body() body: { name: string }, @Request() req: any) {
    return this.service.provisionConnection(req.user.companyId, body.name);
  }

  /**
   * GET /api/whatsapp-ai/connections/:id/qr
   * Returns { qrCode: string|null, state: 'open'|'connecting'|'close' }
   */
  @Get('connections/:id/qr')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  getConnectionQr(@Param('id') id: string, @Request() req: any) {
    return this.service.getConnectionQr(id, req.user.companyId);
  }

  @Patch('connections/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  updateConnection(
    @Param('id') id: string,
    @Body() dto: Partial<CreateConnectionDto>,
    @Request() req: any,
  ) {
    return this.service.updateConnection(id, req.user.companyId, dto);
  }

  @Delete('connections/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  deleteConnection(@Param('id') id: string, @Request() req: any) {
    return this.service.deleteConnection(id, req.user.companyId);
  }

  // ── SETTINGS ──────────────────────────────────────────────────────────────

  /**
   * GET /api/whatsapp-ai/settings/public/assistant-name?companyId=X
   * Sem auth — usado pelo cardápio digital para exibir o nome real do
   * atendente configurado pela loja (fallback "Atendente").
   */
  @Get('settings/public/assistant-name')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  getPublicAssistantName(@Query('companyId') companyId: string) {
    return this.service.getPublicAssistantName(companyId);
  }

  @Get('settings/:connectionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  getSettings(
    @Param('connectionId') connectionId: string,
    @Request() req: any,
  ) {
    return this.service.getSettings(connectionId, req.user.companyId);
  }

  @Put('settings/:connectionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  upsertSettings(
    @Param('connectionId') connectionId: string,
    @Body() dto: UpdateSettingsDto,
    @Request() req: any,
  ) {
    return this.service.upsertSettings(connectionId, req.user.companyId, dto);
  }

  // ── CONVERSATIONS ─────────────────────────────────────────────────────────

  @Get('conversations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')
  findConversations(
    @Request() req: any,
    @Query('connectionId') connectionId?: string,
  ) {
    return this.service.findConversations(req.user.companyId, connectionId);
  }

  @Get('conversations/:id/messages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')
  findMessages(@Param('id') id: string, @Request() req: any) {
    return this.service.findMessages(id, req.user.companyId);
  }

  @Patch('conversations/:id/mode')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')
  setMode(
    @Param('id') id: string,
    @Body('mode') mode: string,
    @Request() req: any,
  ) {
    return this.service.setConversationMode(id, req.user.companyId, mode);
  }

  @Patch('conversations/:id/ai-disabled')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')
  setAiDisabled(
    @Param('id') id: string,
    @Body('aiDisabled') aiDisabled: boolean,
    @Request() req: any,
  ) {
    return this.service.setAiDisabled(id, req.user.companyId, aiDisabled);
  }

  @Post('conversations/:id/send')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')
  sendManual(
    @Param('id') id: string,
    @Body('text') text: string,
    @Request() req: any,
  ) {
    return this.service.sendManualMessage(id, req.user.companyId, text);
  }

  // ── STATS ─────────────────────────────────────────────────────────────────

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  getStats(@Request() req: any) {
    return this.service.getStats(req.user.companyId);
  }
}
