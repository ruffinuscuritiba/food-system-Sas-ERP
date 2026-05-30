import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Request, UseGuards, Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { ComplementsService } from './complements.service';
import { CreateComplementDto } from './dto/create-complement.dto';
import { CreateComplementOptionDto } from './dto/create-complement-option.dto';

@Controller('complements')
export class ComplementsController {
  constructor(private service: ComplementsService) {}

  // ── PUBLIC (cardápio digital, sem auth) ──────────────────────────────────────

  /** GET /api/complements/public/product/:productId?companyId=xxx */
  @Get('public/product/:productId')
  findByProductPublic(
    @Param('productId') productId: string,
    @Query('companyId') companyId: string,
  ) {
    return this.service.findByProduct(productId, companyId);
  }

  // ── PRIVADO (admin) ──────────────────────────────────────────────────────────

  /** GET /api/complements */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  findAll(@Request() req: any) {
    return this.service.findAll(req.user.companyId);
  }

  /** GET /api/complements/product/:productId */
  @Get('product/:productId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER', 'KITCHEN')
  findByProduct(@Param('productId') productId: string, @Request() req: any) {
    return this.service.findByProduct(productId, req.user.companyId);
  }

  /** POST /api/complements */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  create(@Body() dto: CreateComplementDto, @Request() req: any) {
    return this.service.create(dto, req.user.companyId);
  }

  /** PATCH /api/complements/reorder — DnD de grupos (Fase B4) */
  @Patch('reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  reorderGroups(
    @Body() body: { items: { id: string; sortOrder: number }[] },
    @Request() req: any,
  ) {
    return this.service.reorderGroups(req.user.companyId, body?.items ?? []);
  }

  /** POST /api/complements/:id/duplicate — duplica grupo + options (Fase B2) */
  @Post(':id/duplicate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  duplicate(@Param('id') id: string, @Request() req: any) {
    return this.service.duplicate(id, req.user.companyId);
  }

  /** PATCH /api/complements/:id/options/reorder — DnD de opções (Fase B4) */
  @Patch(':id/options/reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  reorderOptions(
    @Param('id') id: string,
    @Body() body: { items: { id: string; sortOrder: number }[] },
    @Request() req: any,
  ) {
    return this.service.reorderOptions(id, req.user.companyId, body?.items ?? []);
  }

  /** PATCH /api/complements/:id */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateComplementDto>,
    @Request() req: any,
  ) {
    return this.service.update(id, req.user.companyId, dto);
  }

  /** DELETE /api/complements/:id */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.service.remove(id, req.user.companyId);
  }

  // ── Options ──────────────────────────────────────────────────────────────────

  /** GET /api/complements/:id/options */
  @Get(':id/options')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')
  findOptions(@Param('id') id: string, @Request() req: any) {
    return this.service.findOptions(id, req.user.companyId);
  }

  /** POST /api/complements/:id/options */
  @Post(':id/options')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  createOption(
    @Param('id') id: string,
    @Body() dto: CreateComplementOptionDto,
    @Request() req: any,
  ) {
    return this.service.createOption(id, dto, req.user.companyId);
  }

  /** PATCH /api/complements/:id/options/:optionId */
  @Patch(':id/options/:optionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  updateOption(
    @Param('id') id: string,
    @Param('optionId') optionId: string,
    @Body() dto: Partial<CreateComplementOptionDto>,
    @Request() req: any,
  ) {
    return this.service.updateOption(optionId, id, dto, req.user.companyId);
  }

  /** DELETE /api/complements/:id/options/:optionId */
  @Delete(':id/options/:optionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  removeOption(
    @Param('id') id: string,
    @Param('optionId') optionId: string,
    @Request() req: any,
  ) {
    return this.service.removeOption(optionId, id, req.user.companyId);
  }
}
