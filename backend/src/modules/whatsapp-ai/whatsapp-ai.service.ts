import { Injectable, NotFoundException, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService }    from '@/database/prisma.service';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { UpdateSettingsDto }   from './dto/update-settings.dto';
import { WhisperService }   from './services/whisper.service';
import { ClaudeCartService, CartStatus, StructuredResponse } from './services/claude-cart.service';
import { WaPaymentService } from './services/wa-payment.service';
import { OrdersService }    from '@/modules/orders/orders.service';
import { OrderStatus }      from '@prisma/client';

const log = new Logger('WhatsappAiService');
const PIX_EXPIRATION_MINUTES = 30;

// ─── AI Chat helper (text-only, sem imagem) ──────────────────────────────────

async function geminiChat(
  model: string,
  systemPrompt: string,
  messages: { role: 'user' | 'model'; text: string }[],
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    generationConfig: { temperature: 0.75, maxOutputTokens: 1024 },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as any;
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function anthropicChat(
  model: string,
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; text: string }[],
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.text })),
      max_tokens: 1024,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as any;
  return data?.content?.[0]?.text ?? '';
}

// ─── WhatsApp sender helpers ──────────────────────────────────────────────────

async function sendEvolution(apiUrl: string, instanceName: string, token: string, phone: string, text: string) {
  const url = `${apiUrl.replace(/\/$/, '')}/message/sendText/${instanceName}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: token },
    body: JSON.stringify({ number: phone, text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) log.warn(`Evolution send failed: ${res.status}`);
}

async function sendCloudApi(phoneNumberId: string, token: string, phone: string, text: string) {
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body: text },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) log.warn(`Cloud API send failed: ${res.status}`);
}

// ─── Payment method normalizer ───────────────────────────────────────────────

function normalizePaymentMethod(raw: string | null | undefined): 'pix' | 'credit_card' | 'debit_card' | null {
  if (!raw) return null;
  if (raw === 'pix' || raw === 'credit_card' || raw === 'debit_card') return raw;
  const s = raw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (s.includes('pix')) return 'pix';
  if (s.includes('debito') || s.includes('debit')) return 'debit_card';
  // cartão de crédito, cartao, credito, credit, card → credit_card (default card)
  if (s.includes('credito') || s.includes('credit') || s.includes('cartao') || s.includes('card')) return 'credit_card';
  return null;
}

// ─── Command parser ──────────────────────────────────────────────────────────

interface ParsedCommands {
  cleanText: string;
  addItems:  { productId: string; qty: number }[];
  confirmOrder: { deliveryType: string; address: string; phone: string } | null;
  transferHuman: boolean;
  closeConversation: boolean;
}

function parseCommands(raw: string): ParsedCommands {
  const addItems: { productId: string; qty: number }[] = [];
  let confirmOrder: ParsedCommands['confirmOrder'] = null;
  let transferHuman = false;
  let closeConversation = false;

  // Extract [CMD:...] blocks
  const cmdRegex = /\[CMD:([^\]]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = cmdRegex.exec(raw)) !== null) {
    const parts = match[1].split(':');
    const type = parts[0];
    if (type === 'ADD_ITEM' && parts[1]) {
      addItems.push({ productId: parts[1], qty: parseInt(parts[2] || '1', 10) });
    } else if (type === 'CONFIRM_ORDER') {
      confirmOrder = { deliveryType: parts[1] || 'DELIVERY', address: parts[2] || '', phone: parts[3] || '' };
    } else if (type === 'TRANSFER_HUMAN') {
      transferHuman = true;
    } else if (type === 'CLOSE') {
      closeConversation = true;
    }
  }

  const cleanText = raw.replace(cmdRegex, '').replace(/\n{3,}/g, '\n\n').trim();
  return { cleanText, addItems, confirmOrder, transferHuman, closeConversation };
}

// ─── Business hours check ────────────────────────────────────────────────────

function isBusinessHours(settings: any): boolean {
  // Use Brazil timezone (handles DST automatically, unlike a fixed UTC-3 offset)
  const now = new Date();
  const brFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    hour:    '2-digit',
    minute:  '2-digit',
    hour12:  false,
  });
  const parts = brFormatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';

  const dayName = get('weekday'); // 'dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'
  const DAY_MAP: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sáb: 6, sab: 6 };
  const day = DAY_MAP[dayName.toLowerCase()] ?? now.getDay();

  const days = (settings.businessDays || '1,2,3,4,5,6').split(',').map(Number);
  if (!days.includes(day)) return false;

  const brHour   = parseInt(get('hour'),   10);
  const brMinute = parseInt(get('minute'), 10);
  const cur = brHour * 60 + brMinute;

  const [sh, sm] = (settings.businessHoursStart || '08:00').split(':').map(Number);
  const [eh, em] = (settings.businessHoursEnd   || '22:00').split(':').map(Number);
  return cur >= sh * 60 + sm && cur <= eh * 60 + em;
}

// ─── Menu RAG builder ────────────────────────────────────────────────────────

function buildMenuContext(products: any[], categories: any[]): string {
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const sections: string[] = [];
  const grouped = new Map<string, any[]>();

  for (const p of products) {
    if (!p.isActive) continue;
    const cat = catMap.get(p.categoryId ?? '') ?? 'Outros';
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(p);
  }

  for (const [cat, prods] of grouped) {
    const lines = prods.map((p) => {
      const price = p.sizes?.length
        ? p.sizes.map((s: any) => `${s.size} R$${Number(s.price).toFixed(2)}`).join(' | ')
        : `R$${Number(p.salePrice ?? 0).toFixed(2)}`;
      return `  - [ID:${p.id}] ${p.name}${p.description ? ` (${p.description.slice(0, 60)})` : ''} — ${price}`;
    });
    sections.push(`**${cat}**\n${lines.join('\n')}`);
  }

  return sections.join('\n\n');
}

// ─── System prompt builder ────────────────────────────────────────────────────

function buildSystemPrompt(
  settings: any,
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

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class WhatsappAiService {
  constructor(
    private prisma:       PrismaService,
    private whisper:      WhisperService,
    private claudeCart:   ClaudeCartService,
    private waPayment:    WaPaymentService,
    @Inject(forwardRef(() => OrdersService))
    private ordersService?: OrdersService,
  ) {}

  // ── CONNECTIONS ────────────────────────────────────────────────────────────

  findConnections(companyId: string) {
    return this.prisma.whatsappConnection.findMany({
      where: { companyId },
      include: { settings: true, _count: { select: { conversations: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createConnection(companyId: string, dto: CreateConnectionDto) {
    return this.prisma.whatsappConnection.create({
      data: { ...dto, companyId, provider: dto.provider ?? 'EVOLUTION' },
    });
  }

  async updateConnection(id: string, companyId: string, dto: Partial<CreateConnectionDto>) {
    await this.assertConnectionOwnership(id, companyId);
    return this.prisma.whatsappConnection.update({ where: { id }, data: dto });
  }

  async deleteConnection(id: string, companyId: string) {
    await this.assertConnectionOwnership(id, companyId);
    return this.prisma.whatsappConnection.delete({ where: { id } });
  }

  // ── SETTINGS ───────────────────────────────────────────────────────────────

  async getSettings(connectionId: string, companyId: string) {
    await this.assertConnectionOwnership(connectionId, companyId);
    const settings = await this.prisma.whatsappAiSettings.findUnique({
      where: { connectionId },
    });
    return settings;
  }

  async upsertSettings(connectionId: string, companyId: string, dto: UpdateSettingsDto) {
    await this.assertConnectionOwnership(connectionId, companyId);
    return this.prisma.whatsappAiSettings.upsert({
      where: { connectionId },
      create: { ...dto, connectionId, companyId },
      update: dto,
    });
  }

  // ── CONVERSATIONS ──────────────────────────────────────────────────────────

  findConversations(companyId: string, connectionId?: string) {
    return this.prisma.whatsappConversation.findMany({
      where: { companyId, ...(connectionId ? { connectionId } : {}) },
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
      include: {
        _count: { select: { messages: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  findMessages(conversationId: string, companyId: string) {
    return this.prisma.whatsappMessage.findMany({
      where: { conversationId, companyId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async setConversationMode(id: string, companyId: string, mode: string) {
    const conv = await this.prisma.whatsappConversation.findFirst({
      where: { id, companyId },
    });
    if (!conv) throw new NotFoundException('Conversa não encontrada');
    return this.prisma.whatsappConversation.update({
      where: { id },
      data: { mode },
    });
  }

  /** Send a message manually as the operator (human mode) */
  async sendManualMessage(id: string, companyId: string, text: string) {
    const conv = await this.prisma.whatsappConversation.findFirst({
      where: { id, companyId },
      include: { connection: true },
    });
    if (!conv) throw new NotFoundException('Conversa não encontrada');

    await this.saveMessage(id, companyId, 'ASSISTANT', text);
    await this.dispatchMessage(conv.connection, conv.customerPhone, text);
    return { ok: true };
  }

  // ── STATS ──────────────────────────────────────────────────────────────────

  async getStats(companyId: string) {
    const [totalConversations, activeConversations, humanConversations, totalMessages, ordersCreated] =
      await Promise.all([
        this.prisma.whatsappConversation.count({ where: { companyId } }),
        this.prisma.whatsappConversation.count({ where: { companyId, status: 'ACTIVE' } }),
        this.prisma.whatsappConversation.count({ where: { companyId, mode: 'HUMAN' } }),
        this.prisma.whatsappMessage.count({ where: { companyId } }),
        this.prisma.whatsappConversation.count({
          where: { companyId, orderId: { not: null } },
        }),
      ]);

    return { totalConversations, activeConversations, humanConversations, totalMessages, ordersCreated };
  }

  // ── WEBHOOK HANDLER ────────────────────────────────────────────────────────

  /** Evolution API webhook — POST /whatsapp-ai/webhook/:connectionId */
  async handleEvolutionWebhook(connectionId: string, body: any) {
    const event: string = body?.event ?? '';
    // Normalize: Evolution v1 "messages.upsert", v2 "MESSAGES_UPSERT" → same token
    const normalizedEvent = event.toLowerCase().replace(/[_-]/g, '.');
    if (!['messages.upsert', 'message', 'messages.set'].includes(normalizedEvent)) {
      log.log(`[WH] ignored event="${event}" normalised="${normalizedEvent}" connectionId=${connectionId}`);
      return { ok: true };
    }

    const data = body?.data;
    if (!data) return { ok: true };

    // Evolution API v2 wraps messages in array; v1 has direct key/message on data root.
    // Support both to avoid silent drops when the instance is on v2.
    const msgData = Array.isArray(data?.messages) && data.messages.length > 0
      ? data.messages[0]
      : data;

    const fromMe: boolean = msgData?.key?.fromMe ?? false;
    if (fromMe) return { ok: true }; // ignore own messages

    const rawPhone: string = msgData?.key?.remoteJid ?? '';
    const phone = rawPhone.replace('@s.whatsapp.net', '').replace('@c.us', '').replace('@g.us', '');
    const name: string = msgData?.pushName ?? msgData?.key?.remoteJid ?? phone;

    let text: string =
      msgData?.message?.conversation ??
      msgData?.message?.extendedTextMessage?.text ??
      msgData?.message?.imageMessage?.caption ??
      msgData?.message?.buttonsResponseMessage?.selectedDisplayText ??
      '';

    // ── Suporte a áudio (PTT e audioMessage) via Whisper ──────────────────
    const audioMsg = msgData?.message?.audioMessage ?? msgData?.message?.pttMessage;
    if (!text.trim() && audioMsg?.url) {
      try {
        const connection = await this.prisma.whatsappConnection.findUnique({
          where: { id: connectionId },
        });
        const headers: Record<string, string> = connection?.apiToken ? { apikey: String(connection.apiToken) } : {};
        const transcript = await this.whisper.transcribeFromUrl(
          audioMsg.url,
          audioMsg.mimetype ?? 'audio/ogg',
          headers,
        );
        if (transcript) text = `[Áudio] ${transcript}`;
      } catch (err: any) {
        log.warn(`Evolution audio transcription failed: ${err?.message}`);
      }
    }

    // Skip group messages (@g.us), status updates, and non-text types
    if (rawPhone.includes('@g.us') || rawPhone.includes('@broadcast')) return { ok: true };

    if (!phone || !text.trim()) {
      log.debug(`[WH] skipped — empty phone/text. event=${event} phone="${rawPhone}" msgType=${JSON.stringify(Object.keys(msgData?.message ?? {}))}`);
      return { ok: true };
    }

    await this.processIncoming(connectionId, phone, name, text.trim());
    return { ok: true };
  }

  /** Cloud API (Meta) webhook — POST /whatsapp-ai/webhook/:connectionId */
  async handleCloudApiWebhook(connectionId: string, body: any) {
    const entries = body?.entry ?? [];
    for (const entry of entries) {
      for (const change of entry?.changes ?? []) {
        const msgs     = change?.value?.messages ?? [];
        const contacts = change?.value?.contacts ?? [];
        for (const msg of msgs) {
          const phone: string = msg.from ?? '';
          const name: string  = contacts.find((c: any) => c.wa_id === phone)?.profile?.name ?? phone;
          if (!phone) continue;

          let text = '';

          if (msg.type === 'text') {
            text = msg?.text?.body ?? '';
          } else if (msg.type === 'audio') {
            // ── Suporte a áudio via Whisper ────────────────────────────────
            try {
              const connection = await this.prisma.whatsappConnection.findUnique({
                where: { id: connectionId },
              });
              const token = connection?.apiToken ?? '';
              if (token && msg.audio?.id) {
                const mediaUrl = await this.whisper.fetchMetaMediaUrl(msg.audio.id, token);
                if (mediaUrl) {
                  const transcript = await this.whisper.transcribeFromUrl(
                    mediaUrl,
                    msg.audio?.mime_type ?? 'audio/ogg',
                    { Authorization: `Bearer ${token}` },
                  );
                  if (transcript) text = `[Áudio] ${transcript}`;
                }
              }
            } catch (err: any) {
              log.warn(`Cloud API audio transcription failed: ${err?.message}`);
            }
          }

          if (!text.trim()) continue;
          await this.processIncoming(connectionId, phone, name, text.trim());
        }
      }
    }
    return { ok: true };
  }

  // ── CORE PROCESSING ────────────────────────────────────────────────────────

  private async processIncoming(connectionId: string, phone: string, name: string, text: string) {
    const connection = await this.prisma.whatsappConnection.findUnique({
      where: { id: connectionId },
      include: { settings: true },
    });
    if (!connection) {
      log.warn(`[AI] connectionId=${connectionId} não encontrado — webhook ignorado`);
      return;
    }
    if (!connection.isActive) {
      log.warn(`[AI] connection=${connectionId} isActive=false — AI desativada`);
      return;
    }

    const settings = connection.settings;

    // Get or create conversation
    const conv = await this.getOrCreateConversation(connection, phone, name);

    // Save user message
    await this.saveMessage(conv.id, connection.companyId, 'USER', text);
    await this.prisma.whatsappConversation.update({
      where: { id: conv.id },
      data: { lastMessageAt: new Date(), customerName: name },
    });

    // If mode is HUMAN or PAUSED, auto-reset to AI after 60 min of operator inactivity
    if (conv.mode === 'HUMAN' || conv.mode === 'PAUSED') {
      const AUTO_RESET_MIN = 60;
      const lastAssistantMsg = await this.prisma.whatsappMessage.findFirst({
        where: { conversationId: conv.id, role: 'ASSISTANT' },
        orderBy: { createdAt: 'desc' },
      });
      const minutesSinceOperator = lastAssistantMsg
        ? (Date.now() - lastAssistantMsg.createdAt.getTime()) / 60_000
        : Infinity;

      if (minutesSinceOperator > AUTO_RESET_MIN) {
        await this.prisma.whatsappConversation.update({
          where: { id: conv.id },
          data: { mode: 'AI' },
        });
        log.warn(`[AI] conv=${conv.id} phone=${phone} — auto-reset HUMAN→AI (operador inativo há ${Math.round(minutesSinceOperator)}min)`);
        // Continue — IA assume o atendimento
      } else {
        log.warn(`[AI] conv=${conv.id} phone=${phone} mode=${conv.mode} — operador assumiu há ${Math.round(minutesSinceOperator)}min, aguardando`);
        return;
      }
    }
    if (!settings) {
      log.warn(`[AI] connection=${connectionId} sem WhatsappAiSettings — AI não configurada para esta conexão`);
      return;
    }
    if (!settings.isActive) {
      log.warn(`[AI] connection=${connectionId} settings.isActive=false — AI inativa`);
      return;
    }
    if (settings.mode === 'MANUAL') {
      log.warn(`[AI] connection=${connectionId} mode=MANUAL — sem resposta automática (configure para AUTO ou HYBRID)`);
      return;
    }

    // Check business hours
    if (!isBusinessHours(settings)) {
      const msg = settings.offlineMessage || 'Olá! No momento estamos fora do horário de atendimento. Em breve retornaremos! 🕐';
      await this.saveMessage(conv.id, connection.companyId, 'ASSISTANT', msg);
      await this.dispatchMessage(connection, phone, msg);
      return;
    }

    // Check transfer keywords
    if (settings.transferKeywords) {
      const kws = settings.transferKeywords.split(',').map((k: string) => k.trim().toLowerCase());
      if (kws.some((kw: string) => text.toLowerCase().includes(kw))) {
        await this.prisma.whatsappConversation.update({
          where: { id: conv.id },
          data: { mode: 'HUMAN', status: 'TRANSFERRED' },
        });
        const msg = '👤 Você foi transferido para um atendente humano. Aguarde um momento...';
        await this.saveMessage(conv.id, connection.companyId, 'ASSISTANT', msg);
        await this.dispatchMessage(connection, phone, msg);
        return;
      }
    }

    try {
      await this.runAiResponse(connection, settings, conv, text);
    } catch (err: any) {
      log.error(`AI error for conv ${conv.id}: ${err?.message}`);
      const fallback = 'Desculpe, tive um problema temporário. Pode repetir sua mensagem?';
      await this.saveMessage(conv.id, connection.companyId, 'ASSISTANT', fallback);
      await this.dispatchMessage(connection, phone, fallback);
    }
  }

  private async runAiResponse(connection: any, settings: any, conv: any, userText: string) {
    const companyId = connection.companyId;

    // Fetch menu context
    const [products, categories] = await Promise.all([
      this.prisma.product.findMany({
        where: { companyId, isActive: true, deletedAt: null },
        include: { sizes: true, category: { select: { name: true } } },
      }),
      this.prisma.category.findMany({ where: { companyId } }),
    ]);

    const menuCtx = buildMenuContext(products, categories);

    // Build cart summary from context
    const ctx: any = conv.context ?? {};
    const cart: any[] = ctx.cart ?? [];
    const cartCtx = cart.length
      ? cart.map((i: any) => `${i.name} x${i.qty} — R$${(i.price * i.qty).toFixed(2)}`).join('\n')
      : '';

    // Get company name
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
    const companyName = company?.name ?? 'nossa loja';

    const systemPrompt = buildSystemPrompt(settings, companyName, menuCtx, cartCtx);

    // Build conversation history (last 20 messages)
    const history = await this.prisma.whatsappMessage.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    history.reverse();

    const aiMessages = history
      .filter((m: any) => m.role !== 'SYSTEM')
      .map((m: any) => ({
        role: m.role === 'USER' ? 'user' : 'model',
        text: m.content,
      }));

    // If no previous AI message and we have a greeting, prepend it
    const hasGreeting = aiMessages.some((m: any) => m.role === 'model');
    if (!hasGreeting && settings.greetingMessage) {
      aiMessages.unshift({ role: 'model', text: settings.greetingMessage });
    }

    // Modo CLAUDE → resposta JSON estruturada (ClaudeCartService)
    const aiProvider = settings.aiProvider ?? 'GEMINI';
    if (aiProvider === 'CLAUDE') {
      await this.runClaudeStructuredResponse(connection, settings, conv, userText, products, categories);
      return;
    }

    // Call AI provider with fake typing simulation (delay before sending)
    let rawResponse = '';
    const aiModel = settings.aiModel ?? 'gemini-1.5-flash';

    if (aiProvider === 'ANTHROPIC') {
      const anthropicMsgs = aiMessages.map((m: any) => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        text: m.text,
      }));
      rawResponse = await anthropicChat(aiModel, systemPrompt, anthropicMsgs as any);
    } else {
      rawResponse = await geminiChat(aiModel, systemPrompt, aiMessages as any);
    }

    if (!rawResponse) {
      log.warn(`[AI] conv=${conv.id} provider=${aiProvider} model=${aiModel} — resposta vazia (possível filtro de segurança, quota excedida ou candidates:[])`);
      const emptyFallback = 'Desculpe, não consegui processar sua mensagem agora. Pode tentar de novo em instantes? 🙏';
      await this.saveMessage(conv.id, companyId, 'ASSISTANT', emptyFallback);
      await this.dispatchMessage(connection, conv.customerPhone, emptyFallback);
      return;
    }

    // Parse commands embedded in response
    const { cleanText, addItems, confirmOrder, transferHuman, closeConversation } =
      parseCommands(rawResponse);

    // Process ADD_ITEM commands — update cart in context
    if (addItems.length > 0) {
      const productMap = new Map(products.map((p) => [p.id, p]));
      const updatedCart = [...cart];
      for (const cmd of addItems) {
        const prod = productMap.get(cmd.productId);
        if (!prod) continue;
        const existing = updatedCart.find((i) => i.productId === cmd.productId);
        if (existing) {
          existing.qty += cmd.qty;
        } else {
          updatedCart.push({
            productId: cmd.productId,
            name: prod.name,
            price: Number(prod.salePrice ?? 0),
            qty: cmd.qty,
          });
        }
      }
      ctx.cart = updatedCart;
      await this.prisma.whatsappConversation.update({
        where: { id: conv.id },
        data: { context: ctx },
      });
    }

    // Process CONFIRM_ORDER
    if (confirmOrder && cart.length > 0) {
      try {
        const orderId = await this.createOrderFromCart(
          companyId,
          cart,
          confirmOrder,
          conv.customerPhone,
          undefined,                        // formaPagamento — não disponível no modo cmd
          conv.customerName  ?? undefined,
          ctx.bairro         ?? undefined,  // bairro do contexto (pode ter sido coletado antes)
        );
        await this.prisma.whatsappConversation.update({
          where: { id: conv.id },
          data: { orderId, status: 'CLOSED', context: { ...ctx, cart: [] } },
        });
      } catch (err: any) {
        log.warn(`Order creation failed: ${err?.message}`);
      }
    }

    // Process TRANSFER_HUMAN
    if (transferHuman) {
      await this.prisma.whatsappConversation.update({
        where: { id: conv.id },
        data: { mode: 'HUMAN', status: 'TRANSFERRED' },
      });
    }

    // Process CLOSE
    if (closeConversation) {
      await this.prisma.whatsappConversation.update({
        where: { id: conv.id },
        data: { status: 'CLOSED' },
      });
    }

    // Save + send response (with optional fake delay)
    if (cleanText) {
      await this.saveMessage(conv.id, companyId, 'ASSISTANT', cleanText);

      const delay = settings.typingDelay ?? 0;
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));

      await this.dispatchMessage(connection, conv.customerPhone, cleanText);
    }
  }

  // ── CLAUDE STRUCTURED MODE ────────────────────────────────────────────────

  /**
   * Motor de IA com resposta estruturada JSON.
   * Usa ClaudeCartService (claude-sonnet-4-6) para gerar:
   *   { resposta_para_o_cliente, status_carrinho }
   *
   * O backend lê o JSON, atualiza WhatsappConversation.context.cart,
   * cria o Order quando finalizado=true e envia resposta_para_o_cliente
   * de volta para o WhatsApp do cliente.
   */
  private async runClaudeStructuredResponse(
    connection: any,
    settings:   any,
    conv:       any,
    userText:   string,
    products:   any[],
    categories: any[],
  ) {
    const companyId = connection.companyId;

    // Reconstruir contexto do carrinho atual
    const ctx: any   = conv.context ?? {};
    const currentCart: CartStatus = {
      itens:               ctx.cart               ?? [],
      itens_identificados: ctx.itens_identificados ?? [],
      etapa_atual:         ctx.etapa_atual         ?? 'saudacao',
      pedido_finalizado:   ctx.pedido_finalizado   ?? false,
      endereco:            ctx.endereco            ?? null,
      bairro:              ctx.bairro              ?? null,
      telefone:            ctx.telefone            ?? null,
      formaPagamento:      ctx.formaPagamento      ?? null,
    };

    // Histórico de conversa (últimas 20 mensagens) para Claude
    const historyRaw = await this.prisma.whatsappMessage.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    historyRaw.reverse();

    const conversationHistory: { role: 'user' | 'assistant'; content: string }[] = historyRaw
      .filter((m: any) => m.role !== 'SYSTEM')
      .map((m: any) => ({
        role:    m.role === 'USER' ? 'user' : 'assistant',
        content: m.content,
      }));

    // Cardápio, empresa e contexto operacional completo
    const menuCtx     = buildMenuContext(products, categories);
    const company     = await this.prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
    const companyName = company?.name ?? 'nossa loja';
    const attendantName = settings.attendantName ?? 'Atendente';

    // Zonas de entrega
    let deliveryContext = '';
    try {
      const zones = await this.prisma.deliveryZone.findMany({ where: { companyId } });
      if (zones.length) {
        const lines = zones.map((z: any) => {
          const fee = Number(z.clientFee ?? 0).toFixed(2);
          return `  • ${z.neighborhood ?? z.name ?? z.type}: taxa R$${fee}`;
        });
        deliveryContext = `Áreas de entrega disponíveis:\n${lines.join('\n')}`;
      }
    } catch {}

    // Bordas de pizza
    let pizzaBordersContext = '';
    try {
      const borders = await (this.prisma as any).pizzaBorder.findMany({
        where: { companyId },
        include: { sizes: true },
      });
      if (borders?.length) {
        const lines = (borders as any[]).map((b: any) => {
          const prices = (b.sizes ?? [])
            .map((s: any) => `${s.size} R$${Number(s.price).toFixed(2)}`)
            .join(' | ');
          return `  • ${b.name}${prices ? ': ' + prices : ''}`;
        });
        pizzaBordersContext = `Bordas recheadas disponíveis:\n${lines.join('\n')}`;
      }
    } catch {}

    // Informações de horário e pagamento para contexto
    const businessHoursInfo = `Horário de atendimento: ${settings.businessHoursStart ?? '08:00'} às ${settings.businessHoursEnd ?? '22:00'} (horário de Brasília). Dias: ${settings.businessDays ?? '1,2,3,4,5,6'}.`;
    const paymentInfo = 'Formas de pagamento aceitas: PIX (pagamento automático via link), Cartão de Crédito (link seguro), Cartão de Débito (link seguro).';

    // Chamar Claude com resposta estruturada + contexto operacional completo
    let structured: StructuredResponse;
    try {
      structured = await this.claudeCart.chat({
        companyName,
        attendantName,
        menuContext: menuCtx,
        currentCart,
        conversationHistory,
        deliveryContext,
        pizzaBordersContext,
        businessHoursInfo,
        paymentInfo,
      });
    } catch (err: any) {
      log.error(`ClaudeCartService error: ${err?.message}`);
      const fallback = 'Desculpe, tive um problema temporário. Pode repetir sua mensagem? 🙏';
      await this.saveMessage(conv.id, companyId, 'ASSISTANT', fallback);
      await this.dispatchMessage(connection, conv.customerPhone, fallback);
      return;
    }

    const { resposta_para_o_cliente, status_carrinho } = structured;

    // ── Processar status_carrinho ────────────────────────────────────────────

    // 1. Atualizar contexto no banco
    const newCtx = {
      ...ctx,
      cart:               status_carrinho.itens,
      itens_identificados: status_carrinho.itens_identificados,
      etapa_atual:         status_carrinho.etapa_atual,
      pedido_finalizado:   status_carrinho.pedido_finalizado,
      endereco:            status_carrinho.endereco      ?? ctx.endereco,
      bairro:              status_carrinho.bairro        ?? ctx.bairro,
      telefone:            status_carrinho.telefone      ?? ctx.telefone,
      formaPagamento:      status_carrinho.formaPagamento ?? ctx.formaPagamento,
    };
    await this.prisma.whatsappConversation.update({
      where: { id: conv.id },
      data:  { context: newCtx },
    });

    // 2. Criar pedido quando pedido_finalizado = true
    if (status_carrinho.pedido_finalizado && status_carrinho.itens.length > 0 && !ctx.pedido_finalizado) {
      try {
        const productMap = new Map(products.map((p) => [p.id, p]));
        const cartForOrder = status_carrinho.itens.map((i) => {
          const prod = productMap.get(i.productId);
          return {
            productId: i.productId,
            name:      prod?.name ?? i.nome,
            price:     prod ? Number(prod.salePrice ?? 0) : i.preco,
            qty:       i.quantidade,
          };
        });

        const orderId = await this.createOrderFromCart(
          companyId,
          cartForOrder,
          {
            deliveryType: status_carrinho.endereco  ? 'DELIVERY' : 'PICKUP',
            address:      status_carrinho.endereco ?? '',
            phone:        status_carrinho.telefone ?? conv.customerPhone,
          },
          conv.customerPhone,
          status_carrinho.formaPagamento ?? undefined,
          conv.customerName              ?? undefined,
          status_carrinho.bairro         ?? undefined,
        );

        await this.prisma.whatsappConversation.update({
          where: { id: conv.id },
          data:  { orderId, status: 'CLOSED' },
        });

        log.log(`WhatsApp pedido criado via Claude JSON: orderId=${orderId} conv=${conv.id}`);

        // 2b. Processar pagamento automático via Mercado Pago
        const solicitacao = (structured as any).solicitacao_pagamento;
        const rawMetodo: string | null = solicitacao?.requer_acao
          ? (solicitacao.metodo ?? status_carrinho.formaPagamento)
          : status_carrinho.formaPagamento;
        const metodo = normalizePaymentMethod(rawMetodo);

        if (metodo && orderId) {
          const orderTotal = cartForOrder.reduce((s, i) => s + i.price * i.qty, 0);
          const description = cartForOrder.map(i => `${i.qty}x ${i.name}`).join(', ');

          try {
            if (metodo === 'pix') {
              const pix = await this.waPayment.createPix({
                orderId,
                companyId,
                total:         orderTotal,
                customerPhone: conv.customerPhone,
                customerName:  conv.customerName ?? 'Cliente',
                description,
              });
              const pixMsg = pix.mock
                ? `Aqui está o seu Pix Copia e Cola:\n\`${pix.pixCopyPaste}\`\n\n⏱ Expira em ${PIX_EXPIRATION_MINUTES} minutos. Após o pagamento seu pedido será confirmado automaticamente!`
                : `Aqui está o seu Pix Copia e Cola 💸:\n\`${pix.pixCopyPaste}\`\n\n⏱ Expira em ${PIX_EXPIRATION_MINUTES} minutos. Assim que o pagamento for confirmado, já mandamos o status aqui!`;
              await this.saveMessage(conv.id, companyId, 'ASSISTANT', pixMsg);
              await this.dispatchMessage(connection, conv.customerPhone, pixMsg);

            } else if (metodo === 'credit_card' || metodo === 'debit_card') {
              const linkResult = await this.waPayment.createPaymentLink({
                orderId,
                companyId,
                total:        orderTotal,
                description,
                customerName: conv.customerName ?? 'Cliente',
              });
              const methodLabel = metodo === 'credit_card' ? 'Cartão de Crédito' : 'Cartão de Débito';
              const linkMsg = `Perfeito! Você pode realizar o pagamento com segurança através deste link oficial 🔒:\n\n${linkResult.paymentUrl}\n\nEssa é a forma de pagamento: *${methodLabel}*. Qualquer dúvida, é só falar! 😊`;
              await this.saveMessage(conv.id, companyId, 'ASSISTANT', linkMsg);
              await this.dispatchMessage(connection, conv.customerPhone, linkMsg);
            }
          } catch (payErr: any) {
            log.warn(`WaPayment error for order ${orderId}: ${payErr?.message}`);
            const fallbackMsg = `Seu pedido foi registrado! 🎉 Em breve enviaremos as instruções de pagamento.`;
            await this.saveMessage(conv.id, companyId, 'ASSISTANT', fallbackMsg);
            await this.dispatchMessage(connection, conv.customerPhone, fallbackMsg);
          }
        }

      } catch (err: any) {
        log.warn(`Claude structured — falha ao criar pedido: ${err?.message}`);
      }
    }

    // 3. Transferir para humano se solicitado na resposta
    if (resposta_para_o_cliente.includes('TRANSFERIR_HUMANO')) {
      await this.prisma.whatsappConversation.update({
        where: { id: conv.id },
        data:  { mode: 'HUMAN', status: 'TRANSFERRED' },
      });
    }

    // ── Salvar + enviar resposta ao cliente ──────────────────────────────────
    const cleanReply = resposta_para_o_cliente.replace('TRANSFERIR_HUMANO', '').trim();
    if (cleanReply) {
      await this.saveMessage(conv.id, companyId, 'ASSISTANT', cleanReply);
      const delay = settings.typingDelay ?? 0;
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      await this.dispatchMessage(connection, conv.customerPhone, cleanReply);
    }
  }

  // ── ORDER CREATION ─────────────────────────────────────────────────────────

  private async createOrderFromCart(
    companyId: string,
    cart: any[],
    confirmOrder: { deliveryType: string; address: string; phone: string },
    customerPhone: string,
    formaPagamento?: string,
    customerName?: string,
    neighborhood?: string,
  ): Promise<string> {
    if (!this.ordersService) {
      throw new Error('[WA] ordersService indisponível — dependência circular não resolvida');
    }

    const paymentMethodMap: Record<string, string> = {
      pix:         'PIX',
      credit_card: 'CREDIT_CARD',
      debit_card:  'DEBIT_CARD',
    };
    const paymentMethod = paymentMethodMap[formaPagamento ?? ''] ?? 'PIX';

    // Delega para OrdersService.create para garantir:
    // - socket orderCreated + dashboardUpdate
    // - productCost e productSku reais (lookup no banco)
    // - deliveryFee/driverFee via DeliveryZone quando neighborhood fornecido
    const order = await this.ordersService.create({
      companyId,
      paymentMethod,
      orderType:       confirmOrder.deliveryType === 'PICKUP' ? 'PICKUP' : 'DELIVERY',
      customerPhone,
      customerName:    customerName    ?? null,
      deliveryAddress: confirmOrder.address || null,
      neighborhood:    neighborhood    || undefined,
      notes:           `Pedido via WhatsApp IA — ${confirmOrder.deliveryType} — ${confirmOrder.address || 'Retirada'} — Tel: ${confirmOrder.phone || customerPhone}`,
      items: cart.map((i) => ({
        productId: i.productId,
        unitPrice:  i.price,
        quantity:   i.qty,
      })),
    });

    return order.id;
  }

  // ── HELPERS ────────────────────────────────────────────────────────────────

  private async getOrCreateConversation(connection: any, phone: string, name: string) {
    const existing = await this.prisma.whatsappConversation.findUnique({
      where: { connectionId_customerPhone: { connectionId: connection.id, customerPhone: phone } },
    });
    if (existing) return existing;

    return this.prisma.whatsappConversation.create({
      data: {
        connectionId: connection.id,
        companyId: connection.companyId,
        customerPhone: phone,
        customerName: name,
        context: { cart: [], step: 'GREETING' },
      },
    });
  }

  private saveMessage(conversationId: string, companyId: string, role: string, content: string) {
    return this.prisma.whatsappMessage.create({
      data: { conversationId, companyId, role, content },
    });
  }

  /**
   * Send a transactional order notification to the customer's phone.
   * Finds the first active/connected WhatsApp connection for the company.
   * Silently ignores if no connection or phone is available.
   */
  async sendOrderNotification(params: {
    companyId: string;
    customerPhone: string;
    customerName?: string;
    orderId: string;
    orderType: string;
    total: number;
    items: { name: string; quantity: number }[];
    status: 'CONFIRMED' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
  }) {
    const phone = params.customerPhone?.replace(/\D/g, '');
    if (!phone || phone.length < 8) return; // no phone to notify

    let connection: any;
    try {
      connection = await this.prisma.whatsappConnection.findFirst({
        where: { companyId: params.companyId, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    } catch { return; } // table may not exist yet

    if (!connection) return;

    const statusMsg: Record<string, string> = {
      CONFIRMED: '✅ Pedido confirmado! Estamos preparando.',
      READY: '🟢 Seu pedido está pronto para retirada!',
      OUT_FOR_DELIVERY: '🛵 Seu pedido saiu para entrega!',
      DELIVERED: '🎉 Pedido entregue! Bom apetite!',
      CANCELLED: '❌ Seu pedido foi cancelado.',
    };

    const greeting = params.customerName ? `Olá, *${params.customerName}*! ` : '';
    const itemLines = params.items
      .slice(0, 5)
      .map(i => `  • ${i.quantity}x ${i.name}`)
      .join('\n');
    const totalFmt = `R$ ${Number(params.total).toFixed(2).replace('.', ',')}`;
    const text = [
      `${greeting}${statusMsg[params.status] ?? 'Status atualizado.'}`,
      `📋 *Pedido #${params.orderId.slice(-6).toUpperCase()}*`,
      itemLines,
      `💰 *Total: ${totalFmt}*`,
      params.orderType === 'DELIVERY' ? '📍 Modalidade: Entrega' : params.orderType === 'PICKUP' ? '📍 Modalidade: Retirada' : '',
    ].filter(Boolean).join('\n');

    await this.dispatchMessage(connection, phone, text);
  }

  private async dispatchMessage(connection: any, phone: string, text: string) {
    try {
      if (connection.provider === 'EVOLUTION') {
        if (!connection.apiUrl || !connection.instanceName) {
          log.error(`[dispatchMessage] Connection ${connection.id} misconfigured: missing apiUrl or instanceName`);
          return;
        }
        await sendEvolution(connection.apiUrl, connection.instanceName, connection.apiToken ?? '', phone, text);
      } else if (connection.provider === 'CLOUD_API') {
        if (!connection.phoneNumberId) {
          log.error(`[dispatchMessage] Connection ${connection.id} misconfigured: missing phoneNumberId`);
          return;
        }
        await sendCloudApi(connection.phoneNumberId, connection.apiToken ?? '', phone, text);
      } else {
        log.error(`[dispatchMessage] Connection ${connection.id}: unsupported provider "${connection.provider}"`);
      }
    } catch (err: any) {
      log.error(`[dispatchMessage] Connection ${connection.id} send failed: ${err?.message}`);
    }
  }

  // ── MERCADO PAGO WEBHOOK (WhatsApp orders) ────────────────────────────────

  /**
   * Handles MP webhooks for orders created via WhatsApp IA.
   * external_reference format: "WA_ORDER|orderId|companyId"
   * On approved → Order.status = CONFIRMED + WhatsApp notification to customer.
   */
  async handleMpPaymentWebhook(body: any, query: any): Promise<void> {
    const mpPaymentId = body?.data?.id ?? query?.id;
    if (!mpPaymentId) return;

    const accessToken = this.waPayment['accessToken'];
    if (!accessToken) return;

    let mp: any;
    try {
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(15_000),
      });
      mp = await res.json();
    } catch (err: any) {
      log.warn(`[WA MP Webhook] fetch payment error: ${err?.message}`);
      return;
    }

    const ref = mp.external_reference ?? '';
    if (!ref.startsWith('WA_ORDER|')) return;

    const [, orderId, companyId] = ref.split('|');
    if (!orderId || !companyId) return;

    if (mp.status !== 'approved') return;

    // Idempotency: skip if already CONFIRMED (MP may send duplicate webhook retries)
    const existingOrder = await this.prisma.order.findFirst({
      where: { id: orderId },
      select: { status: true },
    });
    if (!existingOrder) {
      log.warn(`[WA MP Webhook] Order ${orderId} not found — skipping`);
      return;
    }
    if (existingOrder.status === OrderStatus.CONFIRMED) {
      log.log(`[WA MP Webhook] Order ${orderId} already CONFIRMED — idempotency skip`);
      return;
    }

    // Use OrdersService.updateStatus to trigger stock deduction, loyalty, socket events
    try {
      if (this.ordersService) {
        await this.ordersService.updateStatus(orderId, OrderStatus.CONFIRMED, 'SYSTEM', companyId);
      } else {
        // Fallback: direct update (ordersService not available — should not happen in prod)
        await this.prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.CONFIRMED } });
      }
      log.log(`[WA MP Webhook] Order ${orderId} CONFIRMED after payment ${mpPaymentId}`);
    } catch (err: any) {
      log.warn(`[WA MP Webhook] order update error: ${err?.message}`);
      return;
    }

    // Find conversation linked to this order and notify customer
    try {
      const conv = await this.prisma.whatsappConversation.findFirst({
        where: { orderId, companyId },
        include: { connection: true },
      });
      if (conv?.customerPhone) {
        const msg = `✅ Pagamento confirmado! Seu pedido #${orderId.slice(-6).toUpperCase()} está em preparo. Avisaremos quando estiver pronto! 🍕`;
        await this.saveMessage(conv.id, companyId, 'ASSISTANT', msg);
        await this.dispatchMessage(conv.connection, conv.customerPhone, msg);
      }
    } catch (err: any) {
      log.warn(`[WA MP Webhook] notification error: ${err?.message}`);
    }
  }

  private async assertConnectionOwnership(id: string, companyId: string) {
    const conn = await this.prisma.whatsappConnection.findFirst({
      where: { id, companyId },
    });
    if (!conn) throw new NotFoundException('Conexão não encontrada');
    return conn;
  }
}
