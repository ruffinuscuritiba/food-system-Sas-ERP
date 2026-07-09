import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';

import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @MinLength(6)
  password!: string;

  @IsEnum(Role)
  role!: Role;

  // IDs do Prisma são cuid (ex: "cmrcgugi9..."), não UUID — @IsUUID() rejeitava
  // todo companyId real e quebrava a criação de usuário com 400 silencioso.
  @IsString()
  @IsNotEmpty()
  companyId!: string;
}
