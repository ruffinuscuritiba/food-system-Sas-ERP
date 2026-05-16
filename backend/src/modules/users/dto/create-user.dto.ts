import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  MinLength,
} from 'class-validator';

import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @MinLength(6)
  password: string;

  @IsEnum(Role)
  role: Role;

  @IsNotEmpty()
  companyId: string;
}