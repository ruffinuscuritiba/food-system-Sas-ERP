import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
}
