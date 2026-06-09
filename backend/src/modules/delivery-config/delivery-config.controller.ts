import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DeliveryConfigService } from './delivery-config.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@Controller('delivery-config')
export class DeliveryConfigController {
  constructor(private readonly service: DeliveryConfigService) {}

  // Public — cardápio digital fetches zones to show delivery fee before checkout
  @Get('public')
  findPublic(@Query('companyId') companyId: string) {
    return this.service.findAllPublic(companyId);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Req() req: any) {
    return this.service.findAll(req.user.companyId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() body: any, @Req() req: any) {
    return this.service.create(req.user.companyId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.service.update(id, req.user.companyId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user.companyId);
  }
}
