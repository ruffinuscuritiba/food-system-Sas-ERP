import { Injectable } from '@nestjs/common';
import { ParsedCommands, WaSettings } from '../types';

@Injectable()
export class WhatsappAiPromptService {
  buildMenuContext(
    products: Record<string, unknown>[],
    categories: Record<string, unknown>[],
  ): string {
    const catMap = new Map(categories.map((c) => [c['id'], c['name']]));
    const sections: string[] = [];
    const grouped = new Map<string, Record<string, unknown>[]>();

    for (const p of products) {
      if (!p['isActive']) continue;
      const cat = (catMap.get(p['categoryId'] as string) as string) ?? 'Outros';
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(p);
    }

    for (const [cat, prods] of grouped) {
      const lines = prods.map((p) => {
        const sizes = p['sizes'] as
          | { size: string; price: unknown }[]
          | undefined;
        const price = sizes?.length
          ? sizes
              .map((s) => `${s.size} R$${Number(s.price).toFixed(2)}`)
              .join(' | ')
          : `R$${Number(p['salePrice'] ?? 0).toFixed(2)}`;
        const desc = p['description'] as string | undefined;
        return `  - [ID:${p['id']}] ${p['name']}${desc ? ` (${desc.slice(0, 60)})` : ''} — ${price}`;
      });
      sections.push(`**${cat}**\n${lines.join('\n')}`);
    }

    return sections.join('\n\n');
  }

  buildSystemPrompt(
    settings: WaSettings,
    companyName: string,
    menuCtx: string,
    cartCtx: string,
  ): string {
    const base = settings.systemPrompt?.trim()
      ? settings.systemPrompt
      : `Você é ${settings.attendantName}, atendente virtual da ${companyName}.\nSeja simpático, natural e objetivo. Responda em português BR.`;

    const emojiNote = settings.useEmojis
      ? 'Use emojis moderadamente para deixar a conversa mais amigável.'
      : 'Não use emojis.';

    return `${base}

${emojiNote}

## CARDÁPIO ATUAL
${menuCtx || 'Cardápio não disponível no momento.'}

## CARRINHO ATUAL DO CLIENTE
${cartCtx || 'Carrinho vazio.'}

## INSTRUÇÕES DE PEDIDO
- Quando o cliente quiser adicionar um produto, inclua no final da resposta: [CMD:ADD_ITEM:ID_DO_PRODUTO:QUANTIDADE]
- Quando confirmar pedido completo com endereço e forma de pagamento: [CMD:CONFIRM_ORDER:DELIVERY:endereço completo:telefone]
  ou para retirada: [CMD:CONFIRM_ORDER:PICKUP::telefone]
- Para transferir para atendente humano: [CMD:TRANSFER_HUMAN]
- Para encerrar conversa: [CMD:CLOSE]
- NUNCA invente produtos ou preços fora do cardápio acima.
- Os IDs dos produtos são os valores em [ID:xxx] — use-os exatamente nos comandos.
- Sempre confirme o pedido antes de enviar [CMD:CONFIRM_ORDER].
- Se o cliente pedir algo fora do cardápio, informe que não temos e sugira alternativas.`;
  }

  parseCommands(raw: string): ParsedCommands {
    const addItems: { productId: string; qty: number }[] = [];
    let confirmOrder: ParsedCommands['confirmOrder'] = null;
    let transferHuman = false;
    let closeConversation = false;

    const cmdRegex = /\[CMD:([^\]]+)\]/g;
    let match: RegExpExecArray | null;
    while ((match = cmdRegex.exec(raw)) !== null) {
      const parts = match[1].split(':');
      const type = parts[0];
      if (type === 'ADD_ITEM' && parts[1]) {
        addItems.push({
          productId: parts[1],
          qty: parseInt(parts[2] || '1', 10),
        });
      } else if (type === 'CONFIRM_ORDER') {
        confirmOrder = {
          deliveryType: parts[1] || 'DELIVERY',
          address: parts[2] || '',
          phone: parts[3] || '',
        };
      } else if (type === 'TRANSFER_HUMAN') {
        transferHuman = true;
      } else if (type === 'CLOSE') {
        closeConversation = true;
      }
    }

    const cleanText = raw
      .replace(/\[CMD:[^\]]+\]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return {
      cleanText,
      addItems,
      confirmOrder,
      transferHuman,
      closeConversation,
    };
  }
}
