import {
  Body, Controller, Delete, Get, Param, Patch, Post,
  Query, Req, Res, UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard }  from '@/common/guards/jwt-auth.guard';
import { RolesGuard }    from '@/common/guards/roles.guard';
import { Roles }         from '@/common/decorators/roles.decorator';
import { CompanyId }     from '@/common/decorators/company-id.decorator';
import { QrCampaignsService, extractRealIp } from './qr-campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { ValidateTokenDto }  from './dto/validate-token.dto';
import { RedeemTokenDto }    from './dto/redeem-token.dto';

// ─── Admin — protegido por JWT ────────────────────────────────────────────────
@Controller('qr-campaigns')
export class QrCampaignsController {
  constructor(private readonly svc: QrCampaignsService) {}

  // Listar campanhas
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  listCampaigns(@CompanyId() companyId: string) {
    return this.svc.listCampaigns(companyId);
  }

  // Criar campanha
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  createCampaign(@CompanyId() companyId: string, @Body() dto: CreateCampaignDto) {
    return this.svc.createCampaign(companyId, dto);
  }

  // Ativar / Desativar
  @Patch(':id/toggle')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  toggle(
    @CompanyId() companyId: string,
    @Param('id') id: string,
    @Body('status') status: boolean,
  ) {
    return this.svc.toggleCampaign(id, companyId, status);
  }

  // Deletar
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  delete(@CompanyId() companyId: string, @Param('id') id: string) {
    return this.svc.deleteCampaign(id, companyId);
  }

  // Métricas dashboard
  @Get('metrics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  metrics(
    @CompanyId() companyId: string,
    @Query('days') days?: string,
  ) {
    return this.svc.getMetrics(companyId, days ? parseInt(days) : 30);
  }

  // Histórico de QR codes
  @Get('qr-codes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  listQrCodes(
    @CompanyId() companyId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listQrCodes(
      companyId,
      page  ? parseInt(page)  : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  // ── Checkout — chamado pelo cardápio antes de finalizar ──────────────────

  /** Valida token e retorna o valor do desconto (sem marcar como usado) */
  @Post('checkout/validate')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  validateCheckout(
    @Body() dto: ValidateTokenDto,
    @Query('companyId') companyId: string,
    @Req() req: any,
  ) {
    const ip = extractRealIp(req);
    const ua = req.headers?.['user-agent'] ?? '';
    return this.svc.validateForCheckout(companyId, dto, ip, ua);
  }

  /** Marca o cupom como usado e grava o redemption (chamado ao finalizar pedido) */
  @Post('checkout/redeem')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  redeem(
    @Body() dto: RedeemTokenDto,
    @Query('companyId') companyId: string,
    @Req() req: any,
  ) {
    const ip = extractRealIp(req);
    const ua = req.headers?.['user-agent'] ?? '';
    return this.svc.redeem(companyId, dto, ip, ua);
  }
}

// ─── Redirect público — sem JWT ───────────────────────────────────────────────
@Controller('r')
export class QrRedirectController {
  constructor(private readonly svc: QrCampaignsService) {}

  /**
   * GET /r/:token
   * Valida o token, grava metadados de sessão no cookie e redireciona
   * para o cardápio digital do tenant.
   */
  @Get(':token')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async redirect(
    @Param('token') rawToken: string,
    @Req()  req: any,
    @Res()  res: Response,
  ) {
    try {
      const { sessionPayload, cardapioUrl } = await this.svc.resolveToken(rawToken);

      // Cookie HttpOnly não é acessível por JS malicioso (XSS mitigation).
      // Signed=false aqui porque o front lê via JS — usar payload JSON encodado.
      // Para segurança máxima o front pode usar localStorage após receber via
      // query string criptografada; esta impl usa cookie não-HttpOnly para
      // compatibilidade com o Next.js/browser direto.
      const cookieValue = Buffer.from(
        JSON.stringify(sessionPayload),
      ).toString('base64');

      res.cookie('qr_promo', cookieValue, {
        httpOnly: false,          // precisa ser lido pelo JS do cardápio
        secure:   true,
        sameSite: 'lax',
        maxAge:   60 * 60 * 1000, // 1h
        path:     '/',
      });

      // 302 para o cardápio com token como fallback na query string
      const target = new URL(cardapioUrl);
      target.searchParams.set('qr', sessionPayload.token);
      return res.redirect(302, target.toString());
    } catch (err: any) {
      // Erros de negócio (expirado, já usado) → redireciona para cardápio sem promo
      const fallback = `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? ''}/menu`;
      return res.redirect(302, fallback);
    }
  }
}
