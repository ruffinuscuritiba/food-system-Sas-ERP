import { Module } from '@nestjs/common';
import { PrismaModule } from '@/database/prisma.module';
import { FiscalSplitService } from './fiscal-split.service';
import { SplitPaymentProviderFactory } from './providers/split-payment-provider.factory';
import { TaxCalculationService } from './tax-calculation.service';
import { FiscalSplitOrchestrationService } from './fiscal-split-orchestration.service';

// Importado por PaymentsModule/IntegrationsModule (única forma de ligar o
// domínio fiscal em fluxo real de dinheiro/pedido). Mesmo registrado, é
// no-op em produção enquanto nenhum tenant tiver TaxConfiguration.isActive
// =true — ver kill switch em TaxCalculationService.isActiveFor() e o aviso
// em FiscalSplitOrchestrationService. Nunca ativar sem validação do
// contador/tributarista do tenant.
@Module({
  imports: [PrismaModule],
  providers: [
    FiscalSplitService,
    SplitPaymentProviderFactory,
    TaxCalculationService,
    FiscalSplitOrchestrationService,
  ],
  exports: [
    FiscalSplitService,
    SplitPaymentProviderFactory,
    TaxCalculationService,
    FiscalSplitOrchestrationService,
  ],
})
export class FiscalSplitModule {}
