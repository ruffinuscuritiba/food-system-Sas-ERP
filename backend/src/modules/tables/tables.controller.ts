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

@UseGuards(
  JwtAuthGuard,
  SubscriptionGuard,
  ModuleGuard,
)

@Module('TABLES')

export class TablesController {

  constructor(
    private service: TablesService,
  ) {}

  @Get()
  findAll(@Request() req: any) {

    return this.service.findAll(
      req.user.companyId,
    );
  }

  @Post()
  create(

    @Body() body: any,

    @Request() req: any,

  ) {

    return this.service.create({
      ...body,

      companyId:
        req.user.companyId,
    });
  }

  @Patch(':id/status')
  updateStatus(

    @Param('id') id: string,

    @Body('status') status: string,

  ) {

    return this.service.updateStatus(
      id,
      status,
    );
  }
  @Patch(':id/order')
saveOrder(

  @Param('id') id: string,

  @Body() body: any,

) {

  return this.service.saveOrder(
    id,
    body,
  );
}
@Get('orders/history')
findOrders() {

  return this.service.findOrders();
}
@Get('dashboard')
dashboard() {

  return this.service.dashboard();
}
}