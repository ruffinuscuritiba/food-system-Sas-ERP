import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Somente ADMIN pode criar usuários na própria empresa */
  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  async create(@Body() dto: CreateUserDto, @Request() req: any) {
    // SUPER_ADMIN pode criar em qualquer empresa (impersonation), ADMIN só na sua
    const companyId = req.user.role === 'SUPER_ADMIN' ? dto.companyId : req.user.companyId;
    return this.usersService.create({ ...dto, companyId });
  }
}
