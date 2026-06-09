import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { StockService } from './stock.service';
import { StockMovementType } from '@prisma/client';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { ModuleGuard } from 'src/modules/auth/module.guard';
import { Module } from 'src/modules/auth/module.decorator';

@Controller('stock')
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@Module('STOCK')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('movements')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  async getMovements(@Request() req: any) {
    return this.stockService.getMovements(req.user.companyId);
  }

  @Get('low-stock')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  async getLowStock(@Request() req: any) {
    return this.stockService.getLowStock(req.user.companyId);
  }

  @Get('dashboard')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  async dashboard(@Request() req: any) {
    return this.stockService.dashboard(req.user.companyId);
  }

  @Post('entry')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  async addStock(
    @Body() body: { ingredientId: string; quantity: number; reason?: string },
    @Request() req: any,
  ) {
    return this.stockService.createMovement({
      ingredientId: body.ingredientId,
      quantity: body.quantity,
      companyId: req.user.companyId,
      type: StockMovementType.ENTRY,
      reason: body.reason || 'Entrada manual estoque',
    });
  }

  @Post('loss')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  async registerLoss(
    @Body() body: { ingredientId: string; quantity: number; reason?: string },
    @Request() req: any,
  ) {
    return this.stockService.createMovement({
      ingredientId: body.ingredientId,
      quantity: body.quantity,
      companyId: req.user.companyId,
      type: StockMovementType.LOSS,
      reason: body.reason || 'Perda estoque',
    });
  }

  @Patch('inventory')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  async inventoryAdjust(
    @Body() body: { ingredientId: string; quantity: number; reason?: string },
    @Request() req: any,
  ) {
    return this.stockService.createMovement({
      ingredientId: body.ingredientId,
      quantity: body.quantity,
      companyId: req.user.companyId,
      type: StockMovementType.INVENTORY,
      reason: body.reason || 'Inventário estoque',
    });
  }

  @Patch('adjustment')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  async adjustment(
    @Body() body: { ingredientId: string; quantity: number; reason?: string },
    @Request() req: any,
  ) {
    return this.stockService.createMovement({
      ingredientId: body.ingredientId,
      quantity: body.quantity,
      companyId: req.user.companyId,
      type: StockMovementType.ADJUSTMENT,
      reason: body.reason || 'Ajuste manual estoque',
    });
  }
}
