import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const auth = request.headers.authorization as string | undefined
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token não fornecido')
    }
    const token = auth.slice(7)
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET') ||
          (() => { throw new Error('JWT_SECRET env var is required') })(),
      })
      if (payload.role !== 'SYSTEM_SUPER_ADMIN') {
        throw new UnauthorizedException('Acesso negado')
      }
      request.superAdmin = payload
      return true
    } catch {
      throw new UnauthorizedException('Token inválido')
    }
  }
}
