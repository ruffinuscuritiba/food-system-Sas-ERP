import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { TaxCalculationService } from './tax-calculation.service';
import { FiscalSplitService } from './fiscal-split.service';

/**
 * FiscalSplitOrchestrationService — único ponto de entrada chamado a partir
 * de fluxos REAIS de dinheiro/pedido (PaymentsService, IntegrationsService).
 *
 * ⚠️ KILL SWITCH: todo método aqui começa checando
 * `TaxConfiguration.isActive` (+ o escopo do canal). Sem isso, nada é
 * criado — nenhuma TaxTransaction, nenhum split, nenhuma retenção. Hoje
 * NENHUM tenant tem TaxConfiguration com isActive=true, então este serviço
 * é 100% no-op em produção, apesar de já estar plugado.
 *
 * ⚠️ NUNCA ativar isActive=true em produção sem validação prévia do
 * contador/tributarista do tenant — ver docs/fiscal/split-payment.md.
 * Split Payment de IBS/CBS, pela arquitetura da Reforma Tributária, é
 * executado pelo arranjo de pagamento na liquidação — não pelo ERP do
 * lojista. Por isso maybeRecordMarketplaceSale nunca dispara retenção real:
 * o FoodSaaS não é o recebedor do dinheiro de pedidos de marketplace.
 *
 * Todo método é best-effort: exceção aqui nunca deve derrubar o fluxo de
 * pagamento/pedido que chamou — sempre logado e engolido.
 */
@Injectable()
export class FiscalSplitOrchestrationService {
  private readonly logger = new Logger(FiscalSplitOrchestrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calc: TaxCalculationService,
    private readonly splitService: FiscalSplitService,
  ) {}

  async maybeRecordOwnSale(
    companyId: string,
    params: {
      onlineOrderId?: string;
      orderId?: string;
      baseAmount: number;
      paymentMethod?: string;
    },
  ) {
    try {
      const active = await this.calc.isActiveFor(companyId, 'OWN_SALE');
      if (!active) return null;

      const calc = await this.calc.calculateForCompany(companyId, params.baseAmount);
      const tx = await this.prisma.taxTransaction.create({
        data: {
          companyId,
          channel: 'OWN_SALE',
          orderId: params.orderId ?? null,
          onlineOrderId: params.onlineOrderId ?? null,
          baseAmount: params.baseAmount,
          ibsRate: calc.ibsRate,
          ibsAmount: calc.ibsAmount,
          cbsRate: calc.cbsRate,
          cbsAmount: calc.cbsAmount,
          status: 'CALCULATED',
        },
      });

      await this.splitService.processSplit(tx.id, companyId);
      this.logger.log(
        `[FISCAL] TaxTransaction ${tx.id} (OWN_SALE) — IBS+CBS=R$${(calc.ibsAmount + calc.cbsAmount).toFixed(2)}`,
      );
      return tx;
    } catch (e: any) {
      this.logger.warn(`[FISCAL] maybeRecordOwnSale falhou (não bloqueia a venda): ${e?.message}`);
      return null;
    }
  }

  async maybeRecordMarketplaceSale(
    companyId: string,
    params: {
      externalOrderId: string;
      integrationProvider: string;
      baseAmount: number;
      paymentMethod?: string;
    },
  ) {
    try {
      const active = await this.calc.isActiveFor(companyId, 'MARKETPLACE');
      if (!active) return null;

      const calc = await this.calc.calculateForCompany(companyId, params.baseAmount);
      // Só registro informativo/contábil — nunca dispara split de dinheiro
      // real aqui (ver docstring da classe: o FoodSaaS não recebe o valor
      // de pedidos de marketplace, quem processa é o arranjo de pagamento
      // do próprio marketplace).
      const tx = await this.prisma.taxTransaction.create({
        data: {
          companyId,
          channel: 'MARKETPLACE',
          externalOrderId: params.externalOrderId,
          integrationProvider: params.integrationProvider,
          baseAmount: params.baseAmount,
          ibsRate: calc.ibsRate,
          ibsAmount: calc.ibsAmount,
          cbsRate: calc.cbsRate,
          cbsAmount: calc.cbsAmount,
          status: 'CALCULATED',
        },
      });
      this.logger.log(
        `[FISCAL] TaxTransaction ${tx.id} (MARKETPLACE/${params.integrationProvider}) — registro informativo`,
      );
      return tx;
    } catch (e: any) {
      this.logger.warn(`[FISCAL] maybeRecordMarketplaceSale falhou (não bloqueia o pedido): ${e?.message}`);
      return null;
    }
  }
}
