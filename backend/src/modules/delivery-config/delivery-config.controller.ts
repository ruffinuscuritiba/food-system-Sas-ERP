import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { DeliveryConfigService } from './delivery-config.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';

@Controller('delivery-config')
@UseGuards(JwtAuthGuard)
export class DeliveryConfigController {
  constructor(private readonly service: DeliveryConfigService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.service.findAll(req.user.companyId);
  }

  @Post()
  create(@Body() body: any, @Req() req: any) {
    return this.service.create(req.user.companyId, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.service.update(id, req.user.companyId, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user.companyId);
  }
}
