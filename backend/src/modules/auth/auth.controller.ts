import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Post('signup')
  signup(
    @Body()
    body: {
      companyName: string;
      name: string;
      email: string;
      password: string;
    },
  ) {
    return this.service.signup(body);
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.service.register(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.service.login(dto);
  }

  /** Gating endpoint for demo access: saves lead + sends admin email + returns demo JWT. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('demo-access')
  demoAccess(
    @Body()
    body: {
      name: string;
      email: string;
      whatsapp: string;
      restaurantName: string;
      plan: 'basic' | 'pro' | 'enterprise';
    },
  ) {
    return this.service.demoAccess({
      name:           String(body.name || '').slice(0, 100),
      email:          String(body.email || '').slice(0, 100),
      whatsapp:       String(body.whatsapp || '').slice(0, 30),
      restaurantName: String(body.restaurantName || '').slice(0, 100),
      plan:           body.plan,
    });
  }
}
