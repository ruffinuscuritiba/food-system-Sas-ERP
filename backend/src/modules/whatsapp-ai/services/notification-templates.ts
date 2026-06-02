/**
 * notification-templates.ts
 *
 * Templates centralizados de mensagens WhatsApp para notificações de pedido.
 * Edite este arquivo para ajustar textos sem tocar na lógica de negócio.
 *
 * Variáveis disponíveis nos templates:
 *   {{name}}         — nome do cliente
 *   {{orderId}}      — últimos 6 caracteres do ID do pedido (ex: A1B2C3)
 *   {{items}}        — lista de itens formatada
 *   {{total}}        — valor total (ex: R$ 49,90)
 *   {{payment}}      — forma de pagamento (ex: PIX)
 *   {{address}}      — endereço de entrega ou "Retirada no balcão"
 */

export type OrderStatusKey =
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

// ─── Confirmação de pedido fechado ────────────────────────────────────────────

export function tplOrderConfirmed(params: {
  name:    string;
  orderId: string;
  items:   string;
  total:   string;
  payment: string;
  address: string;
}): string {
  const greeting = params.name ? `Olá, *${params.name}*! ` : '';
  return `${greeting}✅ *Pedido confirmado!*

📋 *Pedido #${params.orderId}*
${params.items}

💰 *Total:* ${params.total}
💳 *Pagamento:* ${params.payment}
📍 *Entrega:* ${params.address}

Acompanhe pelo nosso sistema. Qualquer dúvida, é só chamar! 😊`;
}

// ─── Templates de mudança de status ─────────────────────────────────────────

export const STATUS_TEMPLATES: Record<OrderStatusKey, (orderId: string, name?: string) => string> = {

  CONFIRMED: (orderId, name) => {
    const g = name ? `Olá, *${name}*! ` : '';
    return `${g}✅ Seu pedido *#${orderId}* foi confirmado! Em breve começamos a prepará-lo.`;
  },

  PREPARING: (orderId, name) => {
    const g = name ? `${name}, ` : '';
    return `${g}🍳 Seu pedido *#${orderId}* já está na cozinha sendo preparado com todo carinho!`;
  },

  READY: (orderId, name) => {
    const g = name ? `${name}, ` : '';
    return `${g}🛍️ Seu pedido *#${orderId}* já está prontinho te esperando no balcão!`;
  },

  OUT_FOR_DELIVERY: (orderId, name) => {
    const g = name ? `Boas notícias, *${name}*! ` : 'Boas notícias! ';
    return `${g}🛵 Seu pedido *#${orderId}* acabou de sair com o nosso entregador e já está a caminho!`;
  },

  DELIVERED: (orderId, name) => {
    const g = name ? `*${name}*, ` : '';
    return `${g}🎉 Seu pedido *#${orderId}* foi entregue! Bom apetite e obrigado pela preferência! ❤️`;
  },

  CANCELLED: (orderId, name) => {
    const g = name ? `Olá, *${name}*. ` : '';
    return `${g}❌ Infelizmente seu pedido *#${orderId}* foi cancelado. Entre em contato para mais informações.`;
  },
};

// ─── Formatação de número para padrão internacional ───────────────────────────

/**
 * Formata o telefone para o padrão internacional sem "+" e sem espaços.
 * Exemplos:
 *   "41999887766"     → "5541999887766"
 *   "+5541999887766"  → "5541999887766"
 *   "5541999887766"   → "5541999887766"
 */
export function formatPhoneInternational(phone: string, countryCode = '55'): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 12) return digits;           // já tem DDD + DDI
  if (digits.length === 11) return `${countryCode}${digits}`; // DDD + 9 dígitos
  if (digits.length === 10) return `${countryCode}${digits}`; // DDD + 8 dígitos (fixo)
  return digits;
}

// ─── Formatação de itens do pedido ───────────────────────────────────────────

export function formatOrderItems(items: { name: string; quantity: number; unitPrice?: number }[]): string {
  return items
    .slice(0, 10)
    .map((i) => {
      const price = i.unitPrice != null
        ? ` — R$ ${(Number(i.unitPrice) * i.quantity).toFixed(2).replace('.', ',')}`
        : '';
      return `  • ${i.quantity}x ${i.name}${price}`;
    })
    .join('\n');
}

// ─── Mapa de formas de pagamento legíveis ─────────────────────────────────────

export const PAYMENT_LABELS: Record<string, string> = {
  PIX:         'PIX',
  CASH:        'Dinheiro',
  CREDIT_CARD: 'Cartão de Crédito',
  DEBIT_CARD:  'Cartão de Débito',
  TRANSFER:    'Transferência',
};
