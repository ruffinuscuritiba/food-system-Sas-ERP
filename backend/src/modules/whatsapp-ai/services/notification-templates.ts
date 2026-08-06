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
  name: string;
  orderId: string;
  items: string;
  subtotal?: string;
  deliveryFee?: string;
  discount?: string;
  total: string;
  payment: string;
  address: string;
}): string {
  const greeting = params.name ? `Olá, *${params.name}*! ` : '';
  // Só mostra o detalhamento Subtotal/Taxa/Desconto quando há taxa de
  // entrega OU desconto — pedido de retirada/balcão sem nenhum dos dois
  // fica só com o Total, sem linhas "R$ 0,00" sem sentido. Desconto é
  // derivado (subtotal+taxa-total) — Order (PDV) não tem campo próprio pra
  // isso (negociação avulsa direto com a loja) — sem mostrar aqui, o
  // cliente via só o subtotal e um total bem menor sem explicação nenhuma.
  const hasBreakdown = !!(params.deliveryFee || params.discount);
  const breakdown = hasBreakdown
    ? `Subtotal: ${params.subtotal}\n` +
      (params.deliveryFee ? `Taxa de entrega: ${params.deliveryFee}\n` : '') +
      (params.discount ? `Desconto: -${params.discount}\n` : '')
    : '';
  return `${greeting}✅ *Pedido confirmado!*

📋 *Pedido #${params.orderId}*
${params.items}

${breakdown}💰 *Total: ${params.total}*
💳 *Pagamento:* ${params.payment} ✓ Confirmado
📍 *Entrega:* ${params.address}

Obrigado pela preferência! 🍕
Acompanhe pelo nosso sistema. Qualquer dúvida, é só chamar! 😊`;
}

// ─── Templates de mudança de status ─────────────────────────────────────────

export const STATUS_TEMPLATES: Record<
  OrderStatusKey,
  (orderId: string, name?: string, orderType?: string) => string
> = {
  CONFIRMED: (orderId, name) => {
    const g = name ? `Olá, *${name}*! ` : '';
    return `${g}✅ Seu pedido *#${orderId}* foi confirmado! Em breve começamos a prepará-lo.`;
  },

  PREPARING: (orderId, name) => {
    const g = name ? `${name}, ` : '';
    return `${g}🍳 Seu pedido *#${orderId}* já está na cozinha sendo preparado com todo carinho!`;
  },

  // "Esperando no balcão" só faz sentido pra retirada/local -- um pedido de
  // ENTREGA que fica PRONTO ainda não saiu pra rua, então avisar "vem
  // buscar no balcão" é literalmente errado pro cliente de delivery.
  READY: (orderId, name, orderType) => {
    const g = name ? `${name}, ` : '';
    if (orderType === 'DELIVERY') {
      return `${g}📦 Seu pedido *#${orderId}* está pronto! Já vamos despachar com o entregador.`;
    }
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
export function formatPhoneInternational(
  phone: string,
  countryCode = '55',
): string {
  let digits = phone.replace(/\D/g, '');
  // Mesmo bug corrigido em common/utils/phone.ts normalizePhoneBr — cliente
  // de fora digita o telefone com o "0" de discagem interurbana na frente
  // ("011..." em vez de "11..."). Sem remover isso, `digits.length >= 12`
  // abaixo assumia (errado) que o número já tinha DDI, nunca prefixava o 55
  // de verdade, e a confirmação de pedido nunca era entregue — sem erro
  // nenhum visível, o pedido só ficava "sem responder" pro cliente.
  if (digits.length > 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.startsWith(countryCode) && digits.length >= 12) return digits; // já tem DDD + DDI
  if (digits.length === 11) return `${countryCode}${digits}`; // DDD + 9 dígitos
  if (digits.length === 10) return `${countryCode}${digits}`; // DDD + 8 dígitos (fixo)
  // Sobrou dígito(s) de digitação errada além do esperado — mantém só os
  // últimos 11 (DDD+número) em vez de nunca enviar por conta de um número
  // "grande demais pra ser válido".
  if (digits.length > 11) return `${countryCode}${digits.slice(-11)}`;
  return digits;
}

// ─── Formatação de itens do pedido ───────────────────────────────────────────

export function formatOrderItems(
  items: {
    name: string;
    quantity: number;
    unitPrice?: number;
    complements?: { name: string; price: number }[];
  }[],
): string {
  return items
    .slice(0, 10)
    .map((i) => {
      const price =
        i.unitPrice != null
          ? ` — R$ ${(Number(i.unitPrice) * i.quantity).toFixed(2).replace('.', ',')}`
          : '';
      const line = `  • ${i.quantity}x ${i.name}${price}`;
      const extras = (i.complements ?? [])
        .map((c) => {
          const p = c.price > 0 ? ` (R$ ${c.price.toFixed(2).replace('.', ',')})` : '';
          return `     + ${c.name}${p}`;
        })
        .join('\n');
      return extras ? `${line}\n${extras}` : line;
    })
    .join('\n');
}

// ─── Mapa de formas de pagamento legíveis ─────────────────────────────────────

export const PAYMENT_LABELS: Record<string, string> = {
  PIX: 'PIX',
  CASH: 'Dinheiro',
  CREDIT_CARD: 'Cartão de Crédito',
  DEBIT_CARD: 'Cartão de Débito',
  MEAL_VOUCHER: 'Vale-Refeição',
  TRANSFER: 'Transferência',
};
