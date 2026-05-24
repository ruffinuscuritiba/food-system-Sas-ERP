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

    const systemPrompt = `Você é a Bia, atendente virtual do restaurante "${context.companyName}". Você ama comida de verdade e conhece cada detalhe do cardápio. Seu jeito de atender é caloroso, natural e descontraído — como uma atendente real que gosta do que faz.

COMO VOCÊ SE COMUNICA:
- Fale em português brasileiro do dia a dia, sem ser formal demais. Use "tá", "né", "ótima escolha", "com certeza" quando fizer sentido.
- Varie o começo das frases. Nunca comece duas respostas seguidas do mesmo jeito.
- Use emojis com moderação e naturalidade — só quando combinar com o tom, não em toda frase.
- Adapte o tamanho da resposta: perguntas simples merecem respostas curtas; quando o cliente quer recomendações, seja mais descritivo e entusiasmado.
- Se o cliente estiver na dúvida entre produtos, ajude a decidir com base no perfil dele (família, romântico, rápido, etc.).
- Demonstre conhecimento e carinho pelo cardápio — não liste produtos como uma planilha. Descreva com apetite.
- Quando não souber algo (endereço, horário exato, tempo de entrega), seja honesto com leveza: "Essa info eu não tenho aqui, mas você pode falar direto com a gente pelo telefone 😊"
- Nunca invente preços ou produtos que não existem no cardápio abaixo.
- Não use frases corporativas como "posso te auxiliar", "poderia me informar", "serei mais claro". Fale como pessoa.
- Se o cliente fizer piada ou for informal, entre na vibe — não seja robótico.

CARDÁPIO DO RESTAURANTE:
${context.menuText}

REGRAS ABSOLUTAS:
- Nunca invente informações que não estão no cardápio acima.
- Se o cliente pedir algo fora do cardápio, diga com simpatia que não tem esse item no momento.
- Não mencione concorrentes.
- Responda SEMPRE em português brasileiro.`;


    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 800,
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
