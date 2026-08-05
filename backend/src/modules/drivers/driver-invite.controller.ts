import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DriversService } from './drivers.service';
import { AcceptInviteDto } from './dto/accept-invite.dto';

/**
 * Sem auth de propósito — o entregador ainda não tem senha nesse ponto
 * (é exatamente o que este endpoint resolve). Controller separado do
 * DriversController pra não herdar o @UseGuards(JwtAuthGuard) de classe.
 */
@Controller('drivers/invite')
export class DriverInviteController {
  constructor(private readonly service: DriversService) {}

  @Post('accept')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  accept(@Body() dto: AcceptInviteDto) {
    return this.service.acceptInvite(dto.token, dto.password);
  }
}
