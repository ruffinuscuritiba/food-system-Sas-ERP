import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const log = new Logger('WhatsappAiService');

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
  const now = new Date();
  const day = now.getDay(); // 0=sun..6=sat
  const days = (settings.businessDays || '1,2,3,4,5,6').split(',').map(Number);
  if (!days.includes(day)) return false;
  const [sh, sm] = (settings.businessHoursStart || '08:00').split(':').map(Number);
  const [eh, em] = (settings.businessHoursEnd   || '22:00').split(':').map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
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
  constructor(private prisma: PrismaService) {}

  // ── CONNECTIONS ────────────────────────────────────────────────────────────

  findConnections(companyId: string) {
    return (this.prisma as any).whatsappConnection.findMany({
      where: { companyId },
      include: { settings: true, _count: { select: { conversations: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createConnection(companyId: string, dto: CreateConnectionDto) {
    return (this.prisma as any).whatsappConnection.create({
      data: { ...dto, companyId, provider: dto.provider ?? 'EVOLUTION' },
    });
  }

  async updateConnection(id: string, companyId: string, dto: Partial<CreateConnectionDto>) {
    await this.assertConnectionOwnership(id, companyId);
    return (this.prisma as any).whatsappConnection.update({ where: { id }, data: dto });
  }

  async deleteConnection(id: string, companyId: string) {
    await this.assertConnectionOwnership(id, companyId);
    return (this.prisma as any).whatsappConnection.delete({ where: { id } });
  }

  // ── SETTINGS ───────────────────────────────────────────────────────────────

  async getSettings(connectionId: string, companyId: string) {
    await this.assertConnectionOwnership(connectionId, companyId);
    const settings = await (this.prisma as any).whatsappAiSettings.findUnique({
      where: { connectionId },
    });
    return settings;
  }

  async upsertSettings(connectionId: string, companyId: string, dto: UpdateSettingsDto) {
    await this.assertConnectionOwnership(connectionId, companyId);
    return (this.prisma as any).whatsappAiSettings.upsert({
      where: { connectionId },
      create: { ...dto, connectionId, companyId },
      update: dto,
    });
  }

  // ── CONVERSATIONS ──────────────────────────────────────────────────────────

  findConversations(companyId: string, connectionId?: string) {
    return (this.prisma as any).whatsappConversation.findMany({
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
    return (this.prisma as any).whatsappMessage.findMany({
      where: { conversationId, companyId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async setConversationMode(id: string, companyId: string, mode: string) {
    const conv = await (this.prisma as any).whatsappConversation.findFirst({
      where: { id, companyId },
    });
    if (!conv) throw new NotFoundException('Conversa não encontrada');
    return (this.prisma as any).whatsappConversation.update({
      where: { id },
      data: { mode },
    });
  }

  /** Send a message manually as the operator (human mode) */
  async sendManualMessage(id: string, companyId: string, text: string) {
    const conv = await (this.prisma as any).whatsappConversation.findFirst({
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
        (this.prisma as any).whatsappConversation.count({ where: { companyId } }),
        (this.prisma as any).whatsappConversation.count({ where: { companyId, status: 'ACTIVE' } }),
        (this.prisma as any).whatsappConversation.count({ where: { companyId, mode: 'HUMAN' } }),
        (this.prisma as any).whatsappMessage.count({ where: { companyId } }),
        (this.prisma as any).whatsappConversation.count({
          where: { companyId, orderId: { not: null } },
        }),
      ]);

    return { totalConversations, activeConversations, humanConversations, totalMessages, ordersCreated };
  }

  // ── WEBHOOK HANDLER ────────────────────────────────────────────────────────

  /** Evolution API webhook — POST /whatsapp-ai/webhook/:connectionId */
  async handleEvolutionWebhook(connectionId: string, body: any) {
    const event: string = body?.event ?? '';
    if (!['messages.upsert', 'message'].includes(event)) return { ok: true };

    const data = body?.data;
    if (!data) return { ok: true };

    const fromMe: boolean = data?.key?.fromMe ?? false;
    if (fromMe) return { ok: true }; // ignore own messages

    const rawPhone: string = data?.key?.remoteJid ?? '';
    const phone = rawPhone.replace('@s.whatsapp.net', '').replace('@c.us', '');
    const name: string = data?.pushName ?? data?.key?.remoteJid ?? phone;
    const text: string =
      data?.message?.conversation ??
      data?.message?.extendedTextMessage?.text ??
      data?.message?.imageMessage?.caption ??
      '';

    if (!phone || !text.trim()) return { ok: true };
    await this.processIncoming(connectionId, phone, name, text.trim());
    return { ok: true };
  }

  /** Cloud API (Meta) webhook — POST /whatsapp-ai/webhook/:connectionId */
  async handleCloudApiWebhook(connectionId: string, body: any) {
    const entries = body?.entry ?? [];
    for (const entry of entries) {
      for (const change of entry?.changes ?? []) {
        const msgs = change?.value?.messages ?? [];
        const contacts = change?.value?.contacts ?? [];
        for (const msg of msgs) {
          if (msg.type !== 'text') continue;
          const phone: string = msg.from ?? '';
          const text: string = msg?.text?.body ?? '';
          const name: string = contacts.find((c: any) => c.wa_id === phone)?.profile?.name ?? phone;
          if (!phone || !text.trim()) continue;
          await this.processIncoming(connectionId, phone, name, text.trim());
        }
      }
    }
    return { ok: true };
  }

  // ── CORE PROCESSING ────────────────────────────────────────────────────────

  private async processIncoming(connectionId: string, phone: string, name: string, text: string) {
    const connection = await (this.prisma as any).whatsappConnection.findUnique({
      where: { id: connectionId },
      include: { settings: true },
    });
    if (!connection || !connection.isActive) return;

    const settings = connection.settings;

    // Get or create conversation
    const conv = await this.getOrCreateConversation(connection, phone, name);

    // Save user message
    await this.saveMessage(conv.id, connection.companyId, 'USER', text);
    await (this.prisma as any).whatsappConversation.update({
      where: { id: conv.id },
      data: { lastMessageAt: new Date(), customerName: name },
    });

    // If mode is HUMAN or PAUSED, skip AI
    if (conv.mode === 'HUMAN' || conv.mode === 'PAUSED') return;
    if (!settings || !settings.isActive) return;
    if (settings.mode === 'MANUAL') return;

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
        await (this.prisma as any).whatsappConversation.update({
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
    const history = await (this.prisma as any).whatsappMessage.findMany({
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

    // Call AI provider with fake typing simulation (delay before sending)
    let rawResponse = '';
    const aiProvider = settings.aiProvider ?? 'GEMINI';
    const aiModel = settings.aiModel ?? 'gemini-1.5-flash';

    if (aiProvider === 'ANTHROPIC') {
      const anthropicMsgs = aiMessages.map((m: any) => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        text: m.text,
      }));
      rawResponse = await anthropicChat(aiModel, systemPrompt, anthropicMsgs);
    } else {
      rawResponse = await geminiChat(aiModel, systemPrompt, aiMessages as any);
    }

    if (!rawResponse) return;

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
      await (this.prisma as any).whatsappConversation.update({
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
        );
        await (this.prisma as any).whatsappConversation.update({
          where: { id: conv.id },
          data: { orderId, status: 'CLOSED', context: { ...ctx, cart: [] } },
        });
      } catch (err: any) {
        log.warn(`Order creation failed: ${err?.message}`);
      }
    }

    // Process TRANSFER_HUMAN
    if (transferHuman) {
      await (this.prisma as any).whatsappConversation.update({
        where: { id: conv.id },
        data: { mode: 'HUMAN', status: 'TRANSFERRED' },
      });
    }

    // Process CLOSE
    if (closeConversation) {
      await (this.prisma as any).whatsappConversation.update({
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

  // ── ORDER CREATION ─────────────────────────────────────────────────────────

  private async createOrderFromCart(
    companyId: string,
    cart: any[],
    confirmOrder: { deliveryType: string; address: string; phone: string },
    customerPhone: string,
  ): Promise<string> {
    const subtotal = cart.reduce((acc, i) => acc + i.price * i.qty, 0);
    const order = await this.prisma.order.create({
      data: {
        companyId,
        status: 'PENDING' as any,
        paymentMethod: 'PIX' as any, // default, can be updated
        subtotal,
        total: subtotal,
        notes: `Pedido via WhatsApp IA — ${confirmOrder.deliveryType} — ${confirmOrder.address || 'Retirada'} — Tel: ${confirmOrder.phone || customerPhone}`,
        items: {
          create: cart.map((i) => ({
            companyId,
            productId: i.productId,
            productName: i.name,
            productSku: '',
            unitPrice: i.price,
            subtotal: i.price * i.qty,
            productCost: 0,
            quantity: i.qty,
          })),
        },
      },
    });
    return order.id;
  }

  // ── HELPERS ────────────────────────────────────────────────────────────────

  private async getOrCreateConversation(connection: any, phone: string, name: string) {
    const existing = await (this.prisma as any).whatsappConversation.findUnique({
      where: { connectionId_customerPhone: { connectionId: connection.id, customerPhone: phone } },
    });
    if (existing) return existing;

    return (this.prisma as any).whatsappConversation.create({
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
    return (this.prisma as any).whatsappMessage.create({
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
      connection = await (this.prisma as any).whatsappConnection.findFirst({
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
      if (connection.provider === 'EVOLUTION' && connection.apiUrl && connection.instanceName) {
        await sendEvolution(connection.apiUrl, connection.instanceName, connection.apiToken ?? '', phone, text);
      } else if (connection.provider === 'CLOUD_API' && connection.phoneNumberId) {
        await sendCloudApi(connection.phoneNumberId, connection.apiToken ?? '', phone, text);
      } else {
        log.warn(`Connection ${connection.id}: provider not configured or unsupported`);
      }
    } catch (err: any) {
      log.warn(`dispatchMessage error: ${err?.message}`);
    }
  }

  private async assertConnectionOwnership(id: string, companyId: string) {
    const conn = await (this.prisma as any).whatsappConnection.findFirst({
      where: { id, companyId },
    });
    if (!conn) throw new NotFoundException('Conexão não encontrada');
    return conn;
  }
}
