import {
  Body,
  Controller,
  Get,
  Param,
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

  // Fechamento às cegas: o operador só envia o valor contado.
  // O retorno inclui a comparação, mas o FRONTEND só deve exibi-la
  // para roles ADMIN/MANAGER/SUPER_ADMIN — CASHIER vê apenas confirmação.
  @Patch('close')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')
  close(@Body() body: any, @Request() req: any) {
    return this.service.close(
      req.user.companyId,
      req.user.userId ?? null,
      Number(body.declaredValue),
    );
  }

  // Histórico de fechamentos — restrito a gestão (conferência das diferenças).
  @Get('history')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  history(@Request() req: any) {
    return this.service.history(req.user.companyId);
  }

  // Cupom de Auditoria — resumo de cartão/PIX daquela sessão de caixa.
  @Get(':id/audit-summary')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  auditSummary(@Param('id') id: string, @Request() req: any) {
    return this.service.auditSummary(id, req.user.companyId);
  }
}
