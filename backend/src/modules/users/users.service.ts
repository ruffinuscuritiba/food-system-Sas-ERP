import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

import { CreateUserDto } from './dto/create-user.dto';

import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
  ) {}

  async create(dto: CreateUserDto) {
    const userExists =
      await this.prisma.user.findUnique({
        where: {
          email: dto.email,
        },
      });

    if (userExists) {
      throw new BadRequestException(
        'Email already exists',
      );
    }

    const hashedPassword =
      await bcrypt.hash(dto.password, 10);

    const user =
      await this.prisma.user.create({
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
}