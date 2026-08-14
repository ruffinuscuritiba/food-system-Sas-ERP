import { BadRequestException, Injectable } from '@nestjs/common';
import { IIntegrationProvider } from './integration-provider.interface';
import { MockProvider } from './mock/mock.provider';
import { IfoodProvider } from './ifood/ifood.provider';
import { NinetyNineFoodProvider } from './ninety-nine-food/ninety-nine-food.provider';

@Injectable()
export class IntegrationProviderFactory {
  private readonly providers = new Map<string, IIntegrationProvider>([
    ['MOCK', new MockProvider()],
    ['IFOOD', new IfoodProvider()],
    ['NINETY_NINE_FOOD', new NinetyNineFoodProvider()],
  ]);

  get(providerName: string): IIntegrationProvider {
    const impl = this.providers.get(providerName?.toUpperCase());
    if (!impl) {
      throw new BadRequestException(
        `Provider "${providerName}" não suportado.`,
      );
    }
    return impl;
  }

  list(): string[] {
    return Array.from(this.providers.keys());
  }
}
