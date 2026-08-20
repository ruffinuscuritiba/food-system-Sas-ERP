import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { SplitPaymentProviderFactory } from './providers/split-payment-provider.factory';

/**
 * FiscalSplitService — orquestra calculate→authorize→execute em cima de uma
 * TaxTransaction já existente, usando a abstração ISplitPaymentProvider.
 *
 * NÃO é chamado por nenhum fluxo real ainda (Order/OnlineOrder/Payment/
 * Wallet) — existe só pra provar que a abstração funciona ponta-a-ponta.
 * A integração de verdade (checar TaxConfiguration.isActive antes de disparar
 * isso a partir de um pagamento real) é uma fase futura, feita sob pedido
 * explícito quando a Reforma Tributária entrar em obrigatoriedade.
 */
@Injectable()
export class FiscalSplitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providerFactory: SplitPaymentProviderFactory,
  ) {}

  async processSplit(
    taxTransactionId: string,
    companyId: string,
    providerName = 'NOOP',
  ) {
    const tx = await this.prisma.taxTransaction.findFirst({
      where: { id: taxTransactionId, companyId },
    });
    if (!tx) throw new NotFoundException('TaxTransaction não encontrada.');

    const provider = this.providerFactory.get(providerName);
    const breakdown = provider.calculateSplit({
      taxTransactionId: tx.id,
      companyId,
      baseAmount: Number(tx.baseAmount),
      ibsRate: tx.ibsRate ? Number(tx.ibsRate) : null,
      cbsRate: tx.cbsRate ? Number(tx.cbsRate) : null,
    });

    const allocation = await this.prisma.taxSplitAllocation.create({
      data: {
        companyId,
        taxTransactionId: tx.id,
        provider: provider.providerName,
        grossAmount: breakdown.grossAmount,
        segregatedAmount: breakdown.segregatedAmount,
        netAmount: breakdown.netAmount,
        status: 'PENDING',
      },
    });

    const auth = await provider.authorizeSplit({
      id: allocation.id,
      grossAmount: breakdown.grossAmount,
    });
    const result = await provider.executeSplit(auth);

    const finalStatus =
      result.status === 'SETTLED'
        ? 'SETTLED'
        : result.status === 'FAILED'
          ? 'FAILED'
          : 'PROCESSING';

    return this.prisma.taxSplitAllocation.update({
      where: { id: allocation.id },
      data: {
        status: finalStatus,
        externalReference: auth.externalReference ?? null,
        gatewayResponse: (result.gatewayResponse as any) ?? undefined,
        authorizedAt: new Date(),
        executedAt: finalStatus === 'SETTLED' ? new Date() : null,
      },
    });
  }
}
