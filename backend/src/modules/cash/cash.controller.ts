import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CashService } from './cash.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';

@Controller('cash')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CashController {
  constructor(private readonly service: CashService) {}

  @Get('current')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')
  current(@Request() req: any) {
    return this.service.current(req.user.companyId);
  }

  @Post('open')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')
  open(@Body() body: any, @Request() req: any) {
    return this.service.open(body.openingValue, req.user.companyId);
  }

  @Post('movement')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')
  movement(@Body() body: any, @Request() req: any) {
    return this.service.movement(body.type, body.value, req.user.companyId);
  }

  @Patch('close')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')
  close(@Request() req: any) {
    return this.service.close(req.user.companyId);
  }
}
