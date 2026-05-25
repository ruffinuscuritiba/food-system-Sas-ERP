import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { IngredientsService } from './ingredients.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';

@Controller('ingredients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  findAll(@Request() req: any) {
    return this.ingredientsService.findAll(req.user.companyId);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  create(
    @Body('name') name: string,
    @Body('stock') stock: string,
    @Body('minimumStock') minimumStock: string,
    @Body('unit') unit: string,
    @Body('cost') cost: string,
    @Request() req: any,
  ) {
    return this.ingredientsService.create({
      name,
      stock,
      minimumStock,
      unit,
      cost,
      companyId: req.user.companyId,
    });
  }
}
