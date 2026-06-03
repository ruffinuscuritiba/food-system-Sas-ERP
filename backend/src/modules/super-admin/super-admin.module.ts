import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { PrismaModule } from '@/database/prisma.module'
import { SuperAdminController } from './super-admin.controller'
import { SuperAdminService } from './super-admin.service'
import { SuperAdminGuard } from './super-admin.guard'
import { DemoVitrineService } from './demo-vitrine.service'

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET') || 'secret',
        signOptions: { expiresIn: '8h' },
      }),
    }),
  ],
  controllers: [SuperAdminController],
  providers: [SuperAdminService, SuperAdminGuard, DemoVitrineService],
})
export class SuperAdminModule {}
