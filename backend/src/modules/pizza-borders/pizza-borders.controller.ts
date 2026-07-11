import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  PizzaBordersService,
  CreateBorderDto,
  UpdateBorderDto,
} from './pizza-borders.service';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('pizza-borders')
export class PizzaBordersController {
  constructor(private service: PizzaBordersService) {}

  @Get()
  findAll(@Request() req: any) {
    return this.service.findAll(req.user.companyId);
  }

  @Post()
  create(@Body() body: CreateBorderDto, @Request() req: any) {
    return this.service.create(req.user.companyId, body);
  }

  @Patch('reorder')
  reorder(
    @Body() body: { items: { id: string; sortOrder: number }[] },
    @Request() req: any,
  ) {
    return this.service.reorder(req.user.companyId, body.items);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateBorderDto,
    @Request() req: any,
  ) {
    return this.service.update(id, req.user.companyId, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.service.remove(id, req.user.companyId);
  }
}
