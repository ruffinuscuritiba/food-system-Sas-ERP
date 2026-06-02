import { Injectable, Logger } from '@nestjs/common';

// ─── Tipos públicos ────────────────────────────────────────────────────────────

export interface CartItem {
  productId:  string;
  nome:       string;
  quantidade: number;
  preco:      number;
}

export type CartStep =
  | 'SAUDACAO'
  | 'ESCOLHENDO_ITENS'
  | 'CONFIRMANDO_PEDIDO'
  | 'AGUARDANDO_ENDERECO'
  | 'FINALIZADO';

export interface CartStatus {
  itens:           CartItem[];
  etapa:           CartStep;
  finalizado:      boolean;
  endereco?:       string | null;
  telefone?:       string | null;
  formaPagamento?: string | null;
}

export interface StructuredResponse {
  resposta_para_o_cliente: string;
  status_carrinho:         CartStatus;
}

/**
 * ClaudeCartService — motor de IA estruturado para atendimento via WhatsApp.
 *
 * Env obrigatórias:
 *   ANTHROPIC_API_KEY — chave da API Anthropic
 *   ANTHROPIC_MODEL   — (opcional) modelo a usar, padrão: claude-sonnet-4-6
 *
 * Protocolo de resposta:
 *   Claude é instruído a retornar SOMENTE um JSON com a estrutura:
 *   {
 *     "resposta_para_o_cliente": "texto natural para o cliente",
 *     "status_carrinho": {
 *       "itens": [{ productId, nome, quantidade, preco }],
 *       "etapa": "ESCOLHENDO_ITENS",
 *       "finalizado": false,
 *       "endereco": null,
 *       "telefone": null,
 *       "formaPagamento": null
 *     }
 *   }
 *
 * O backend lê esse JSON, atualiza o carrinho no banco (WhatsappConversation.context)
 * e dispara a resposta de texto para o cliente.
 */
@Injectable()
export class ClaudeCartService {
  private readonly log = new Logger('ClaudeCartService');

  async chat(params: {
    companyName:         string;
    attendantName:       string;
    menuContext:         string;
    currentCart:         CartStatus;
    conversationHistory: { role: 'user' | 'assistant'; content: string }[];
  }): Promise<StructuredResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurado');

    const model        = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
    const systemPrompt = this.buildSystemPrompt(params);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system:     systemPrompt,
        messages:   params.conversationHistory,
        max_tokens: 1024,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic API HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data    = (await res.json()) as any;
    const rawText = (data?.content?.[0]?.text ?? '') as string;

    return this.parseStructuredResponse(rawText, params.currentCart);
  }

  // ── System prompt ──────────────────────────────────────────────────────────

  private buildSystemPrompt(params: {
    companyName:   string;
    attendantName: string;
    menuContext:   string;
    currentCart:   CartStatus;
  }): string {
    const cartJson = JSON.stringify(params.currentCart, null, 2);

    return `Você é ${params.attendantName}, atendente virtual simpático(a) da loja "${params.companyName}".
Sua missão: atender o cliente via WhatsApp, apresentar o cardápio, gerenciar o carrinho de compras e confirmar o pedido de forma natural, calorosa e eficiente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 CARDÁPIO DISPONÍVEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${params.menuContext || 'Cardápio não disponível no momento.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛒 ESTADO ATUAL DO CARRINHO DO CLIENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
\`\`\`json
${cartJson}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 ETAPAS DO ATENDIMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• SAUDACAO          — Cumprimentar e apresentar o cardápio
• ESCOLHENDO_ITENS  — Auxiliar a escolher produtos; adicionar ao carrinho
• CONFIRMANDO_PEDIDO — Revisar itens e total com o cliente
• AGUARDANDO_ENDERECO — Coletar endereço de entrega ou confirmar retirada
• FINALIZADO        — Pedido confirmado → setar finalizado: true

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ REGRAS ABSOLUTAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Responda SEMPRE E SOMENTE com JSON válido no formato abaixo — ZERO texto fora do JSON
2. Use português brasileiro, tom amigável e use emojis com moderação
3. NUNCA invente produtos, preços ou IDs fora do cardápio fornecido
4. O campo "productId" deve ser EXATAMENTE o valor entre [ID:xxx] no cardápio
5. Mantenha TODOS os itens anteriores do carrinho — nunca apague sem o cliente pedir
6. Ao cliente confirmar pedido + endereço + forma de pagamento → defina finalizado: true e etapa: FINALIZADO
7. Se cliente pedir para falar com humano, adicione a nota "TRANSFERIR_HUMANO" na resposta_para_o_cliente

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 FORMATO DE RESPOSTA (JSON OBRIGATÓRIO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "resposta_para_o_cliente": "texto natural que o cliente vai ler no WhatsApp",
  "status_carrinho": {
    "itens": [
      {
        "productId":  "id_exato_do_produto_no_cardapio",
        "nome":       "Nome do Produto",
        "quantidade": 1,
        "preco":      29.90
      }
    ],
    "etapa":           "ESCOLHENDO_ITENS",
    "finalizado":      false,
    "endereco":        null,
    "telefone":        null,
    "formaPagamento":  null
  }
}`;
  }

  // ── Parser da resposta ─────────────────────────────────────────────────────

  private parseStructuredResponse(rawText: string, fallbackCart: CartStatus): StructuredResponse {
    const tryParse = (text: string): StructuredResponse | null => {
      try {
        const parsed = JSON.parse(text) as StructuredResponse;
        if (
          typeof parsed.resposta_para_o_cliente === 'string' &&
          parsed.status_carrinho &&
          Array.isArray(parsed.status_carrinho.itens)
        ) {
          return parsed;
        }
      } catch {}
      return null;
    };

    // Tentativa 1: parse direto
    const direct = tryParse(rawText.trim());
    if (direct) return direct;

    // Tentativa 2: extrair bloco JSON do texto (caso Claude adicione texto extra)
    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) {
      const fromBlock = tryParse(match[0]);
      if (fromBlock) return fromBlock;
    }

    // Fallback: preserva carrinho atual, usa texto bruto como resposta
    this.log.warn(`ClaudeCartService: resposta não parseável — usando fallback. Raw: "${rawText.slice(0, 80)}"`);
    return {
      resposta_para_o_cliente: rawText.trim() || 'Desculpe, tive um problema temporário. Pode repetir sua mensagem? 🙏',
      status_carrinho: fallbackCart,
    };
  }

  // ── Utilitários estáticos ──────────────────────────────────────────────────

  static emptyCart(): CartStatus {
    return { itens: [], etapa: 'SAUDACAO', finalizado: false };
  }

  static cartTotal(cart: CartStatus): number {
    return cart.itens.reduce((acc, i) => acc + i.preco * i.quantidade, 0);
  }

  static formatCartSummary(cart: CartStatus): string {
    if (!cart.itens.length) return 'Carrinho vazio.';
    const lines = cart.itens.map(
      (i) => `• ${i.quantidade}x ${i.nome} — R$${(i.preco * i.quantidade).toFixed(2)}`,
    );
    const total = ClaudeCartService.cartTotal(cart);
    return lines.join('\n') + `\n*Total: R$${total.toFixed(2)}*`;
  }
}
