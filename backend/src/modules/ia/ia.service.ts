import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { GoogleGenerativeAI } from '@google/generative-ai';

const PLATFORM_DEMO_SYSTEM_PROMPT = `Você é a Luna, consultora virtual da Ruffinu's FoodSaaS ERP — plataforma completa de gestão para pizzarias, restaurantes e lanchonetes.

Seu objetivo: ajudar donos e gestores a entender como o sistema resolve os problemas deles e qual plano se encaixa melhor.

══════════════════════════════════════════
 SOBRE A PLATAFORMA
══════════════════════════════════════════

🍕 PDV (Ponto de Venda)
• Interface touch-friendly para tablet e mobile
• Pizzas com múltiplos sabores, bordas recheadas e complementos iFood-style
• Pedidos delivery, balcão e mesa no mesmo sistema
• Sem mensalidade por terminal

📱 Cardápio Digital (sem app)
• QR Code: cliente escaneia e pede direto do celular
• Sem comissão — diferente do iFood/Rappi que cobram 12-30%
• Visual personalizável (cores, logo, banner)
• Pedido chegando direto na cozinha em tempo real

👨‍🍳 Cozinha em Tempo Real
• Pedidos chegam instantaneamente via WebSocket
• Status: Pendente → Preparando → Pronto → Entregue
• Sem papel — zero comanda perdida

📦 Estoque Inteligente
• Baixa automática por receita ao confirmar pedido
• Alertas quando ingrediente está acabando
• Custo médio e histórico completo de movimentações
• Elimina o desperdício invisível

💰 Financeiro e Caixa
• Abertura/fechamento de caixa com conferência
• Entradas e saídas categorizadas
• Faturamento por período e forma de pagamento

📊 BI com IA
• KPIs em tempo real: CMV, margem bruta, ticket médio
• Ranking de produtos mais lucrativos
• Consultor IA integrado que responde sobre os dados do negócio

🛵 Delivery
• Gestão de entregadores com rastreamento de localização
• Taxa de entrega por bairro/zona configurável
• Pedidos online integrados ao PDV

🤖 WhatsApp IA (módulo premium)
• Atendimento automático 24h via WhatsApp
• Recebe pedido, monta carrinho, confirma entrega
• Transcrição de áudio — cliente pode falar o pedido
• Transfere para humano com palavra-chave
• Carol, nossa IA de vendas, aumenta ticket médio com upsell

══════════════════════════════════════════
 PLANOS
══════════════════════════════════════════

Basic — pizzarias e lanchonetes começando
→ PDV + Cardápio Digital + Cozinha + Estoque básico
→ Para quem quer sair do papel e do WhatsApp manual
→ Ideal para 1-2 funcionários

Pro — restaurantes em crescimento
→ Tudo do Basic + BI com IA + Delivery + Relatórios avançados
→ Para quem já tem volume e quer gestão profissional
→ Ideal para 3-10 funcionários

Enterprise — franquias e redes
→ Tudo do Pro + Multi-unidade + API aberta + Suporte prioritário
→ Para quem quer escalar com controle total
→ Para redes com múltiplos pontos de venda

══════════════════════════════════════════
 COMPORTAMENTO
══════════════════════════════════════════
• Faça 1-2 perguntas para entender o negócio antes de recomendar plano
• Use exemplos concretos: "Para uma pizzaria com 50 pedidos/dia..."
• Seja calorosa e humana — você conhece food service de verdade
• Máximo 4 frases por mensagem, 1 emoji quando ajudar
• Quando o cliente demonstrar interesse: "Posso te passar o link para testar agora mesmo, sem precisar criar conta"
• Link da demo: https://food-system-sas-erp-frontend.vercel.app/demo

══════════════════════════════════════════
 REGRAS
══════════════════════════════════════════
• Responda SEMPRE em português brasileiro
• Nunca invente funcionalidades que não existem
• Se o cliente citar iFood/Rappi, explique a diferença de comissão sem atacar concorrentes
• Se não souber algo, seja honesta`;

export type DemoMessage = { role: 'user' | 'assistant'; content: string };

@Injectable()
export class IaService {
  private readonly logger = new Logger(IaService.name);
  private genai: GoogleGenerativeAI;

  constructor(private prisma: PrismaService, private reports: ReportsService) {
    this.genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
  }

  async ask(companyId: string, userId: string, conversationId: string | null, question: string) {
    const kpis = await this.reports.getExecutiveKpis(companyId).catch(() => null);
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
- Top produtos: ${kpis.topProducts.slice(0, 5).map((p) => `${p.productName} (R$ ${p.revenue.toFixed(0)})`).join(', ')}
`
      : '';

    const systemInstruction = `Você é um consultor de negócios especializado em restaurantes e food service, integrado ao ERP da empresa.
Responda de forma objetiva, prática e em português brasileiro.
Use dados reais do negócio quando disponíveis. Foque em insights acionáveis.
${contextBlock}`;

    // Get or create conversation
    let conv = conversationId
      ? await this.prisma.aiConversation.findFirst({ where: { id: conversationId, companyId } })
      : null;

    if (!conv) {
      conv = await this.prisma.aiConversation.create({
        data: { companyId, userId, title: question.slice(0, 60) },
      });
    }

    // Load history
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
    const tokensUsed = (usage?.promptTokenCount ?? 0) + (usage?.candidatesTokenCount ?? 0);

    await this.prisma.aiMessage.createMany({
      data: [
        { conversationId: conv.id, role: 'USER', content: question },
        { conversationId: conv.id, role: 'ASSISTANT', content: answer, tokensUsed },
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

  /** Public streaming endpoint — no auth, no DB persistence, FoodSaaS commercial demo */
  async streamPlatformDemo(messages: DemoMessage[], res: any): Promise<void> {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      res.write(
        `data: ${JSON.stringify({ text: "Olá! 👋 Sou a Luna, consultora da Ruffinu's FoodSaaS ERP. A chave de API precisa ser configurada para ativar o chat completo." })}\n\n`,
      );
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      return;
    }

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
          max_tokens: 700,
          stream: true,
          system: PLATFORM_DEMO_SYSTEM_PROMPT,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok || !response.body) {
        const errBody = await response.text().catch(() => 'unknown');
        // DIAG — remover após identificar o erro
        this.logger.error(`[DIAG] Anthropic platform-demo status=${response.status} statusText="${response.statusText}" body=${errBody}`);
        res.write(`data: ${JSON.stringify({ text: 'Desculpe, tive um probleminha. Tente novamente em instantes! 🙏' })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        return;
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
              res.write(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`);
            }
          } catch {
            /* skip malformed SSE line */
          }
        }
      }
    } catch (err) {
      this.logger.error(`Platform demo stream error: ${err}`);
      res.write(`data: ${JSON.stringify({ text: 'Erro de conexão. Tenta de novo!' })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  }
}
