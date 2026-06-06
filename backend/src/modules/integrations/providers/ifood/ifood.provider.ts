import { createHmac } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import {
  IIntegrationProvider,
  IntegrationEvent,
} from '../integration-provider.interface';

/**
 * IfoodProvider — stub pronto para homologação oficial.
 *
 * TODO (pós-homologação iFood):
 *  1. Implementar OAuth2 token refresh (POST /oauth/token)
 *  2. Validar HMAC com o header real do iFood
 *  3. Mapear todos os status do iFood conforme documentação oficial
 *  4. Implementar sendAck (POST /order/v1.0/orders/:id/statuses/confirmation)
 *  5. Implementar pushCatalog para sync de cardápio
 */
export class IfoodProvider implements IIntegrationProvider {
  readonly providerName = 'IFOOD';

  validateWebhookSignature(
    secret: string,
    headers: Record<string, string>,
    rawBody: Buffer,
  ): boolean {
    const signature = headers['x-ifood-signature'] ?? headers['x-signature'] ?? '';
    if (!signature || !secret) return false;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    return signature === expected;
  }

  parseEvent(body: unknown, _headers: Record<string, string>): IntegrationEvent {
    const b = body as Record<string, any>;

    // iFood envia eventos no formato { fullCode, orderId, ... }
    const eventCode = b?.fullCode ?? b?.code ?? '';
    const type = this.mapEventCode(eventCode);

    if (!b?.orderId) {
      throw new BadRequestException('IfoodProvider: payload sem orderId.');
    }

    const order = b?.order ?? b ?? {};
    const delivery = order?.delivery ?? {};
    const customer = order?.customer ?? {};
    const address = delivery?.deliveryAddress ?? {};

    return {
      type,
      externalOrderId: b.orderId,
      externalStatus:  eventCode,
      orderType:       delivery?.mode === 'DEFAULT' ? 'DELIVERY' : 'PICKUP',
      customer: {
        name:        customer?.name ?? '',
        phone:       customer?.phone?.localizer ?? customer?.phone ?? '',
        address:     address?.formattedAddress ?? address?.streetName ?? '',
        addressNumber: address?.streetNumber ?? '',
        neighborhood: address?.neighborhood ?? '',
        city:        address?.city ?? '',
        state:       address?.state ?? '',
        zipCode:     address?.postalCode ?? '',
      },
      items: (order?.items ?? []).map((i: any) => ({
        externalProductId: i.id ?? i.externalId,
        externalVariantId: i.externalCode,
        productName:       i.name ?? 'Item iFood',
        quantity:          Number(i.quantity ?? 1),
        unitPrice:         Number(i.unitPrice ?? i.price ?? 0),
        notes:             i.observations ?? '',
      })),
      paymentMethod: this.mapPaymentMethod(
        order?.payments?.methods?.[0]?.type ?? 'PIX',
      ),
      subtotal:    Number(order?.subTotal ?? 0),
      deliveryFee: Number(delivery?.deliveryFee ?? 0),
      total:       Number(order?.totalPrice ?? 0),
      notes:       order?.observations ?? '',
      rawPayload:  body,
    };
  }

  mapOrderStatus(externalStatus: string): string {
    const map: Record<string, string> = {
      PLC:  'PENDING',
      CFM:  'CONFIRMED',
      PRP:  'PREPARING',
      RDY:  'READY',
      DSP:  'OUT_FOR_DELIVERY',
      CON:  'DELIVERED',
      CAN:  'CANCELLED',
      // fullCode format
      PLACED:      'PENDING',
      CONFIRMED:   'CONFIRMED',
      PREPARATION_STARTED: 'PREPARING',
      READY_TO_PICKUP: 'READY',
      DISPATCHED:  'OUT_FOR_DELIVERY',
      CONCLUDED:   'DELIVERED',
      CANCELLED:   'CANCELLED',
    };
    return map[externalStatus?.toUpperCase()] ?? 'PENDING';
  }

  mapPaymentMethod(externalPayment: string): string {
    const map: Record<string, string> = {
      ONLINE:      'PIX',
      PIX:         'PIX',
      CREDIT:      'CREDIT_CARD',
      DEBIT:       'DEBIT_CARD',
      CASH:        'CASH',
      DINHEIRO:    'CASH',
      VOUCHER:     'CREDIT_CARD',
    };
    return map[externalPayment?.toUpperCase()] ?? 'PIX';
  }

  private mapEventCode(code: string): IntegrationEvent['type'] {
    if (!code) return 'ORDER_CREATED';
    const upper = code.toUpperCase();
    if (upper === 'PLACED' || upper === 'PLC') return 'ORDER_CREATED';
    if (upper === 'CANCELLED' || upper === 'CAN') return 'ORDER_CANCELLED';
    if (upper.startsWith('CAT')) return 'CATALOG_SYNC';
    return 'STATUS_CHANGED';
  }
}
