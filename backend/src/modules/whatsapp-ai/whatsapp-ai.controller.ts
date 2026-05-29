import {
  Controller, Get, Post, Patch, Delete, Put,
  Param, Body, Query, Request, UseGuards, Res, HttpCode,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard }   from '@/common/guards/roles.guard';
import { Roles }        from '@/common/decorators/roles.decorator';
import { WhatsappAiService } from './whatsapp-ai.service';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { UpdateSettingsDto }   from './dto/update-settings.dto';

@Controller('whatsapp-ai')
export class WhatsappAiController {
  constructor(private service: WhatsappAiService) {}

  // ── WEBHOOKS (sem auth) ───────────────────────────────────────────────────

  /**
   * Evolution API webhook verification (GET) + Cloud API challenge
   * GET /api/whatsapp-ai/webhook/:connectionId?hub.verify_token=xxx&hub.challenge=yyy
   */
  @Get('webhook/:connectionId')
  @HttpCode(200)
  async webhookVerify(
    @Param('connectionId') connectionId: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge')    challenge: string,
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

  @Get('settings/:connectionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  getSettings(@Param('connectionId') connectionId: string, @Request() req: any) {
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
  findConversations(@Request() req: any, @Query('connectionId') connectionId?: string) {
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
