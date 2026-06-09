import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  OnlineOrdersService,
  CreateOnlineOrderDto,
} from './online-orders.service';

@Controller('online-orders')
export class OnlineOrdersController {
  constructor(private readonly service: OnlineOrdersService) {}

  /** Public — customer creates order */
  @Post()
  create(@Body() dto: CreateOnlineOrderDto) {
    return this.service.create(dto);
  }

  /**
   * Public — customer tracking page polls this to get current status.
   * Retorna apenas info de status (sem dados sensíveis como endereço/itens).
   * Não exige companyId — orderId (cuid 25 chars) já é o "segredo".
   */
  @Get(':id/public-status')
  async getPublicStatus(@Param('id') id: string) {
    return this.service.getPublicStatus(id);
  }

  /** Public — customer checks order status (com companyId) */
  @Get(':id')
  findOne(@Param('id') id: string, @Query('companyId') companyId: string) {
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
