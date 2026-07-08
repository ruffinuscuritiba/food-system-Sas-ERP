import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CompanyId } from '@/common/decorators/company-id.decorator';
import { TotemService } from './totem.service';

@Controller('totem')
export class TotemController {
  constructor(private readonly service: TotemService) {}

  // Público — o tablet do totem não tem login. Rate-limited (2 pings/min por
  // aparelho seria o normal, mas o limite é por IP; folga generosa por
  // compartilhar rede local com outros totens da mesma loja).
  @Post('heartbeat')
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  ping(@Body() body: { companyId?: string; deviceId?: string; tableNumber?: string }) {
    if (!body?.companyId || !body?.deviceId) return { ok: false };
    return this.service.ping(body.companyId, body.deviceId, body.tableNumber);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  status(@CompanyId() companyId: string) {
    return this.service.status(companyId);
  }
}
