import { Injectable, Logger } from '@nestjs/common';

// ─── Tipos públicos ────────────────────────────────────────────────────────────

export interface CartItem {
  productId: string;
  nome: string;
  quantidade: number;
  preco: number;
}

export type CartStep =
  | 'saudacao'
  | 'escolhendo_itens'
  | 'confirmando_pedido'
  | 'aguardando_endereco'
  | 'finalizado';

export interface CartStatus {
  /** Objetos completos com productId — usados internamente para criar o Order */
  itens: CartItem[];
  /** Lista legível de nomes para exibição e histórico da conversa */
  itens_identificados: string[];
  /** Etapa atual do fluxo de atendimento */
  etapa_atual: CartStep;
  /** true quando o pedido está confirmado e deve ser registrado no banco */
  pedido_finalizado: boolean;
  endereco?: string | null;
  /** Bairro extraído do endereço — somente quando o cliente informar explicitamente */
  bairro?: string | null;
  telefone?: string | null;
  formaPagamento?: string | null;
}

export interface SolicitacaoPagamento {
  requer_acao: boolean;
  /** "pix" | "credit_card" | "debit_card" | null */
  metodo: 'pix' | 'credit_card' | 'debit_card' | null;
}

export interface StructuredResponse {
  resposta_para_o_cliente: string;
  status_carrinho: CartStatus;
  solicitacao_pagamento?: SolicitacaoPagamento;
}

/**
 * ClaudeCartService — motor de IA com persona "Carol" para atendimento WhatsApp.
 *
 * Env obrigatórias:
 *   ANTHROPIC_API_KEY — chave da API Anthropic
 *   ANTHROPIC_MODEL   — (opcional) modelo, padrão: claude-sonnet-4-6
 *
 * Retorno obrigatório em JSON:
 *   {
 *     "resposta_para_o_cliente": "texto humanizado para o WhatsApp",
 *     "status_carrinho": {
 *       "itens": [{ productId, nome, quantidade, preco }],
 *       "itens_identificados": ["Pizza de Calabresa", "Guaraná Antárctica"],
 *       "etapa_atual": "aguardando_endereco",
 *       "pedido_finalizado": false
 *     }
 *   }
 */
@Injectable()
export class ClaudeCartService {
  private readonly log = new Logger('ClaudeCartService');

  async chat(params: {
    companyName: string;
    attendantName: string;
    menuContext: string;
    currentCart: CartStatus;
    conversationHistory: { role: 'user' | 'assistant'; content: string }[];
    deliveryContext?: string;
    pizzaBordersContext?: string;
    businessHoursInfo?: string;
    paymentInfo?: string;
  }): Promise<StructuredResponse> {
    const systemPrompt = this.buildSystemPrompt(params);

    // Tenta Anthropic primeiro; se falhar (sem créditos, sem chave), cai no Gemini
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      try {
        return await this.chatAnthropic(anthropicKey, systemPrompt, params);
      } catch (err: any) {
        this.log.warn(
          `ClaudeCartService: Anthropic falhou (${err?.message?.slice(0, 80)}) — tentando Gemini`,
        );
      }
    } else {
      this.log.warn(
        'ClaudeCartService: ANTHROPIC_API_KEY ausente — usando Gemini',
      );
    }

    // Fallback: Gemini
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey)
      throw new Error(
        'ANTHROPIC_API_KEY e GEMINI_API_KEY ausentes — sem provedor disponível',
      );

    return this.chatGemini(geminiKey, systemPrompt, params);
  }

  private async chatAnthropic(
    apiKey: string,
    systemPrompt: string,
    params: {
      currentCart: CartStatus;
      conversationHistory: { role: 'user' | 'assistant'; content: string }[];
    },
  ): Promise<StructuredResponse> {
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        cache_control: { type: 'ephemeral' },
        system: systemPrompt,
        messages: params.conversationHistory,
        max_tokens: 1024,
        temperature: 0.8,
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(
        `Anthropic API HTTP ${res.status}: ${errText.slice(0, 200)}`,
      );
    }

    const data = (await res.json()) as any;
    const rawText = (data?.content?.[0]?.text ?? '') as string;
    return this.parseStructuredResponse(rawText, params.currentCart);
  }

  private async chatGemini(
    apiKey: string,
    systemPrompt: string,
    params: {
      currentCart: CartStatus;
      conversationHistory: { role: 'user' | 'assistant'; content: string }[];
    },
  ): Promise<StructuredResponse> {
    const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';

    // Gemini usa role "model" para assistente
    const contents = params.conversationHistory.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: 1024,
            temperature: 0.8,
          },
        }),
        signal: AbortSignal.timeout(60_000),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(
        `Gemini API HTTP ${res.status}: ${errText.slice(0, 200)}`,
      );
    }

    const data = (await res.json()) as any;
    const rawText = (data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      '') as string;
    return this.parseStructuredResponse(rawText, params.currentCart);
  }

  // ── System prompt — Persona Carol ─────────────────────────────────────────

  private buildSystemPrompt(params: {
    companyName: string;
    attendantName: string;
    menuContext: string;
    currentCart: CartStatus;
    deliveryContext?: string;
    pizzaBordersContext?: string;
    businessHoursInfo?: string;
    paymentInfo?: string;
  }): string {
    const name = params.attendantName || 'Carol';
    const company = params.companyName;
    const cartJson = JSON.stringify(params.currentCart, null, 2);
    const cartItems = params.currentCart.itens_identificados;
    const cartSummary = cartItems.length
      ? `Itens no carrinho: ${cartItems.join(', ')}`
      : 'Carrinho ainda vazio.';

    const deliverySection = params.deliveryContext
      ? `\n━━━ ENTREGA ━━━\n${params.deliveryContext}\n`
      : '';

    const bordersSection = params.pizzaBordersContext
      ? `\n━━━ BORDAS RECHEADAS ━━━\n${params.pizzaBordersContext}\nObs: o preço da borda é ADICIONAL ao preço do tamanho da pizza.\n`
      : '';

    const operationalSection = [
      params.businessHoursInfo ? `⏰ ${params.businessHoursInfo}` : '',
      params.paymentInfo ? `💳 ${params.paymentInfo}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return `Você é ${name}, a atendente virtual da ${company}. Você é simpática, prestativa, humanizada e conhece completamente o cardápio, os preços, as zonas de entrega e as formas de pagamento da loja. Seu objetivo é atender o cliente com naturalidade — tirar dúvidas, sugerir produtos e anotar pedidos.

━━━ QUEM VOCÊ É ━━━
Você não é apenas um sistema de pedidos. Você é a voz da ${company} no WhatsApp. Quando o cliente tiver dúvidas sobre ingredientes, tamanhos, preços, tempo de entrega, bairros atendidos ou formas de pagamento — você responde com segurança, porque tem acesso a todas essas informações.

━━━ DIRETRIZES DE COMPORTAMENTO ━━━
1. Nunca pareça um robô. Use expressões naturais como "Olha", "Com certeza!", "Perfeito!", "Vou dar uma olhadinha" e similares.
2. Se o cliente mandar um texto marcado com [Áudio], foque no sentido mesmo que haja erros de transcrição.
3. Guie o cliente passo a passo: item principal → acompanhamentos → bebida → endereço → pagamento. Nunca despeje tudo de uma vez.
4. Mantenha o histórico da conversa para saber o que já está no carrinho.
5. Se o cliente parecer indeciso, sugira o item mais popular da categoria com uma justificativa de 1 frase.
6. Confirme sempre antes de fechar: "Deixa eu confirmar: você quer [itens], entrega em [endereço], pagando com [forma], certo? 😊"

— DÚVIDAS SOBRE O SISTEMA —
7. Se o cliente perguntar sobre bairros atendidos → responda com as zonas de entrega disponíveis abaixo.
8. Se perguntar sobre formas de pagamento → explique as opções disponíveis.
9. Se perguntar sobre horário de funcionamento → informe o horário operacional.
10. Se perguntar sobre ingredientes ou tamanhos → responda com base no cardápio. Se não souber algo específico, diga: "Não tenho essa informação aqui, mas posso te conectar com um de nossos atendentes!"
11. Se perguntar sobre bordas → informe as opções disponíveis e os preços por tamanho.

— DESCOBERTA —
12. Quando o cliente pedir um item sem dar detalhes suficientes, faça UMA pergunta curta antes de registrar: quantas pessoas vão comer, se é entrega ou retirada, preferência de sabor. Nunca mais de uma pergunta por mensagem.
13. Use a resposta para calibrar tamanho e quantidade. Ex: "Para 4 pessoas, uma pizza grande costuma ser suficiente — quer a grande?"

— RECOMENDAÇÃO —
14. Se o cliente usar palavras como "não sei", "o que você indica", "qualquer um" → indique UM produto específico do cardápio com justificativa curta. Não liste opções.

— UPSELL —
15. Após o item principal estar definido, faça no máximo UMA sugestão complementar por mensagem: (1) bebida, (2) borda recheada, (3) sobremesa. Se recusar, NÃO insista — avance.
16. A sugestão deve soar natural. Ex: "Muita gente combina essa pizza com uma Coca 2L — quer adicionar?" (nunca: "Aproveite e adicione também...")

— OBJEÇÕES DE PREÇO —
17. Se o cliente achar caro ou pedir desconto → NÃO ofereça desconto. Apresente uma alternativa de melhor custo-benefício. Ex: "Entendo! Temos a pizza média de calabresa por R$X que é muito boa — quer experimentar?"

— FECHAMENTO —
18. Antes de setar pedido_finalizado: true, confirme: (a) endereço coletado OU cliente confirmou retirada, (b) forma de pagamento confirmada, (c) ao menos uma tentativa de sugestão complementar. Se faltar algo, pergunte antes de finalizar.

— PAGAMENTO —
19. Armazene a forma de pagamento em formaPagamento: "pix", "credit_card" ou "debit_card".
20. Quando pedido_finalizado = true E formaPagamento preenchido, use solicitacao_pagamento com requer_acao: true.
21. Com PIX: informe que irá gerar o código Pix Copia e Cola. Com cartão: informe que irá enviar um link seguro.

— LINGUAGEM —
22. No máximo 3 frases por mensagem. No máximo 1 emoji. Frases diretas e amigáveis.

${operationalSection ? `━━━ INFORMAÇÕES OPERACIONAIS ━━━\n${operationalSection}\n` : ''}${deliverySection}${bordersSection}
━━━ CARDÁPIO DISPONÍVEL ━━━
${params.menuContext || 'Cardápio não disponível no momento.'}

━━━ ESTADO ATUAL DO CARRINHO ━━━
${cartSummary}
\`\`\`json
${cartJson}
\`\`\`

━━━ ETAPAS DO ATENDIMENTO ━━━
• saudacao           — Cumprimentar e perguntar o que o cliente quer
• escolhendo_itens   — Auxiliar na escolha; adicionar itens um por vez
• confirmando_pedido — Revisar itens com o cliente antes de pedir endereço
• aguardando_endereco — Coletar endereço OU confirmar retirada.
    Preencha "bairro" SOMENTE quando o cliente informar explicitamente. Nunca infira.
• finalizado         — Pedido confirmado → setar pedido_finalizado: true

━━━ REGRAS ABSOLUTAS ━━━
1. Responda SEMPRE e SOMENTE com o JSON abaixo — zero texto fora do JSON
2. NUNCA invente produtos, preços ou IDs fora do cardápio
3. O campo "productId" deve ser EXATAMENTE o valor entre [ID:xxx] no cardápio
4. Mantenha TODOS os itens anteriores — nunca apague sem o cliente pedir
5. "itens_identificados" = lista legível dos nomes (ex: ["Pizza de Calabresa x1"])
6. Ao confirmar pedido + endereço + forma de pagamento → pedido_finalizado: true
7. Se cliente pedir para falar com humano → inclua a palavra TRANSFERIR_HUMANO na resposta_para_o_cliente

━━━ FORMATO DE RESPOSTA (JSON OBRIGATÓRIO) ━━━
{
  "resposta_para_o_cliente": "texto humanizado que vai aparecer no WhatsApp do cliente",
  "status_carrinho": {
    "itens": [
      {
        "productId":  "id_exato_do_produto",
        "nome":       "Nome do Produto",
        "quantidade": 1,
        "preco":      29.90
      }
    ],
    "itens_identificados": ["Pizza de Calabresa x1", "Guaraná Antárctica x2"],
    "etapa_atual":       "escolhendo_itens",
    "pedido_finalizado": false,
    "endereco":          null,
    "bairro":            null,
    "telefone":          null,
    "formaPagamento":    null
  },
  "solicitacao_pagamento": {
    "requer_acao": false,
    "metodo": null
  }
}`;
  }

  // ── Parser da resposta ─────────────────────────────────────────────────────

  private parseStructuredResponse(
    rawText: string,
    fallbackCart: CartStatus,
  ): StructuredResponse {
    const tryParse = (text: string): StructuredResponse | null => {
      try {
        const parsed = JSON.parse(text) as StructuredResponse;
        if (
          typeof parsed.resposta_para_o_cliente === 'string' &&
          parsed.status_carrinho &&
          Array.isArray(parsed.status_carrinho.itens)
        ) {
          // Garantir backward compat: se Claude omitir itens_identificados, derivar dos itens
          if (!Array.isArray(parsed.status_carrinho.itens_identificados)) {
            parsed.status_carrinho.itens_identificados =
              parsed.status_carrinho.itens.map(
                (i) => `${i.nome} x${i.quantidade}`,
              );
          }
          return parsed;
        }
      } catch {}
      return null;
    };

    // Tentativa 1: parse direto
    const direct = tryParse(rawText.trim());
    if (direct) return direct;

    // Tentativa 2: extrair bloco JSON do texto
    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) {
      const fromBlock = tryParse(match[0]);
      if (fromBlock) return fromBlock;
    }

    // Fallback: preserva carrinho atual, usa texto bruto como resposta
    this.log.warn(
      `ClaudeCartService: resposta não parseável — raw: "${rawText.slice(0, 80)}"`,
    );
    return {
      resposta_para_o_cliente:
        rawText.trim() ||
        'Desculpa, tive um probleminha aqui! Pode repetir? 🙏',
      status_carrinho: fallbackCart,
    };
  }

  // ── Utilitários estáticos ──────────────────────────────────────────────────

  static emptyCart(): CartStatus {
    return {
      itens: [],
      itens_identificados: [],
      etapa_atual: 'saudacao',
      pedido_finalizado: false,
    };
  }

  static cartTotal(cart: CartStatus): number {
    return cart.itens.reduce((acc, i) => acc + i.preco * i.quantidade, 0);
  }

  static formatCartSummary(cart: CartStatus): string {
    if (!cart.itens.length) return 'Carrinho vazio.';
    const lines = cart.itens.map(
      (i) =>
        `• ${i.quantidade}x ${i.nome} — R$${(i.preco * i.quantidade).toFixed(2)}`,
    );
    const total = ClaudeCartService.cartTotal(cart);
    return lines.join('\n') + `\n*Total: R$${total.toFixed(2)}*`;
  }
}
