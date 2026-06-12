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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, ResetPasswordDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Lista usuários da empresa logada */
  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  findAll(@Request() req: any) {
    return this.usersService.findByCompany(req.user.companyId);
  }

  /** Cria usuário na empresa logada */
  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  async create(@Body() dto: CreateUserDto, @Request() req: any) {
    const companyId =
      req.user.role === 'SUPER_ADMIN' ? dto.companyId : req.user.companyId;
    return this.usersService.create({ ...dto, companyId });
  }

  /** Redefine senha — deve vir ANTES de :id para evitar match errado */
  @Post(':id/reset-password')
  @Roles('SUPER_ADMIN', 'ADMIN')
  resetPassword(
    @Param('id') id: string,
    @Body() body: ResetPasswordDto,
    @Request() req: any,
  ) {
    return this.usersService.resetPassword(id, req.user.companyId, body.newPassword);
  }

  /** Busca um usuário */
  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.usersService.findOne(id, req.user.companyId);
  }

  /** Atualiza nome/email/role/isActive */
  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Request() req: any,
  ) {
    return this.usersService.updateUser(id, req.user.companyId, dto);
  }

  /** Remove usuário (hard delete) */
  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.usersService.deleteUser(id, req.user.companyId);
  }
}
