import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

import * as bcrypt from 'bcrypt';

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const userExists = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (userExists) {
      throw new BadRequestException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        role: dto.role,
        companyId: dto.companyId,
      },
    });

    return user;
  }

  async findByCompany(companyId: string) {
    return this.prisma.user.findMany({
      where: { companyId },
      select: USER_SELECT,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, companyId },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async updateUser(id: string, companyId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findFirst({ where: { id, companyId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    if (dto.email && dto.email !== user.email) {
      const conflict = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (conflict) throw new BadRequestException('E-mail já cadastrado');
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name     !== undefined && { name: dto.name }),
        ...(dto.email    !== undefined && { email: dto.email }),
        ...(dto.role     !== undefined && { role: dto.role }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: USER_SELECT,
    });
  }

  async deleteUser(id: string, companyId: string) {
    const user = await this.prisma.user.findFirst({ where: { id, companyId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    await this.prisma.user.delete({ where: { id } });
    return { message: 'Usuário removido' };
  }

  async resetPassword(id: string, companyId: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({ where: { id, companyId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id }, data: { password: hashed } });
    return { message: 'Senha redefinida com sucesso' };
  }
}
