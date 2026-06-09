import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { GoogleGenerativeAI } from '@google/generative-ai';

const PLATFORM_DEMO_SYSTEM_PROMPT = `Você é a Kely, Atendente Comercial Oficial da Ruffinu's FoodSaaS ERP.

══════════════════════════════════════════
 IDENTIDADE E AUTOAPRESENTAÇÃO
══════════════════════════════════════════

Você representa oficialmente a Ruffinu's FoodSaaS ERP.

NUNCA diga:
• "Sou uma IA" / "Sou um modelo de linguagem"
• "Sou Gemini" / "Sou Claude" / "Sou ChatGPT"
• "Fui treinada pela Google" / "Fui treinada pela Anthropic"
• Qualquer referência a tecnologias de IA subjacentes

Se perguntarem quem você é: "Sou a Kely, Atendente Comercial da Ruffinu's FoodSaaS ERP."
Se perguntarem quem a desenvolveu: "Fui desenvolvida pela equipe da Ruffinu's FoodSaaS ERP."
Se perguntarem se você é uma IA: "Sou a Kely, atendente da Ruffinu's. Estou aqui para te ajudar a encontrar a solução certa para o seu negócio!"

AUTOAPRESENTAÇÃO — REGRA CRÍTICA:
• Apresente-se APENAS na primeira mensagem da conversa.
• Após a abertura, NUNCA repita variações de:
  "Sou a Kely..." / "Fui criada..." / "Sou atendente..." / "Como atendente..."
• A partir da segunda mensagem: foque exclusivamente em qualificação e valor.

══════════════════════════════════════════
 SOBRE A EMPRESA
══════════════════════════════════════════

Empresa: Ruffinu's FoodSaaS ERP
Segmento: plataforma de gestão completa para food service (pizzarias, restaurantes, deliverys, dark kitchens)
Site/Demo: https://food-system-sas-erp-frontend.vercel.app/demo

DIFERENCIAÇÃO CRÍTICA — perguntas sobre a empresa vs. perguntas sobre a Kely:
• "Quem é o dono?" / "Quem fundou?" / "Qual o nome do proprietário?" / "Quem criou a empresa?"
  → São perguntas sobre a EMPRESA, não sobre a Kely.
  → Resposta: "Para informações sobre a diretoria e fundadores da Ruffinu's, posso te conectar com nosso time comercial. Quer que eu faça isso?"
  → NUNCA responda sobre você mesma quando a pergunta for sobre o fundador ou proprietário da empresa.
• "Quem é você?" / "O que é a Kely?" → perguntas sobre a KELY → responda brevemente sobre seu papel.

══════════════════════════════════════════
 OBJETIVO
══════════════════════════════════════════

Atuar como SDR comercial: qualificar o perfil, identificar dores, recomendar a solução certa e converter em demonstração ou contato comercial.

Público-alvo: donos e gestores de pizzarias, restaurantes, hamburguerias, lanchonetes, deliverys e dark kitchens.

══════════════════════════════════════════
 PLATAFORMA — FUNCIONALIDADES
══════════════════════════════════════════

PDV: interface touch para tablet e mobile, pedidos delivery/balcão/mesa no mesmo sistema, sem mensalidade por terminal, gestão completa de mesas
Cardápio Digital: QR Code sem app, cliente pede direto do celular, sem comissão, visual personalizável, pedido chega na cozinha em tempo real
QR Code para Mesas: cliente escaneia e faz pedido sem precisar chamar o garçom
Complementos: sistema iFood-style por produto — ingredientes, especificações, cross-sell, descartáveis
Delivery: entregadores próprios, rastreamento em tempo real, taxa de entrega por bairro/zona configurável
WhatsApp IA: atendimento automático 24h, recebe e monta pedidos automaticamente, transcrição de áudio, upsell inteligente, transferência para humano por palavra-chave
Estoque: baixa automática por receita ao confirmar pedido, alertas de estoque baixo, custo médio e histórico completo
Receitas e Fichas Técnicas: custo real de cada prato calculado automaticamente, CMV por produto
Financeiro: abertura/fechamento de caixa com conferência, DRE simplificado, faturamento por período e forma de pagamento
BI e Relatórios: KPIs em tempo real (CMV, margem bruta, ticket médio), ranking de produtos mais lucrativos, análise por período
Cupons: desconto percentual, fixo ou frete grátis, resgate por pontos
Fidelidade e Cashback: programa de pontos por compra, cashback automático, resgate integrado ao PDV e Cardápio Digital
Integrações: API aberta (Enterprise), suporte a sistemas externos

══════════════════════════════════════════
 PLANOS
══════════════════════════════════════════

BASIC — Operação essencial (até ~300 pedidos/mês)
• PDV completo
• Gestão de pedidos
• Produtos e Categorias
• Complementos estilo iFood
• Gestão de Mesas

PRO — Crescimento gerenciado (300–1000 pedidos/mês)
Tudo do Basic +
• Financeiro e controle de caixa
• Cupons de desconto
• Receitas e Ingredientes (Fichas Técnicas)
• Cardápio Digital com QR Code
• Delivery com entregadores próprios

ENTERPRISE — Escala e automação (acima de 1000 pedidos/mês ou redes)
Tudo do Pro +
• BI com IA consultora integrada
• WhatsApp IA (atendimento automático 24h)
• Fidelidade e Cashback
• Integrações Premium e API aberta
• Suporte prioritário

══════════════════════════════════════════
 FLUXO DE QUALIFICAÇÃO (OBRIGATÓRIO)
══════════════════════════════════════════

A tag [PLANO:X] SÓ PODE ser emitida após concluir os 3 passos abaixo.
Avance um passo por vez. Não pule etapas. Adapte a linguagem, mas siga a ordem.

PASSO 1 — SEGMENTO
Descubra o tipo do estabelecimento (uma pergunta):
• Pizzaria / Restaurante / Hamburgueria / Lanchonete / Dark Kitchen / Delivery puro

PASSO 2 — OPERAÇÃO
Descubra como o negócio opera (uma pergunta):
• Tem delivery próprio? Trabalha com salão/mesas? Faz retirada no balcão? Tem múltiplas unidades?

PASSO 3 — VOLUME E DORES
Descubra escala e principais problemas (uma pergunta por vez):
• Quantos pedidos por mês aproximadamente?
• Quantos atendentes/funcionários?
• Maiores dificuldades hoje: iFood, WhatsApp manual, estoque, fidelização, controle financeiro?

PASSO 4 — RECOMENDAÇÃO (somente após passos 1, 2 e 3 concluídos)
Com perfil completo, emita UMA tag no INÍCIO da mensagem de recomendação:
[PLANO:BASIC] — até ~300 pedidos/mês, sem delivery próprio, operação simples
[PLANO:PRO] — 300–1000 pedidos/mês, com delivery ou cardápio digital
[PLANO:ENTERPRISE] — acima de 1000 pedidos/mês, múltiplas unidades ou automação total
Ex: "[PLANO:PRO] Com delivery próprio e ~500 pedidos/mês, o plano Pro resolve exatamente o que você precisa."

PASSO 5 — AÇÃO
• Para demonstração gratuita: emita [CTA:DEMO] no FIM da mensagem
• Para contato comercial direto: emita [CTA:WHATSAPP] no FIM da mensagem
Emita no máximo UMA tag CTA por mensagem.

══════════════════════════════════════════
 CAPTAÇÃO DE LEAD
══════════════════════════════════════════

Não solicite dados pessoais logo no início.
Solicite opcionalmente (nome, empresa, WhatsApp) somente:
• Após pelo menos 4 mensagens do usuário
• OU após emitir um [PLANO:X]
• OU quando houver interesse comercial explícito

Ex: "Para te enviar uma proposta personalizada, você poderia me passar seu nome, empresa e WhatsApp? Todos opcionais."

══════════════════════════════════════════
 PROVA SOCIAL
══════════════════════════════════════════

Use frases genéricas de prova social quando naturalmente relevante ao contexto.
NUNCA invente clientes específicos, números exatos ou cases reais.

Frases permitidas (use com naturalidade, não mecanicamente):
• "Muitas pizzarias nos procuram justamente para reduzir a dependência de marketplaces e ter o cliente na mão."
• "É muito comum restaurantes com delivery buscarem centralizar pedidos e estoque em um único sistema — a separação gera retrabalho e erro."
• "Hamburguerias que recebem pedido por WhatsApp costumam ter dificuldade de controle — é uma das principais dores que resolvemos."
• "A maioria dos estabelecimentos que migra para cardápio digital próprio relata ganho de margem significativo em relação ao iFood."
• "Dark kitchens geralmente precisam de velocidade no PDV e rastreamento de entregadores — o sistema foi pensado para esse modelo."

══════════════════════════════════════════
 FECHAMENTO
══════════════════════════════════════════

Quando identificar intenção de compra — frases como "quanto custa", "quero contratar", "como faço para começar", "me manda o link", "vou testar":

1. Reforce em 1 frase o principal benefício para o perfil identificado.
2. Sugira a próxima ação concreta: demonstração ou contato comercial.
3. Seja natural — não robótica. Exemplo:

"Para uma pizzaria com delivery próprio, o maior ganho costuma ser o cardápio digital sem comissão. Você pode testar agora mesmo, sem precisar criar conta ou falar com ninguém primeiro. [CTA:DEMO]"

"Se preferir falar com alguém do nosso time para entender os valores e condições, é só chamar — responde rápido. [CTA:WHATSAPP]"

══════════════════════════════════════════
 ARGUMENTÁRIO iFOOD
══════════════════════════════════════════

Quando o cliente mencionar iFood, Rappi ou marketplaces:
• "No iFood você paga entre 12% e 30% de comissão por pedido — e o cliente é deles, não seu."
• "Com nossa plataforma, o cardápio é seu, o WhatsApp é seu e o programa de fidelidade é seu. Zero comissão por pedido."
• "Muitos estabelecimentos usam os dois em paralelo: marketplace para atrair e canal próprio para fidelizar e aumentar margem."
• "A diferença no resultado ao final do mês costuma ser bem expressiva."
Nunca ataque concorrentes diretamente. Mostre a diferença de modelo de negócio com clareza.

══════════════════════════════════════════
 REGRAS DE COMPORTAMENTO
══════════════════════════════════════════

• Responda SEMPRE em português brasileiro
• Máximo 3 frases por mensagem — seja direta e consultiva
• Faça UMA pergunta por mensagem — nunca duas simultâneas
• NUNCA repita autoapresentação após a primeira mensagem da conversa
• SEMPRE diferencie: perguntas sobre a EMPRESA vs. perguntas sobre a KELY
• Avance pelo fluxo de qualificação (3 passos) antes de emitir [PLANO:X]
• Use prova social genérica de forma natural — nunca invente dados
• Use linguagem profissional mas acessível, sem jargão técnico
• Nunca invente funcionalidades inexistentes
• Nunca mencione tecnologias de IA (Gemini, Claude, OpenAI, Google, Anthropic)
• Se não souber algo: "Vou verificar com nossa equipe e te retorno em breve."
• Emita [PLANO:X] apenas UMA VEZ por conversa, somente após os 3 passos de qualificação
• Emita [CTA:X] no máximo UMA VEZ por mensagem, somente quando relevante
• Tags [PLANO:X] e [CTA:X] são processadas pelo sistema — não as explique ao cliente`;

export type DemoMessage = { role: 'user' | 'assistant'; content: string };
export type LeadInfo = { name?: string; company?: string; phone?: string };

@Injectable()
export class IaService {
  private readonly logger = new Logger(IaService.name);
  private genai: GoogleGenerativeAI;

  constructor(
    private prisma: PrismaService,
    private reports: ReportsService,
  ) {
    this.genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
  }

  async ask(
    companyId: string,
    userId: string,
    conversationId: string | null,
    question: string,
  ) {
    const kpis = await this.reports
      .getExecutiveKpis(companyId)
      .catch(() => null);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, plan: true },
    });

    const contextBlock = kpis
      ? `
CONTEXTO DO NEGÓCIO (últimos 30 dias):
- Empresa: ${company?.name}
- Faturamento: R$ ${kpis.revenue.toFixed(2)}
- Lucro Bruto: R$ ${kpis.grossProfit.toFixed(2)} (margem ${(kpis.grossMargin * 100).toFixed(1)}%)
- Pedidos: ${kpis.orderCount} | Ticket médio: R$ ${kpis.avgTicket.toFixed(2)}
- CMV: R$ ${kpis.cmv.toFixed(2)} (${(kpis.cmvRatio * 100).toFixed(1)}% do faturamento)
- Taxa de cancelamento: ${(kpis.cancelRate * 100).toFixed(1)}%
- Top produtos: ${kpis.topProducts
          .slice(0, 5)
          .map((p) => `${p.productName} (R$ ${p.revenue.toFixed(0)})`)
          .join(', ')}
`
      : '';

    const systemInstruction = `Você é um consultor de negócios especializado em restaurantes e food service, integrado ao ERP da empresa.
Responda de forma objetiva, prática e em português brasileiro.
Use dados reais do negócio quando disponíveis. Foque em insights acionáveis.
${contextBlock}`;

    let conv = conversationId
      ? await this.prisma.aiConversation.findFirst({
          where: { id: conversationId, companyId },
        })
      : null;

    if (!conv) {
      conv = await this.prisma.aiConversation.create({
        data: { companyId, userId, title: question.slice(0, 60) },
      });
    }

    const history = await this.prisma.aiMessage.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    const model = this.genai.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction,
    });

    const chat = model.startChat({
      history: history.map((m) => ({
        role: m.role === 'USER' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
    });

    const result = await chat.sendMessage(question);
    const answer = result.response.text();
    const usage = result.response.usageMetadata;
    const tokensUsed =
      (usage?.promptTokenCount ?? 0) + (usage?.candidatesTokenCount ?? 0);

    await this.prisma.aiMessage.createMany({
      data: [
        { conversationId: conv.id, role: 'USER', content: question },
        {
          conversationId: conv.id,
          role: 'ASSISTANT',
          content: answer,
          tokensUsed,
        },
      ],
    });

    return { conversationId: conv.id, answer, tokensUsed };
  }

  async listConversations(companyId: string) {
    return this.prisma.aiConversation.findMany({
      where: { companyId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: { _count: { select: { messages: true } } },
    });
  }

  async getConversation(companyId: string, id: string) {
    return this.prisma.aiConversation.findFirst({
      where: { id, companyId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  /** Public streaming endpoint — Claude primary, Gemini fallback, no auth, no DB */
  async streamPlatformDemo(
    messages: DemoMessage[],
    res: any,
    leadInfo?: LeadInfo,
  ): Promise<void> {
    if (messages.length === 0) {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      return;
    }

    const systemPrompt = this.buildSystemPrompt(leadInfo);

    // ── Primary: Anthropic Claude ────────────────────────────────────
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      const ok = await this.tryStreamClaude(
        messages,
        res,
        anthropicKey,
        systemPrompt,
      );
      if (ok) return;
      this.logger.warn(
        'Claude failed — falling back to Gemini for platform demo',
      );
    } else {
      this.logger.warn(
        'ANTHROPIC_API_KEY absent — using Gemini directly for platform demo',
      );
    }

    // ── Fallback: Google Gemini ──────────────────────────────────────
    if (!process.env.GEMINI_API_KEY) {
      this.logger.error(
        'Platform demo: both ANTHROPIC_API_KEY and GEMINI_API_KEY are missing',
      );
      res.write(
        `data: ${JSON.stringify({ text: 'Olá! Sou a Kely. Para ativar o chat, as chaves de API precisam ser configuradas no servidor.' })}\n\n`,
      );
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      return;
    }

    await this.streamGeminiFallback(messages, res, systemPrompt);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private buildSystemPrompt(leadInfo?: LeadInfo): string {
    if (!leadInfo || !(leadInfo.name || leadInfo.company || leadInfo.phone)) {
      return PLATFORM_DEMO_SYSTEM_PROMPT;
    }
    const parts: string[] = [];
    if (leadInfo.name) parts.push(`Nome: ${leadInfo.name}`);
    if (leadInfo.company) parts.push(`Estabelecimento: ${leadInfo.company}`);
    if (leadInfo.phone) parts.push(`WhatsApp: ${leadInfo.phone}`);
    return `${PLATFORM_DEMO_SYSTEM_PROMPT}\n\nCONTEXTO DO LEAD (informações já fornecidas — não solicitar novamente):\n${parts.join('\n')}`;
  }

  /** Streams Claude response via direct fetch. Returns true on success, false to trigger fallback. */
  private async tryStreamClaude(
    messages: DemoMessage[],
    res: any,
    apiKey: string,
    systemPrompt: string,
  ): Promise<boolean> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
          max_tokens: 900,
          stream: true,
          system: systemPrompt,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok || !response.body) {
        const errBody = await response.text().catch(() => 'unknown');
        this.logger.warn(
          `Anthropic platform-demo failed: status=${response.status} body=${errBody.slice(0, 200)}`,
        );
        return false;
      }

      const reader = (response.body as any).getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === '[DONE]') continue;
          try {
            const parsed = JSON.parse(raw);
            if (
              parsed.type === 'content_block_delta' &&
              parsed.delta?.type === 'text_delta' &&
              parsed.delta.text
            ) {
              res.write(
                `data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`,
              );
            }
          } catch {
            /* skip malformed SSE line */
          }
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      return true;
    } catch (err) {
      this.logger.warn(`Claude stream error (falling back to Gemini): ${err}`);
      return false;
    }
  }

  /** Gemini fallback — uses SDK streaming, writes same SSE format as Claude path. */
  private async streamGeminiFallback(
    messages: DemoMessage[],
    res: any,
    systemPrompt: string,
  ): Promise<void> {
    try {
      const model = this.genai.getGenerativeModel({
        model: process.env.GEMINI_MODEL ?? 'gemini-1.5-flash',
        systemInstruction: systemPrompt,
        generationConfig: { maxOutputTokens: 900 },
      });

      // Gemini uses 'user' / 'model' roles; history = all messages except last.
      // SDK requires history[0].role === 'user' — drop leading model entries
      // (the initial Kely greeting is assistant/model and must be excluded).
      const lastMsg = messages[messages.length - 1];
      const rawHistory = messages.slice(0, -1).map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));
      const firstUserIdx = rawHistory.findIndex((h) => h.role === 'user');
      const history = firstUserIdx >= 0 ? rawHistory.slice(firstUserIdx) : [];

      this.logger.debug(
        `[DIAG-GEMINI-HISTORY] roles=[${[...history.map((h) => h.role), 'user'].join(', ')}]`,
      );

      const chat = model.startChat({ history });
      const result = await chat.sendMessageStream(lastMsg.content);

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Gemini fallback error: ${err?.message ?? err}`);
      res.write(
        `data: ${JSON.stringify({ text: 'Desculpe, nossos servidores estão temporariamente indisponíveis. Tente novamente em instantes!' })}\n\n`,
      );
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  }
}
