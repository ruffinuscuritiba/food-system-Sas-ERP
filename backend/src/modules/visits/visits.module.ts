import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '@/database/prisma.module';
import { SuperAdminGuard } from '@/modules/super-admin/super-admin.guard';
import { VisitsService } from './visits.service';
import { VisitsController } from './visits.controller';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret:
          cfg.get<string>('JWT_SECRET') ||
          (() => {
            throw new Error('JWT_SECRET env var is required');
          })(),
        signOptions: { expiresIn: '8h' },
      }),
    }),
  ],
  providers: [VisitsService, SuperAdminGuard],
  controllers: [VisitsController],
})
export class VisitsModule {}
