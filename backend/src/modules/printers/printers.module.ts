import { Module } from '@nestjs/common';
import { AuthModule } from '@/modules/auth/auth.module';
import { PrintersService } from './printers.service';
import { PrintersController } from './printers.controller';
import { PrintersAgentController } from './printers-agent.controller';
import { PrintersGateway } from './printers.gateway';
import { PrinterAgentGuard } from './printer-agent.guard';
import { PrismaModule } from '@/database/prisma.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PrintersController, PrintersAgentController],
  providers: [PrintersService, PrintersGateway, PrinterAgentGuard],
  exports: [PrintersService, PrintersGateway],
})
export class PrintersModule {}
