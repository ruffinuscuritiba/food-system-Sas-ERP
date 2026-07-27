import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  PizzaBordersService,
  CreateBorderDto,
  UpdateBorderDto,
} from './pizza-borders.service';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';

@Controller('pizza-borders')
export class PizzaBordersController {
  constructor(private service: PizzaBordersService) {}

  /** GET /api/pizza-borders/public?companyId=xxx — sem auth, para o cardápio */
  @Get('public')
  findPublic(@Query('companyId') companyId: string) {
    return this.service.findAllActive(companyId);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Request() req: any) {
    return this.service.findAll(req.user.companyId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() body: CreateBorderDto, @Request() req: any) {
    return this.service.create(req.user.companyId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('reorder')
  reorder(
    @Body() body: { items: { id: string; sortOrder: number }[] },
    @Request() req: any,
  ) {
    return this.service.reorder(req.user.companyId, body.items);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateBorderDto,
    @Request() req: any,
  ) {
    return this.service.update(id, req.user.companyId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.service.remove(id, req.user.companyId);
  }
}
