import {
  IsEmail,
  IsEnum,
  IsString,
} from 'class-validator'

import { Role } from '@prisma/client'

export class RegisterDto {

  @IsString()
  name: string

  @IsEmail()
  email: string

  @IsString()
  password: string

  @IsEnum(Role)
  role: Role

  @IsString()
  companyId: string
}