import { BadRequestException } from '@nestjs/common';
import {
  IIntegrationProvider,
  IntegrationEvent,
} from '../integration-provider.interface';

/**
 * MockProvider — simula o comportamento do iFood para testes e onboarding.
 *
 * Regras:
 * - Assinatura sempre válida (sandboxMode ignora validação no service)
 * - externalProductId === internalProductId (sem necessidade de ProductCatalogMap)
 * - Status map espelha os do iFood para validar o pipeline completo
 */
export class MockProvider implements IIntegrationProvider {
  readonly providerName = 'MOCK';

  validateWebhookSignature(
    _secret: string,
    _headers: Record<string, string>,
    _rawBody: Buffer,
  ): boolean {
    return true;
  }

  parseEvent(
    body: unknown,
    _headers: Record<string, string>,
  ): IntegrationEvent {
    const b = body as Record<string, any>;

    if (!b?.type || !b?.externalOrderId) {
      throw new BadRequestException(
        'MockProvider: body deve ter type e externalOrderId.',
      );
    }

    return {
      type: b.type,
      externalOrderId: b.externalOrderId,
      externalStatus: b.status,
      orderType: b.orderType ?? 'DELIVERY',
      customer: b.customer,
      items: b.items ?? [],
      paymentMethod: b.paymentMethod ?? 'PIX',
      subtotal: Number(b.subtotal ?? 0),
      deliveryFee: Number(b.deliveryFee ?? 0),
      total: Number(b.total ?? 0),
      notes: b.notes,
      rawPayload: body,
    };
  }

  mapOrderStatus(externalStatus: string): string {
    const map: Record<string, string> = {
      PLACED: 'PENDING',
      CONFIRMED: 'CONFIRMED',
      PREPARING: 'PREPARING',
      READY: 'READY',
      DISPATCHED: 'OUT_FOR_DELIVERY',
      DELIVERED: 'DELIVERED',
      CANCELLED: 'CANCELLED',
    };
    return map[externalStatus?.toUpperCase()] ?? 'PENDING';
  }

  mapPaymentMethod(externalPayment: string): string {
    const map: Record<string, string> = {
      PIX: 'PIX',
      CREDIT: 'CREDIT_CARD',
      CREDIT_CARD: 'CREDIT_CARD',
      DEBIT: 'DEBIT_CARD',
      DEBIT_CARD: 'DEBIT_CARD',
      CASH: 'CASH',
      DINHEIRO: 'CASH',
    };
    return map[externalPayment?.toUpperCase()] ?? 'PIX';
  }
}
