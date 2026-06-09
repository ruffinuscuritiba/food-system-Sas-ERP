import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '@/database/prisma.module';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';
import { SuperAdminGuard } from './super-admin.guard';
import { DemoVitrineService } from './demo-vitrine.service';
import { DemoBootstrapService } from './demo-bootstrap.service';
import { LeadsModule } from '../leads/leads.module';

@Module({
  imports: [
    PrismaModule,
    LeadsModule,
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
  controllers: [SuperAdminController],
  providers: [
    SuperAdminService,
    SuperAdminGuard,
    DemoVitrineService,
    DemoBootstrapService,
  ],
})
export class SuperAdminModule {}
