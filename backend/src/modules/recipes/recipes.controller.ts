import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';

@Controller('recipes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get(':productId')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  findByProduct(@Param('productId') productId: string, @Request() req: any) {
    const companyId = req.user.role === 'SUPER_ADMIN' ? undefined : req.user.companyId;
    return this.recipesService.findByProduct(productId, companyId);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  create(@Body() body: any, @Request() req: any) {
    return this.recipesService.create({ ...body, companyId: req.user.companyId });
  }
}
