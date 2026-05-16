import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { StockService } from './stock.service';

import { StockMovementType } from '@prisma/client';

@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get(':companyId/movements')
  async getMovements(@Param('companyId') companyId: string) {
    return this.stockService.getMovements(companyId);
  }

  @Post('entry')
  async addStock(
    @Body()
    body: {
      ingredientId: string;
      quantity: number;
      companyId: string;
      reason?: string;
    },
  ) {
    return this.stockService.createMovement({
      ingredientId: body.ingredientId,
      quantity: body.quantity,
      companyId: body.companyId,
      type: StockMovementType.ENTRY,
      reason: body.reason || 'Entrada manual estoque',
    });
  }

  @Post('loss')
  async registerLoss(
    @Body()
    body: {
      ingredientId: string;
      quantity: number;
      companyId: string;
      reason?: string;
    },
  ) {
    return this.stockService.createMovement({
      ingredientId: body.ingredientId,
      quantity: body.quantity,
      companyId: body.companyId,
      type: StockMovementType.LOSS,
      reason: body.reason || 'Perda estoque',
    });
  }

  @Patch('inventory')
  async inventoryAdjust(
    @Body()
    body: {
      ingredientId: string;
      quantity: number;
      companyId: string;
      reason?: string;
    },
  ) {
    return this.stockService.createMovement({
      ingredientId: body.ingredientId,
      quantity: body.quantity,
      companyId: body.companyId,
      type: StockMovementType.INVENTORY,
      reason: body.reason || 'Inventário estoque',
    });
  }

  @Patch('adjustment')
  async adjustment(
    @Body()
    body: {
      ingredientId: string;
      quantity: number;
      companyId: string;
      reason?: string;
    },
  ) {
    return this.stockService.createMovement({
      ingredientId: body.ingredientId,
      quantity: body.quantity,
      companyId: body.companyId,
      type: StockMovementType.ADJUSTMENT,
      reason: body.reason || 'Ajuste manual estoque',
    });
  }
  @Get(':companyId/low-stock')
async getLowStock(
  @Param('companyId')
  companyId: string,
) {
  return this.stockService.getLowStock(
    companyId,
  );
}
@Get(':companyId/dashboard')
async dashboard(
  @Param('companyId')
  companyId: string,
) {
  return this.stockService.dashboard(
    companyId,
  );
}
}