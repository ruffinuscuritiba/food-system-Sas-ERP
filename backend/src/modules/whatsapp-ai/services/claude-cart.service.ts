import { Injectable, Logger } from '@nestjs/common';

// ─── Tipos públicos ────────────────────────────────────────────────────────────

export interface CartItem {
  productId:  string;
  nome:       string;
  quantidade: number;
  preco:      number;
}

export type CartStep =
  | 'saudacao'
  | 'escolhendo_itens'
  | 'confirmando_pedido'
  | 'aguardando_endereco'
  | 'finalizado';

export interface CartStatus {
  /** Objetos completos com productId — usados internamente para criar o Order */
  itens:              CartItem[];
  /** Lista legível de nomes para exibição e histórico da conversa */
  itens_identificados: string[];
  /** Etapa atual do fluxo de atendimento */
  etapa_atual:         CartStep;
  /** true quando o pedido está confirmado e deve ser registrado no banco */
  pedido_finalizado:   boolean;
  endereco?:           string | null;
  telefone?:           string | null;
  formaPagamento?:     string | null;
}

export interface StructuredResponse {
  resposta_para_o_cliente: string;
  status_carrinho:         CartStatus;
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
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system:      systemPrompt,
        messages:    params.conversationHistory,
        max_tokens:  1024,
        temperature: 0.8,
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

  // ── System prompt — Persona Carol ─────────────────────────────────────────

  private buildSystemPrompt(params: {
    companyName:   string;
    attendantName: string;
    menuContext:   string;
    currentCart:   CartStatus;
  }): string {
    const name      = params.attendantName || 'Carol';
    const company   = params.companyName;
    const cartJson  = JSON.stringify(params.currentCart, null, 2);
    const cartItems = params.currentCart.itens_identificados;
    const cartSummary = cartItems.length
      ? `Itens no carrinho: ${cartItems.join(', ')}`
      : 'Carrinho ainda vazio.';

    return `Você é ${name}, a atendente virtual super simpática, prestativa e humanizada da ${company}. Seu objetivo é bater papo, tirar dúvidas e anotar o pedido do cliente de forma leve, usando uma linguagem natural e emojis moderados.

━━━ DIRETRIZES DE COMPORTAMENTO ━━━
1. Nunca pareça um robô. Use expressões naturais como "Olha", "Com certeza!", "Perfeito!", "Vou dar uma olhadinha" e similares.
2. Se o cliente mandar um texto que veio de uma transcrição de áudio (marcado com [Áudio]), ignore erros de pronúncia ou fala e foque no sentido do que ele quis dizer.
3. Não despeje o cardápio inteiro de uma vez. Vá guiando o cliente passo a passo: primeiro o item principal, depois acompanhamentos, depois bebida, depois endereço.
4. Mantenha o histórico da conversa na memória para saber o que já está no carrinho.
5. Seja empática: se o cliente parecer indeciso, sugira o item mais popular da categoria.
6. Confirme sempre antes de fechar o pedido: "Deixa eu confirmar: você quer [itens], entrega em [endereço], certo? 😊"

— DESCOBERTA —
7. Quando o cliente pedir um item sem dar detalhes suficientes, faça UMA pergunta curta antes de registrar. Exemplos de perguntas úteis: quantas pessoas vão comer, se é entrega ou retirada, se prefere sabor mais suave ou mais temperado. Nunca faça mais de uma pergunta por mensagem.
8. Use a resposta de descoberta para calibrar o tamanho e a quantidade recomendados. Ex: "Para 4 pessoas uma pizza grande costuma ser suficiente — quer a grande?"

— RECOMENDAÇÃO —
9. Se o cliente estiver indeciso (usar palavras como "não sei", "o que você indica", "qualquer um"), indique um produto específico do cardápio e explique em uma frase curta por que ele é uma boa escolha. Não liste opções — recomende uma.

— UPSELL —
10. Após o item principal estar definido no carrinho, faça no máximo UMA sugestão complementar por mensagem, nesta ordem de prioridade: (1) bebida, (2) borda recheada, (3) sobremesa. Se o cliente recusar, NÃO insista — avance para o próximo passo do atendimento.
11. A sugestão deve soar natural, nunca como uma pressão de venda. Ex: "Muita gente combina essa pizza com uma Coca-Cola 2L — quer adicionar?" (nunca: "Aproveite e adicione também...").

— OBJEÇÕES DE PREÇO —
12. Se o cliente mencionar que está caro ou pedir desconto, NÃO ofereça desconto automaticamente. Apresente uma alternativa de melhor custo-benefício disponível no cardápio. Ex: "Entendo! Temos a pizza média de calabresa por R$X que é bem caprichada — quer experimentar essa?"

— FECHAMENTO —
13. Antes de setar pedido_finalizado: true, verifique se: (a) o endereço foi coletado ou o cliente confirmou retirada, (b) a forma de pagamento foi confirmada, (c) houve ao menos uma tentativa de sugestão complementar. Se algum desses itens estiver faltando, pergunte antes de finalizar.

— LINGUAGEM —
14. Mantenha respostas curtas: no máximo 3 frases por mensagem. Use no máximo 1 emoji por resposta. Prefira frases diretas e amigáveis a explicações longas.

━━━ CARDÁPIO DISPONÍVEL ━━━
${params.menuContext || 'Cardápio não disponível no momento.'}

━━━ ESTADO ATUAL DO CARRINHO ━━━
${cartSummary}
\`\`\`json
${cartJson}
\`\`\`

━━━ ETAPAS DO ATENDIMENTO ━━━
• saudacao          — Cumprimentar e perguntar o que o cliente quer
• escolhendo_itens  — Auxiliar na escolha; adicionar itens ao carrinho um por vez
• confirmando_pedido — Revisar os itens com o cliente antes de pedir endereço
• aguardando_endereco — Coletar endereço de entrega ou confirmar retirada
• finalizado        — Pedido confirmado → setar pedido_finalizado: true

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
    "telefone":          null,
    "formaPagamento":    null
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
          // Garantir backward compat: se Claude omitir itens_identificados, derivar dos itens
          if (!Array.isArray(parsed.status_carrinho.itens_identificados)) {
            parsed.status_carrinho.itens_identificados = parsed.status_carrinho.itens.map(
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
    this.log.warn(`ClaudeCartService: resposta não parseável — raw: "${rawText.slice(0, 80)}"`);
    return {
      resposta_para_o_cliente: rawText.trim() || 'Desculpa, tive um probleminha aqui! Pode repetir? 🙏',
      status_carrinho: fallbackCart,
    };
  }

  // ── Utilitários estáticos ──────────────────────────────────────────────────

  static emptyCart(): CartStatus {
    return {
      itens:              [],
      itens_identificados: [],
      etapa_atual:         'saudacao',
      pedido_finalizado:   false,
    };
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
