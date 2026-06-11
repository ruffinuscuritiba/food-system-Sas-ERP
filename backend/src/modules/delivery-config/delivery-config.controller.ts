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
import { ModuleGuard } from '@/common/guards/module.guard';
import { RequiredModule } from '@/common/decorators/required-module.decorator';

@Controller('delivery-config')
export class DeliveryConfigController {
  constructor(private readonly service: DeliveryConfigService) {}

  // Public — cardápio digital fetches zones for delivery fee (no auth required)
  @Get('public')
  findPublic(@Query('companyId') companyId: string) {
    return this.service.findAllPublic(companyId);
  }

  @UseGuards(JwtAuthGuard, ModuleGuard)
  @RequiredModule('delivery')
  @Get()
  findAll(@Req() req: any) {
    return this.service.findAll(req.user.companyId);
  }

  @UseGuards(JwtAuthGuard, ModuleGuard)
  @RequiredModule('delivery')
  @Post()
  create(@Body() body: any, @Req() req: any) {
    return this.service.create(req.user.companyId, body);
  }

  @UseGuards(JwtAuthGuard, ModuleGuard)
  @RequiredModule('delivery')
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.service.update(id, req.user.companyId, body);
  }

  @UseGuards(JwtAuthGuard, ModuleGuard)
  @RequiredModule('delivery')
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user.companyId);
  }
}
