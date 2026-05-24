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

  /** Standard non-streaming endpoint (fallback) */
  async sendMessage(
    companyId: string,
    messages: ChatMessage[],
    sessionId?: string,
  ): Promise<string> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    const context = await this.buildContext(companyId);

    if (!apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY not configured — returning mock response.');
      return `Oi! Sou a Bia, atendente virtual do ${context.companyName} 😊 Para ativar o chat com IA real, configure a chave ANTHROPIC_API_KEY no painel do sistema.`;
    }

    const systemPrompt = this.buildSystemPrompt(context);

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
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        this.logger.error(`Anthropic API error: ${err}`);
        return 'Desculpe, tive um probleminha agora. Pode tentar de novo? 🙏';
      }

      const data: any = await response.json();
      const reply = data.content?.[0]?.text || 'Não entendi muito bem. Pode reformular?';

      if (sessionId) {
        this.persistMessages(companyId, sessionId, messages, reply).catch(() => {});
      }

      return reply;
    } catch (err) {
      this.logger.error(`Chat error: ${err}`);
      return 'Erro de conexão. Tente novamente em instantes!';
    }
  }

  /** SSE streaming — writes chunks directly to the Express response */
  async streamMessage(
    companyId: string,
    messages: ChatMessage[],
    sessionId: string | undefined,
    res: any,
  ): Promise<void> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    const context = await this.buildContext(companyId);

    if (!apiKey) {
      res.write(
        `data: ${JSON.stringify({ text: `Oi! Sou a Bia, atendente virtual do ${context.companyName} 😊 Para ativar o chat com IA, configure ANTHROPIC_API_KEY no painel.` })}\n\n`,
      );
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      return;
    }

    const systemPrompt = this.buildSystemPrompt(context);

    let fullContent = '';

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
          stream: true,
          system: systemPrompt,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok || !response.body) {
        const err = await response.text().catch(() => 'unknown');
        this.logger.error(`Anthropic stream error: ${err}`);
        res.write(`data: ${JSON.stringify({ text: 'Tive um probleminha agora. Tenta de novo? 🙏' })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        return;
      }

      const reader = (response.body as any).getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
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
              fullContent += parsed.delta.text;
              res.write(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`);
            }
          } catch {
            /* skip malformed */
          }
        }
      }
    } catch (err) {
      this.logger.error(`Stream error: ${err}`);
      res.write(`data: ${JSON.stringify({ text: 'Erro de conexão. Tenta de novo!' })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);

    // Persist session asynchronously (fire-and-forget)
    if (sessionId && fullContent) {
      this.persistMessages(companyId, sessionId, messages, fullContent).catch(() => {});
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private buildSystemPrompt(context: { companyName: string; menuText: string }): string {
    return `Você é a Bia, atendente virtual do restaurante "${context.companyName}". Você ama comida de verdade e conhece cada detalhe do cardápio. Seu jeito de atender é caloroso, natural e descontraído — como uma atendente real que gosta do que faz.

COMO VOCÊ SE COMUNICA:
- Fale em português brasileiro do dia a dia, sem ser formal demais. Use "tá", "né", "ótima escolha", "com certeza" quando fizer sentido.
- Varie o começo das frases. Nunca comece duas respostas seguidas do mesmo jeito.
- Use emojis com moderação e naturalidade — só quando combinar com o tom, não em toda frase.
- Adapte o tamanho da resposta: perguntas simples merecem respostas curtas; quando o cliente quer recomendações, seja mais descritivo e entusiasmado.
- Se o cliente estiver na dúvida entre produtos, ajude a decidir com base no perfil dele (família, romântico, rápido, etc.).
- Demonstre conhecimento e carinho pelo cardápio — não liste produtos como uma planilha. Descreva com apetite.
- Quando não souber algo (endereço, horário exato, tempo de entrega), seja honesto com leveza: "Essa info eu não tenho aqui, mas você pode falar direto com a gente 😊"
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
        take: 80,
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

  private async persistMessages(
    companyId: string,
    sessionId: string,
    messages: ChatMessage[],
    assistantReply: string,
  ): Promise<void> {
    // Upsert session
    await this.prisma.chatSession.upsert({
      where: { id: sessionId },
      update: { updatedAt: new Date() },
      create: { id: sessionId, companyId },
    });

    // Save last user message + new assistant reply
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser) {
      await this.prisma.chatMessage.createMany({
        data: [
          { sessionId, role: 'user', content: lastUser.content },
          { sessionId, role: 'assistant', content: assistantReply },
        ],
      });
    }
  }
}
