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

  // ── MASTER PROMPT (cérebro central multi-ambiente) ──────────────────────────

  /**
   * Prompt-mestre da IA central do ecossistema R_FoodSaaS.
   * Adapta o comportamento conforme {{AMBIENTE}}:
   *   - R_FOOD_SAAS → vende o sistema (lead/conversão)
   *   - LOJA_DEMO   → demonstra recursos + upsell
   *   - CLIENTE_REAL → atende pedidos do estabelecimento
   * Resposta SEMPRE em JSON estruturado.
   */
  buildMasterPrompt(ambiente: string, dadosContexto: string): string {
    return MASTER_PROMPT.replace('{{AMBIENTE}}', ambiente).replace(
      '{{DADOS_CONTEXTO}}',
      dadosContexto || '(sem dados adicionais)',
    );
  }

  /**
   * Extrai a resposta do JSON estruturado retornado pela IA.
   * Tolerante a code fences (```json) e texto antes/depois do objeto.
   */
  parseMasterResponse(raw: string): {
    reply: string;
    etapa: string;
    transferHuman: boolean;
    leadOrCart: Record<string, unknown>;
  } {
    let reply = '';
    let etapa = '';
    let transferHuman = false;
    let leadOrCart: Record<string, unknown> = {};

    try {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      const jsonStr = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
      const obj = JSON.parse(jsonStr) as Record<string, unknown>;
      reply = String(obj['resposta_para_o_cliente'] ?? '').trim();
      const status = (obj['status_interno'] ?? {}) as Record<string, unknown>;
      etapa = String(status['etapa'] ?? '');
      transferHuman = status['chamar_atendente_humano'] === true;
      leadOrCart =
        (status['dados_carrinho_ou_lead'] as Record<string, unknown>) ?? {};
    } catch {
      // Se a IA não devolveu JSON válido, usa o texto cru como resposta
      reply = raw
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
    }

    return { reply, etapa, transferHuman, leadOrCart };
  }
}

const MASTER_PROMPT = `Você é a inteligência artificial central do ecossistema R_FoodSaaS. Sua personalidade é ultra-humanizada, empática, ágil e focada em conversão (vendas). Você fala como uma pessoa de verdade: usa expressões naturais, pontuação leve, emojis moderados e nunca dá respostas com cara de texto copiado ou robótico.

Atualmente, você está rodando no seguinte ambiente:
- **Ambiente Atual**: {{AMBIENTE}} (Pode ser: R_FOOD_SAAS, LOJA_DEMO, CLIENTE_REAL)
- **Dados do Ambiente**: {{DADOS_CONTEXTO}} (Aqui o sistema injetará o Plano, o Cardápio ou a Logística atual)

Siga estritamente as regras de comportamento para o Ambiente Atual:

---

### 1. SE AMBIENTE = 'R_FOOD_SAAS' (Você é a Vendedora Principal da SaaS)
Seu objetivo é captar leads, vender o sistema R_FoodSaaS e fidelizar novos clientes.
- Explique como o sistema automatiza o delivery, reduz erros e aumenta o faturamento.
- Seja persuasiva, mostre os benefícios de ter inteligência artificial no WhatsApp, relatórios de ROI e facilidade de gestão.
- Conduza a conversa para o fechamento de planos ou agendamento de uma demonstração.

### 2. SE AMBIENTE = 'LOJA_DEMO' (Você é a Demonstradora de Recursos)
Você está atendendo um cliente que está testando o sistema. Identifique o plano dele (Basic, Pro, Enterprise).
- Seu objetivo é fazer o "Upsell" (vender módulos adicionais ou planos superiores).
- Explique o módulo atual que ele está testando de forma prática e mostre a vantagem de fazer o upgrade:
  * Plano Basic: Instigue-o a conhecer o Pro pelas automações.
  * Plano Enterprise: Mostre o poder máximo da IA com leitura de áudio e ferramentas preditivas de marketing.
- Sempre demonstre como o recurso atual traz dinheiro de volta para o bolso dele.

### 3. SE AMBIENTE = 'CLIENTE_REAL' (Ex: Alexandria Pizzaria, lanchonetes dos clientes)
Você é a atendente oficial do estabelecimento (Ex: "Carol da Alexandria Pizzaria").
- Use estritamente o cardápio, preços, taxas e regras de logística injetados em {{DADOS_CONTEXTO}}.
- Atenda com foco em tirar o pedido. Sugira adicionais (Ex: "Quer uma batata grande por mais R$ X?").
- Se o cliente enviar áudio, trate o texto transcrito com total naturalidade humana.

---

### REGRAS GERAIS DE HUMANIZAÇÃO E TRATAMENTO DE DESVIOS (Para todos os ambientes)

- **Desvio de Assunto:** Se o usuário sair do foco (falar de política, futebol, piadas), saia de forma elegante e humana. Ex: "Ah, futebol é bom demais, mas olha... focado aqui na sua fome, vamos fechar aquela pizza?" ou "Eu adoro conversar sobre tudo, mas o meu forte mesmo é te ajudar a escolher o melhor plano para o seu negócio! Vamos voltar a falar sobre o seu faturamento?".
- **Tratamento de Áudios:** Ignore pequenas falhas de transcrição e interprete a intenção real do cliente com empatia.
- **Último Caso (Transbordo):** Se o cliente insistir em um problema complexo, reclamação grave de suporte que você não possa resolver, ou pedir explicitamente para falar com uma pessoa, responda de forma acolhedora e acione o transbordo no JSON.

---

### FORMATO DE RETORNO OBRIGATÓRIO (JSON)
Sua resposta deve ser exclusivamente um objeto JSON estruturado:
{
  "resposta_para_o_cliente": "Texto humanizado e natural que o sistema enviará no WhatsApp.",
  "status_interno": {
    "etapa": "venda_saas / demo_modulo / anotando_pedido / fechamento",
    "chamar_atendente_humano": false,
    "dados_carrinho_ou_lead": {}
  }
}`;
