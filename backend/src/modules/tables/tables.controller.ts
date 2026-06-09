import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';

import { TablesService } from './tables.service';

import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';

import { SubscriptionGuard } from 'src/modules/auth/subscription.guard';

import { ModuleGuard } from 'src/modules/auth/module.guard';

import { Module } from 'src/modules/auth/module.decorator';

@Controller('tables')
@UseGuards(JwtAuthGuard, SubscriptionGuard, ModuleGuard)
@Module('TABLES')
export class TablesController {
  constructor(private service: TablesService) {}

  @Get()
  findAll(@Request() req: any) {
    return this.service.findAll(req.user.companyId);
  }

  @Post()
  create(
    @Body() body: any,

    @Request() req: any,
  ) {
    return this.service.create({
      ...body,

      companyId: req.user.companyId,
    });
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,

    @Body('status') status: string,

    @Request() req: any,
  ) {
    return this.service.updateStatus(id, status, req.user.companyId);
  }
  @Patch(':id/order')
  saveOrder(
    @Param('id') id: string,

    @Body() body: any,

    @Request() req: any,
  ) {
    return this.service.saveOrder(id, {
      ...body,
      companyId: req.user.companyId,
    });
  }
  @Get('orders/history')
  findOrders(@Request() req: any) {
    return this.service.findOrders(req.user.companyId);
  }
  @Get('dashboard')
  dashboard(@Request() req: any) {
    return this.service.dashboard(req.user.companyId);
  }
}
