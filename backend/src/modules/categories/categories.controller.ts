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
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';

@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(private service: CategoriesService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN')
  findAll(@Request() req: any) {
    return this.service.findAll(req.user.companyId);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  create(
    @Body()
    body: {
      name: string;
      allowMultipleFlavors?: boolean;
      categoryType?: string;
      displayColumns?: number;
      bannerImage?: string | null;
    },
    @Request() req: any,
  ) {
    return this.service.create({ ...body, companyId: req.user.companyId });
  }

  @Patch('reorder')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  reorder(
    @Body() body: { items: { id: string; sortOrder: number }[] },
    @Request() req: any,
  ) {
    return this.service.reorder(req.user.companyId, body?.items ?? []);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      allowMultipleFlavors?: boolean;
      categoryType?: string;
      displayColumns?: number;
      bannerImage?: string | null;
    },
    @Request() req: any,
  ) {
    return this.service.update(id, req.user.companyId, body);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.service.remove(id, req.user.companyId);
  }
}
