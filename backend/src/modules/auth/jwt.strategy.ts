import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

import { ConfigService } from '@nestjs/config'

import { PassportStrategy } from '@nestjs/passport'

import {
  ExtractJwt,
  Strategy,
} from 'passport-jwt'

import { PrismaService } from '@/database/prisma.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(
  Strategy,
) {
  constructor(
    private readonly configService: ConfigService,

    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest:
        ExtractJwt.fromAuthHeaderAsBearerToken(),

      ignoreExpiration: false,

      secretOrKey:
        configService.get<string>(
          'JWT_SECRET',
        ) || 'secret',
    })
  }

  async validate(payload: {
    sub: string
    email: string
    companyId: string
    role: string
  }) {
    const user =
      await this.prisma.user.findUnique({
        where: {
          id: payload.sub,
        },
      })

    if (!user) {
      throw new UnauthorizedException(
        'Usuário não encontrado',
      )
    }

    return {
      userId: payload.sub,

      email: payload.email,

      companyId: payload.companyId,

      role: payload.role,
    }
  }
}