import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { OnlineOrdersService, CreateOnlineOrderDto } from './online-orders.service';

@Controller('online-orders')
export class OnlineOrdersController {
  constructor(private readonly service: OnlineOrdersService) {}

  /** Public — customer creates order */
  @Post()
  create(@Body() dto: CreateOnlineOrderDto) {
    return this.service.create(dto);
  }

  /** Public — customer checks order status */
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
  ) {
    return this.service.findOne(id, companyId);
  }

  /** Staff — list company orders */
  @Get('company/:companyId')
  findByCompany(
    @Param('companyId') companyId: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findByCompany(companyId, limit ? parseInt(limit) : 50);
  }
}
