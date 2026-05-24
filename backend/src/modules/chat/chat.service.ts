import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/database/prisma.service';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async sendMessage(
    companyId: string,
    messages: ChatMessage[],
  ): Promise<string> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');

    // Build restaurant context
    const context = await this.buildContext(companyId);

    if (!apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY not configured — returning mock response.');
      return `Olá! Sou o assistente virtual de ${context.companyName}. Para ativar o chat com IA, configure a chave ANTHROPIC_API_KEY no painel do sistema.`;
    }

    const systemPrompt = `Você é um assistente virtual simpático e prestativo do restaurante "${context.companyName}".
Seu objetivo é ajudar os clientes com dúvidas sobre o cardápio, preços, horários e pedidos.

CARDÁPIO DISPONÍVEL:
${context.menuText}

INSTRUÇÕES:
- Responda sempre em português brasileiro
- Seja amigável, conciso e útil
- Se não souber algo específico (horários, endereço), diga que não tem essa informação e sugira ligar ao restaurante
- Não invente preços ou produtos que não estão no cardápio acima
- Máximo de 2-3 parágrafos por resposta`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 512,
          system: systemPrompt,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        this.logger.error(`Anthropic API error: ${err}`);
        return 'Desculpe, não consigo responder agora. Tente novamente em instantes.';
      }

      const data: any = await response.json();
      return data.content?.[0]?.text || 'Não entendi. Pode reformular sua pergunta?';
    } catch (err) {
      this.logger.error(`Chat error: ${err}`);
      return 'Erro ao processar sua mensagem. Tente novamente.';
    }
  }

  private async buildContext(companyId: string): Promise<{
    companyName: string;
    menuText: string;
  }> {
    const [company, products] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: companyId } }),
      this.prisma.product.findMany({
        where: { companyId, isActive: true, deletedAt: null },
        include: { category: true },
        orderBy: { name: 'asc' },
        take: 80, // limit context size
      }),
    ]);

    const companyName = company?.name || 'nosso restaurante';

    const grouped: Record<string, string[]> = {};
    for (const p of products) {
      const cat = p.category?.name || 'Outros';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(
        `  - ${p.name}${p.description ? ` (${p.description.slice(0, 60)})` : ''}: R$ ${Number(p.salePrice).toFixed(2)}`,
      );
    }

    const menuText = Object.entries(grouped)
      .map(([cat, items]) => `${cat}:\n${items.join('\n')}`)
      .join('\n\n');

    return { companyName, menuText: menuText || 'Cardápio não disponível.' };
  }
}
