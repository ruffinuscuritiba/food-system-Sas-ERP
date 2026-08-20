import {
  ISplitPaymentProvider,
  SplitAuthorization,
  SplitBreakdown,
  SplitCalculationInput,
  SplitResult,
  SplitStatus,
} from '../split-payment-provider.interface';

/**
 * NoopSplitPaymentProvider — implementação de referência, sem PSP real.
 *
 * Existe pra provar que ISplitPaymentProvider funciona ponta-a-ponta antes
 * de haver especificação oficial de Split Payment do BC/CGIBS pra
 * implementar de verdade (item 24 do plano: nunca regra fictícia em
 * produção — abstração + configuração até lá).
 *
 * calculateSplit nunca inventa alíquota: se ibsRate/cbsRate vierem nulos
 * (caso hoje — TaxConfiguration ainda sem valores oficiais), a segregação é
 * sempre zero e o valor líquido = valor bruto.
 *
 * authorizeSplit/executeSplit nunca fazem chamada de rede — sempre retornam
 * sucesso local, sem persistir nada fora do próprio banco do FoodSaaS.
 */
export class NoopSplitPaymentProvider implements ISplitPaymentProvider {
  readonly providerName = 'NOOP';

  calculateSplit(input: SplitCalculationInput): SplitBreakdown {
    const ibs = input.ibsRate ? input.baseAmount * Number(input.ibsRate) : 0;
    const cbs = input.cbsRate ? input.baseAmount * Number(input.cbsRate) : 0;
    const segregatedAmount = parseFloat((ibs + cbs).toFixed(2));

    return {
      grossAmount: input.baseAmount,
      segregatedAmount,
      netAmount: parseFloat((input.baseAmount - segregatedAmount).toFixed(2)),
    };
  }

  async authorizeSplit(allocation: {
    id: string;
    grossAmount: number;
  }): Promise<SplitAuthorization> {
    return { taxSplitAllocationId: allocation.id, status: 'AUTHORIZED' };
  }

  async executeSplit(auth: SplitAuthorization): Promise<SplitResult> {
    return { taxSplitAllocationId: auth.taxSplitAllocationId, status: 'SETTLED' };
  }

  async getSplitStatus(taxSplitAllocationId: string): Promise<SplitStatus> {
    return { taxSplitAllocationId, status: 'SETTLED' };
  }

  async reverseSplit(_taxSplitAllocationId: string): Promise<void> {
    // Noop — nada a reverter num provider que nunca chamou rede.
  }

  async refundSplit(_taxSplitAllocationId: string, _amount: number): Promise<void> {
    // Noop — nada a estornar num provider que nunca chamou rede.
  }
}
