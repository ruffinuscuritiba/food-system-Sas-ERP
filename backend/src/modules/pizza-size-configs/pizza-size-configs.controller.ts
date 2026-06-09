import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Request,
  UseGuards,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { PizzaSizeConfigsService } from './pizza-size-configs.service';

type PizzaSize = 'PEQUENA' | 'MEDIA' | 'GRANDE' | 'FAMILIA' | 'EXTRA_GRANDE';

@Controller('pizza-size-configs')
export class PizzaSizeConfigsController {
  constructor(private service: PizzaSizeConfigsService) {}

  /** GET /api/pizza-size-configs/public?companyId=xxx — sem auth, para o cardápio */
  @Get('public')
  findPublic(@Query('companyId') companyId: string) {
    return this.service.findAll(companyId);
  }

  /** GET /api/pizza-size-configs — lista todos os tamanhos configurados */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER', 'KITCHEN')
  findAll(@Request() req: any) {
    return this.service.findAll(req.user.companyId);
  }

  /** PATCH /api/pizza-size-configs/:size — atualiza um tamanho */
  @Patch(':size')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  update(
    @Param('size') size: PizzaSize,
    @Body()
    body: {
      slices?: number;
      maxFlavors?: number;
      isActive?: boolean;
      label?: string;
    },
    @Request() req: any,
  ) {
    return this.service.update(req.user.companyId, size, body);
  }
}
