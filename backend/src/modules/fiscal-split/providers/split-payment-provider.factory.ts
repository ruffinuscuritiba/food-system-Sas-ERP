import { BadRequestException, Injectable } from '@nestjs/common';
import { ISplitPaymentProvider } from './split-payment-provider.interface';
import { NoopSplitPaymentProvider } from './noop/noop-split-payment.provider';

// Mesmo padrão de IntegrationProviderFactory (integrations/providers). Só
// "NOOP" registrado por enquanto — nenhum PSP/adquirente real até haver
// especificação oficial de Split Payment do BC/CGIBS.
@Injectable()
export class SplitPaymentProviderFactory {
  private readonly providers = new Map<string, ISplitPaymentProvider>([
    ['NOOP', new NoopSplitPaymentProvider()],
  ]);

  get(providerName: string): ISplitPaymentProvider {
    const impl = this.providers.get((providerName ?? 'NOOP').toUpperCase());
    if (!impl) {
      throw new BadRequestException(
        `Split payment provider "${providerName}" não suportado.`,
      );
    }
    return impl;
  }

  list(): string[] {
    return Array.from(this.providers.keys());
  }
}
