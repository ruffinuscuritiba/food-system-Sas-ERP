export type IntegrationEventType =
  | 'ORDER_CREATED'
  | 'STATUS_CHANGED'
  | 'ORDER_CANCELLED'
  | 'CATALOG_SYNC';

export interface CanonicalCustomer {
  name: string;
  phone?: string;
  address?: string;
  addressNumber?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface CanonicalOrderItem {
  externalProductId: string;
  externalVariantId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

export interface IntegrationEvent {
  type: IntegrationEventType;
  externalOrderId: string;
  externalStatus?: string;
  orderType?: 'DELIVERY' | 'PICKUP' | 'DINE_IN';
  customer?: CanonicalCustomer;
  items?: CanonicalOrderItem[];
  paymentMethod?: string;
  subtotal?: number;
  deliveryFee?: number;
  total?: number;
  notes?: string;
  rawPayload: unknown;
}

export interface IIntegrationProvider {
  readonly providerName: string;

  /**
   * Valida a assinatura HMAC do webhook.
   * Em sandboxMode o service chama isso mas ignora o resultado (false = OK).
   */
  validateWebhookSignature(
    secret: string,
    headers: Record<string, string>,
    rawBody: Buffer,
  ): boolean;

  /** Transforma o payload proprietário em IntegrationEvent canônico. */
  parseEvent(body: unknown, headers: Record<string, string>): IntegrationEvent;

  /** Converte status externo para OrderStatus do FoodSaaS. */
  mapOrderStatus(externalStatus: string): string;

  /** Converte método de pagamento externo para PaymentMethod do FoodSaaS. */
  mapPaymentMethod(externalPayment: string): string;
}
