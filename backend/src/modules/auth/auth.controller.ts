import {
  Body,
  Controller,
  Post,
} from '@nestjs/common'

import { AuthService } from './auth.service'

import { LoginDto } from './dto/login.dto'

import { RegisterDto } from './dto/register.dto'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly service: AuthService,
  ) {}

  @Post('signup')
  signup(@Body() body: { companyName: string; name: string; email: string; password: string }) {
    return this.service.signup(body)
  }

  @Post('register')
  register(
    @Body()
    dto: RegisterDto,
  ) {
    return this.service.register(dto)
  }

  @Post('login')
  login(
    @Body()
    dto: LoginDto,
  ) {
    return this.service.login(dto)
  }
}