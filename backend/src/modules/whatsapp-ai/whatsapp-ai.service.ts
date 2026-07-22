import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  Optional,
  forwardRef,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/database/prisma.service';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { WhisperService } from './services/whisper.service';
import {
  ClaudeCartService,
  CartStatus,
  StructuredResponse,
} from './services/claude-cart.service';
import { WaPaymentService } from './services/wa-payment.service';
import { WhatsappAiPromptService } from './services/whatsapp-ai-prompt.service';
import { EvolutionProvisionService } from './services/evolution-provision.service';
import { OrdersService } from '@/modules/orders/orders.service';
import { ProductsService } from '@/modules/products/products.service';
import { CategoriesService } from '@/modules/categories/categories.service';
import { LeadsService } from '@/modules/leads/leads.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { SocketGateway } from '@/socket/socket.gateway';
import { OrderStatus } from '@prisma/client';
import { WaConnection, WaConversation, WaSettings } from './types';
import {
  PLATFORM_SELLER_COMPANY_ID,
  isMatrixCompany,
} from '@/common/utils/matrix';

const log = new Logger('WhatsappAiService');
const PIX_EXPIRATION_MINUTES = 30;

// ─── WhatsApp sender helpers ──────────────────────────────────────────────────

async function sendEvolution(
  apiUrl: string,
  instanceName: string,
  token: string,
  phone: string,
  text: string,
) {
  const url = `${apiUrl.replace(/\/$/, '')}/message/sendText/${instanceName}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: token },
    body: JSON.stringify({ number: phone, text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) log.warn(`Evolution send failed: ${res.status}`);
}

/**
 * Envia imagem + legenda via Evolution API. `imageUrl` aceita tanto uma data
 * URL base64 (`data:image/...;base64,AAAA`, o que ImageUploaderPreview já
 * produz — sem passo extra de upload pra nuvem) quanto uma https:// direta;
 * Evolution aceita os dois formatos no campo `media`.
 */
async function sendEvolutionMedia(
  apiUrl: string,
  instanceName: string,
  token: string,
  phone: string,
  imageUrl: string,
  caption: string,
) {
  const media = imageUrl.startsWith('data:')
    ? imageUrl.split(',').slice(1).join(',') // remove o prefixo "data:image/jpeg;base64,"
    : imageUrl;
  const url = `${apiUrl.replace(/\/$/, '')}/message/sendMedia/${instanceName}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: token },
    body: JSON.stringify({
      number: phone,
      mediatype: 'image',
      mimetype: 'image/jpeg',
      media,
      caption,
      fileName: 'promo.jpg',
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) log.warn(`Evolution media send failed: ${res.status}`);
}

async function sendCloudApi(
  phoneNumberId: string,
  token: string,
  phone: string,
  text: string,
) {
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
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

// ─── Business hours check ────────────────────────────────────────────────────

type CompanyBusinessHoursDay = { open: string; close: string; isOpen: boolean };

/**
 * Verifica se o momento atual está dentro do horário de funcionamento.
 *
 * Prioridade de fonte dos horários:
 *   1. Company.businessHours (área de configurações centralizada)
 *   2. WhatsappAiSettings.businessHoursStart/End/Days (legado — mantido como fallback)
 *
 * Suporte a turno overnight (ex: 18:00–02:00): detectado quando closeMin < openMin.
 */
function isBusinessHours(
  settings: WaSettings,
  companyHours?: Record<string, CompanyBusinessHoursDay> | null,
): boolean {
  const now = new Date();
  const brFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = brFormatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';

  const DAY_MAP: Record<string, number> = {
    dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sáb: 6, sab: 6,
  };
  const dayName = get('weekday');
  const day = DAY_MAP[dayName.toLowerCase()] ?? now.getDay();

  const brHour = parseInt(get('hour'), 10);
  const brMinute = parseInt(get('minute'), 10);
  const cur = brHour * 60 + brMinute;

  // ── Fonte 1: Company.businessHours ──────────────────────────────────────
  if (companyHours && typeof companyHours === 'object') {
    const todayConfig = companyHours[String(day)];
    if (!todayConfig) return false;
    if (!todayConfig.isOpen) return false;
    const [oh, om] = (todayConfig.open || '08:00').split(':').map(Number);
    const [ch, cm] = (todayConfig.close || '22:00').split(':').map(Number);
    const openMin = oh * 60 + om;
    const closeMin = ch * 60 + cm;
    if (closeMin < openMin) return cur >= openMin || cur <= closeMin;
    return cur >= openMin && cur <= closeMin;
  }

  // ── Fonte 2: WhatsappAiSettings (fallback legado) ────────────────────────
  const days = (settings.businessDays || '1,2,3,4,5,6').split(',').map(Number);
  if (!days.includes(day)) return false;

  const [sh, sm] = (settings.businessHoursStart || '08:00').split(':').map(Number);
  const [eh, em] = (settings.businessHoursEnd || '22:00').split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (endMin < startMin) return cur >= startMin || cur <= endMin;
  return cur >= startMin && cur <= endMin;
}

const DAY_LABELS_PT = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

/**
 * Linha com o horário de hoje (ou aviso de dia fechado), pra deixar a
 * mensagem de "fora do horário" útil em vez de só repetir "estamos fechados"
 * pra toda pergunta (inclusive "quais os horários?").
 */
function formatTodayHoursLine(
  companyHours?: Record<string, CompanyBusinessHoursDay> | null,
): string {
  if (!companyHours) return '';
  const now = new Date();
  const brFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
  });
  const DAY_MAP: Record<string, number> = {
    dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sáb: 6, sab: 6,
  };
  const dayName = brFormatter.format(now).replace('.', '').toLowerCase();
  const day = DAY_MAP[dayName] ?? now.getDay();
  const todayConfig = companyHours[String(day)];
  if (!todayConfig || !todayConfig.isOpen) {
    return `\n\n📅 Hoje (${DAY_LABELS_PT[day]}) não temos atendimento.`;
  }
  return `\n\n📅 Hoje (${DAY_LABELS_PT[day]}) funcionamos das ${todayConfig.open} às ${todayConfig.close}.`;
}

// ─── Payment method normalizer ───────────────────────────────────────────────

function normalizePaymentMethod(
  raw: string | null | undefined,
): 'pix' | 'credit_card' | 'debit_card' | null {
  if (!raw) return null;
  if (raw === 'pix' || raw === 'credit_card' || raw === 'debit_card')
    return raw;
  const s = raw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (s.includes('pix')) return 'pix';
  if (s.includes('debito') || s.includes('debit')) return 'debit_card';
  if (
    s.includes('credito') ||
    s.includes('credit') ||
    s.includes('cartao') ||
    s.includes('card')
  )
    return 'credit_card';
  return null;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class WhatsappAiService implements OnApplicationBootstrap {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private whisper: WhisperService,
    private claudeCart: ClaudeCartService,
    private waPayment: WaPaymentService,
    private promptService: WhatsappAiPromptService,
    private evolutionProvision: EvolutionProvisionService,
    @Inject(forwardRef(() => OrdersService))
    private ordersService?: OrdersService,
    // Injetados via forwardRef para que qualquer mudança de regra de negócio
    // (soft-delete, sortOrder, isActive, novos campos) seja refletida na Kely
    // automaticamente — a IA não duplica lógica de produto.
    @Optional()
    @Inject(forwardRef(() => ProductsService))
    private productsService?: ProductsService,
    @Optional()
    @Inject(forwardRef(() => CategoriesService))
    private categoriesService?: CategoriesService,
    @Optional()
    private leadsService?: LeadsService,
    @Optional()
    private notificationsService?: NotificationsService,
    @Optional()
    private socketGateway?: SocketGateway,
  ) {}

  onApplicationBootstrap() {
    const hasAnthropic = !!this.config.get('ANTHROPIC_API_KEY');
    const hasGemini = !!this.config.get('GEMINI_API_KEY');

    if (!hasAnthropic && !hasGemini) {
      log.error(
        '[WhatsappAI] CRITICAL: No AI provider API key configured. ' +
          'Set ANTHROPIC_API_KEY or GEMINI_API_KEY in environment variables.',
      );
    } else {
      if (hasAnthropic) log.log('[WhatsappAI] Provider: Anthropic ✓');
      if (hasGemini) log.log('[WhatsappAI] Provider: Gemini ✓');
    }
  }

  // ── AI CHAT HELPERS ────────────────────────────────────────────────────────

  private async geminiChat(
    model: string,
    systemPrompt: string,
    messages: { role: 'user' | 'model'; text: string }[],
  ): Promise<string> {
    const apiKey = this.config.getOrThrow<string>('GEMINI_API_KEY');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: messages.map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      })),
      generationConfig: { temperature: 0.75, maxOutputTokens: 1024 },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok)
      throw new Error(
        `Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`,
      );
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  private async anthropicChat(
    model: string,
    systemPrompt: string,
    messages: { role: 'user' | 'assistant'; text: string }[],
  ): Promise<string> {
    const apiKey = this.config.getOrThrow<string>('ANTHROPIC_API_KEY');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        cache_control: { type: 'ephemeral' },
        system: systemPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.text })),
        max_tokens: 1024,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok)
      throw new Error(
        `Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`,
      );
    const data = (await res.json()) as { content?: { text?: string }[] };
    return data?.content?.[0]?.text ?? '';
  }

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

  async updateConnection(
    id: string,
    companyId: string,
    dto: Partial<CreateConnectionDto>,
  ) {
    await this.assertConnectionOwnership(id, companyId);
    return this.prisma.whatsappConnection.update({ where: { id }, data: dto });
  }

  async deleteConnection(id: string, companyId: string) {
    await this.assertConnectionOwnership(id, companyId);
    // Also clean up the Evolution API instance if provisioned by the platform
    const conn = await this.prisma.whatsappConnection.findUnique({ where: { id } });
    if (conn?.instanceName && conn.apiUrl === this.evolutionProvision['baseUrl']) {
      this.evolutionProvision.deleteInstance(conn.instanceName).catch(() => {});
    }
    return this.prisma.whatsappConnection.delete({ where: { id } });
  }

  // ── MANAGED PROVISIONING (Evolution API auto-setup) ────────────────────────

  /**
   * Creates a WhatsApp connection and auto-provisions an Evolution API instance.
   * The client only needs to scan the returned QR code.
   */
  async provisionConnection(companyId: string, name: string) {
    if (!this.evolutionProvision.isConfigured) {
      throw new BadRequestException('EVOLUTION_API_URL / EVOLUTION_API_KEY não configurados no servidor');
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
    const instanceName = `${slug}-${companyId.slice(0, 8)}-${Date.now().toString(36)}`;
    const backendUrl = this.config.get<string>('BACKEND_URL') ?? '';
    const baseUrl = (this.evolutionProvision as any).baseUrl as string;
    const masterKey = (this.evolutionProvision as any).masterKey as string;

    const { qrCode } = await this.evolutionProvision.createInstance(instanceName);

    // Save connection immediately so we have the id for the webhook URL
    const conn = await this.prisma.whatsappConnection.create({
      data: {
        name,
        companyId,
        provider: 'EVOLUTION',
        instanceName,
        apiUrl: baseUrl,
        apiToken: masterKey,
        isActive: false, // activated after QR scan
      },
    });

    // Register webhook so Evolution notifies us of messages
    if (backendUrl) {
      const webhookUrl = `${backendUrl}/api/whatsapp-ai/webhook/${conn.id}`;
      await this.evolutionProvision.setWebhook(instanceName, webhookUrl).catch((e) =>
        log.warn(`[Provision] Failed to set webhook: ${e.message}`),
      );
    }

    return { connection: conn, qrCode };
  }

  /** Returns a fresh QR code for display. null = already connected. */
  async getConnectionQr(connectionId: string, companyId: string) {
    await this.assertConnectionOwnership(connectionId, companyId);
    const conn = await this.prisma.whatsappConnection.findUnique({ where: { id: connectionId } });
    if (!conn?.instanceName) return { qrCode: null, state: 'close' };

    const state = await this.evolutionProvision.getState(conn.instanceName);
    if (state === 'open') {
      // Mark as active and try to fetch phone number
      if (!conn.isActive) {
        const phone = await this.evolutionProvision.getPhoneNumber(conn.instanceName);
        await this.prisma.whatsappConnection.update({
          where: { id: connectionId },
          data: { isActive: true, phoneNumber: phone ?? conn.phoneNumber },
        });
      }
      return { qrCode: null, state: 'open' };
    }

    const qrCode = await this.evolutionProvision.getQrCode(conn.instanceName);
    return { qrCode, state };
  }

  // ── SETTINGS ───────────────────────────────────────────────────────────────

  /** Público (sem auth) — só o nome do atendente, para exibir no cardápio digital. */
  async getPublicAssistantName(companyId: string): Promise<{ name: string }> {
    const settings = await this.prisma.whatsappAiSettings.findFirst({
      where: { companyId, isActive: true },
      select: { attendantName: true },
      orderBy: { id: 'asc' },
    });
    return { name: settings?.attendantName || 'Atendente' };
  }

  async getSettings(connectionId: string, companyId: string) {
    await this.assertConnectionOwnership(connectionId, companyId);
    // Select explícito: exclui id/connectionId/companyId/createdAt/updatedAt.
    // O frontend faz `{...DEFAULT_SETTINGS, ...r.data}` e reenvia o objeto
    // inteiro no PUT — se o GET devolvesse essas colunas, o ValidationPipe
    // global (forbidNonWhitelisted) rejeitava com 400 "property X should not
    // exist" em QUALQUER salvamento (era isso que quebrava ao trocar o modo).
    return this.prisma.whatsappAiSettings.findUnique({
      where: { connectionId },
      select: {
        aiProvider: true,
        aiModel: true,
        attendantName: true,
        systemPrompt: true,
        greetingMessage: true,
        offlineMessage: true,
        transferKeywords: true,
        mode: true,
        typingDelay: true,
        messageDelay: true,
        useEmojis: true,
        businessHoursStart: true,
        businessHoursEnd: true,
        businessDays: true,
        isActive: true,
        responseStyle: true,
        personalityType: true,
        emojiUsage: true,
        advancedPersonality: true,
        speechHabits: true,
        characteristics: true,
        principles: true,
        humor: true,
        menuLinkStyle: true,
        conversationalOrdering: true,
        orderHandlingMode: true,
      },
    });
  }

  async upsertSettings(
    connectionId: string,
    companyId: string,
    dto: UpdateSettingsDto,
  ) {
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

  /**
   * Liga/desliga a IA permanentemente para um contato específico — diferente
   * de mode=HUMAN (que reseta sozinho após 60min sem resposta do operador),
   * isso nunca volta a responder até o operador reativar manualmente. Uso:
   * vendedor/fornecedor/número errado que não deve receber resposta automática.
   */
  async setAiDisabled(id: string, companyId: string, aiDisabled: boolean) {
    const conv = await this.prisma.whatsappConversation.findFirst({
      where: { id, companyId },
    });
    if (!conv) throw new NotFoundException('Conversa não encontrada');
    return this.prisma.whatsappConversation.update({
      where: { id },
      data: { aiDisabled },
    });
  }

  async sendManualMessage(id: string, companyId: string, text: string) {
    const conv = await this.prisma.whatsappConversation.findFirst({
      where: { id, companyId },
      include: { connection: true },
    });
    if (!conv) throw new NotFoundException('Conversa não encontrada');

    await this.saveMessage(id, companyId, 'ASSISTANT', text);
    await this.dispatchMessage(
      conv.connection as unknown as WaConnection,
      conv.customerPhone,
      text,
    );
    return { ok: true };
  }

  // ── HEALTH ─────────────────────────────────────────────────────────────────

  async getHealth() {
    const [activeConnections, connectionsWithSettings, connectionsWithActiveAI] =
      await Promise.all([
        this.prisma.whatsappConnection.count({ where: { isActive: true } }),
        this.prisma.whatsappAiSettings.count(),
        this.prisma.whatsappAiSettings.count({
          where: { isActive: true, mode: { not: 'MANUAL' } },
        }),
      ]);

    return {
      anthropicKeySet: !!this.config.get('ANTHROPIC_API_KEY'),
      geminiKeySet: !!this.config.get('GEMINI_API_KEY'),
      activeConnections,
      connectionsWithSettings,
      connectionsWithActiveAI,
    };
  }

  // ── STATS ──────────────────────────────────────────────────────────────────

  async getStats(companyId: string) {
    const [
      totalConversations,
      activeConversations,
      humanConversations,
      totalMessages,
      ordersCreated,
    ] = await Promise.all([
      this.prisma.whatsappConversation.count({ where: { companyId } }),
      this.prisma.whatsappConversation.count({
        where: { companyId, status: 'ACTIVE' },
      }),
      this.prisma.whatsappConversation.count({
        where: { companyId, mode: 'HUMAN' },
      }),
      this.prisma.whatsappMessage.count({ where: { companyId } }),
      this.prisma.whatsappConversation.count({
        where: { companyId, orderId: { not: null } },
      }),
    ]);

    return {
      totalConversations,
      activeConversations,
      humanConversations,
      totalMessages,
      ordersCreated,
    };
  }

  // ── WEBHOOK HANDLER ────────────────────────────────────────────────────────

  async handleEvolutionWebhook(
    connectionId: string,
    body: Record<string, unknown>,
  ) {
    const event: string = (body?.event as string) ?? '';
    const normalizedEvent = event.toLowerCase().replace(/[_-]/g, '.');
    if (
      !['messages.upsert', 'message', 'messages.set'].includes(normalizedEvent)
    ) {
      log.log(
        `[WH] ignored event="${event}" normalised="${normalizedEvent}" connectionId=${connectionId}`,
      );
      return { ok: true };
    }

    const data = body?.data as Record<string, unknown> | undefined;
    if (!data) return { ok: true };

    const msgData = (
      Array.isArray(data?.messages) && (data.messages as unknown[]).length > 0
        ? (data.messages as Record<string, unknown>[])[0]
        : data
    ) as Record<string, unknown>;

    const fromMe: boolean =
      ((msgData?.key as Record<string, unknown>)?.fromMe as boolean) ?? false;
    if (fromMe) return { ok: true };

    const rawPhone: string =
      ((msgData?.key as Record<string, unknown>)?.remoteJid as string) ?? '';
    const phone = rawPhone
      .replace('@s.whatsapp.net', '')
      .replace('@c.us', '')
      .replace('@g.us', '');
    const name: string = (msgData?.pushName as string) ?? rawPhone ?? phone;

    const message = msgData?.message as Record<string, unknown> | undefined;
    let text: string =
      (message?.conversation as string) ??
      ((message?.extendedTextMessage as Record<string, unknown>)
        ?.text as string) ??
      ((message?.imageMessage as Record<string, unknown>)?.caption as string) ??
      ((message?.buttonsResponseMessage as Record<string, unknown>)
        ?.selectedDisplayText as string) ??
      '';

    // ── Suporte a áudio (PTT e audioMessage) via Whisper ──────────────────
    const audioMsg = (message?.audioMessage ?? message?.pttMessage) as
      | Record<string, unknown>
      | undefined;
    if (!text.trim() && audioMsg?.url) {
      try {
        const connection = await this.prisma.whatsappConnection.findUnique({
          where: { id: connectionId },
        });
        const headers: Record<string, string> = connection?.apiToken
          ? { apikey: String(connection.apiToken) }
          : {};
        const transcript = await this.whisper.transcribeFromUrl(
          audioMsg.url as string,
          (audioMsg.mimetype as string) ?? 'audio/ogg',
          headers,
        );
        if (transcript) text = `[Áudio] ${transcript}`;
      } catch (err: unknown) {
        log.warn(
          `Evolution audio transcription failed: ${(err as Error)?.message}`,
        );
      }
    }

    if (rawPhone.includes('@g.us') || rawPhone.includes('@broadcast'))
      return { ok: true };

    if (!phone || !text.trim()) {
      log.warn(
        `[WH] skipped — empty phone/text. event="${event}" phone="${rawPhone}" msgType=${JSON.stringify(Object.keys(message ?? {}))}`,
      );
      return { ok: true };
    }

    try {
      await this.processIncoming(connectionId, phone, name, text.trim());
    } catch (err: unknown) {
      log.error(
        `[WH][Evolution] processIncoming falhou para phone="${phone}" connId="${connectionId}": ${(err as Error)?.message ?? err}`,
      );
    }
    return { ok: true };
  }

  async handleCloudApiWebhook(
    connectionId: string,
    body: Record<string, unknown>,
  ) {
    const entries = (body?.entry as Record<string, unknown>[]) ?? [];
    for (const entry of entries) {
      for (const change of (entry?.changes as Record<string, unknown>[]) ??
        []) {
        const value = change?.value as Record<string, unknown>;
        const msgs = (value?.messages as Record<string, unknown>[]) ?? [];
        const contacts = (value?.contacts as Record<string, unknown>[]) ?? [];
        for (const msg of msgs) {
          const phone: string = (msg.from as string) ?? '';
          const name: string =
            (
              contacts.find((c) => c.wa_id === phone) as Record<string, unknown>
            )?.['profile'] &&
            ((
              (
                contacts.find((c) => c.wa_id === phone) as Record<
                  string,
                  unknown
                >
              )['profile'] as Record<string, unknown>
            )?.name as string)
              ? ((
                  (
                    contacts.find((c) => c.wa_id === phone) as Record<
                      string,
                      unknown
                    >
                  )['profile'] as Record<string, unknown>
                )?.name as string)
              : phone;
          if (!phone) continue;

          let text = '';

          if (msg.type === 'text') {
            text =
              ((msg?.text as Record<string, unknown>)?.body as string) ?? '';
          } else if (msg.type === 'audio') {
            try {
              const connection =
                await this.prisma.whatsappConnection.findUnique({
                  where: { id: connectionId },
                });
              const token = connection?.apiToken ?? '';
              const audio = msg.audio as Record<string, unknown> | undefined;
              if (token && audio?.id) {
                const mediaUrl = await this.whisper.fetchMetaMediaUrl(
                  audio.id as string,
                  token,
                );
                if (mediaUrl) {
                  const transcript = await this.whisper.transcribeFromUrl(
                    mediaUrl,
                    (audio?.mime_type as string) ?? 'audio/ogg',
                    { Authorization: `Bearer ${token}` },
                  );
                  if (transcript) text = `[Áudio] ${transcript}`;
                }
              }
            } catch (err: unknown) {
              log.warn(
                `Cloud API audio transcription failed: ${(err as Error)?.message}`,
              );
            }
          }

          if (!text.trim()) continue;
          try {
            await this.processIncoming(connectionId, phone, name, text.trim());
          } catch (err: unknown) {
            log.error(
              `[WH][CloudAPI] processIncoming falhou para phone="${phone}" connId="${connectionId}": ${(err as Error)?.message ?? err}`,
            );
          }
        }
      }
    }
    return { ok: true };
  }

  // ── CORE PROCESSING ────────────────────────────────────────────────────────

  private async processIncoming(
    connectionId: string,
    phone: string,
    name: string,
    text: string,
  ) {
    log.warn(
      `[DIAG][processIncoming] START connectionId=${connectionId} phone=${phone} textLen=${text.length}`,
    );

    let connection: WaConnection | null;
    try {
      connection = (await this.prisma.whatsappConnection.findUnique({
        where: { id: connectionId },
        include: { settings: true },
      })) as WaConnection | null;
    } catch (err: unknown) {
      log.error(
        `[AI] DB falhou ao carregar connection ${connectionId}: ${(err as Error)?.message ?? err}`,
      );
      return;
    }

    log.warn(
      `[DIAG][processIncoming] connection found=${!!connection} isActive=${connection?.isActive} provider=${connection?.provider} hasSettings=${!!connection?.settings}`,
    );

    if (!connection) {
      log.warn(
        `[AI] connectionId=${connectionId} não encontrado — webhook ignorado`,
      );
      return;
    }
    if (!connection.isActive) {
      log.warn(
        `[AI] connection=${connectionId} isActive=false — AI desativada`,
      );
      return;
    }

    try {
      await this._processIncomingWithConnection(connection, phone, name, text);
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? '';
      const isApiQuota = /429|quota|rate.?limit|billing/i.test(msg);
      const isTimeout = /timeout|ETIMEDOUT|AbortError/i.test(msg);
      const isDbError = /prisma|database|connection.*refused/i.test(msg);

      if (isApiQuota)
        log.error(
          `[AI] SALDO/QUOTA esgotado — provider sem créditos. conn=${connectionId} phone=${phone}: ${msg}`,
        );
      else if (isTimeout)
        log.error(
          `[AI] TIMEOUT na chamada de IA ou DB. conn=${connectionId} phone=${phone}: ${msg}`,
        );
      else if (isDbError)
        log.error(
          `[AI] FALHA no banco de dados. conn=${connectionId} phone=${phone}: ${msg}`,
        );
      else
        log.error(
          `[AI] Erro inesperado. conn=${connectionId} phone=${phone}: ${msg}`,
        );

      const contingency =
        'Olá! No momento estou atualizando nosso sistema, mas você pode fazer seu pedido diretamente pelo nosso cardápio digital ou ligar para nós. Retornaremos em instantes! 🙏';
      await this.dispatchMessage(connection, phone, contingency).catch(
        (sendErr: unknown) =>
          log.error(
            `[AI] Falha ao enviar contingência para ${phone}: ${(sendErr as Error)?.message}`,
          ),
      );
    }
  }

  private async _processIncomingWithConnection(
    connection: WaConnection,
    phone: string,
    name: string,
    text: string,
  ) {
    const company = await this.prisma.company.findUnique({
      where: { id: connection.companyId },
      select: { subscriptionStatus: true, email: true },
    });

    // Ambiente de VENDAS (plataforma R_FoodSaaS / lojas demo) não passa pelos
    // gates de trial nem de horário — a Kely vendedora responde leads 24/7.
    const ambiente = this.detectAmbiente(company?.email, connection.companyId);
    const isSalesMode = ambiente !== 'CLIENTE_REAL';

    // Block AI processing for companies in trial (PENDING_PAYMENT) — cost control.
    if (!isSalesMode && company && company.subscriptionStatus !== 'ACTIVE') {
      log.warn(
        `[AI] company=${connection.companyId} subscriptionStatus=${company.subscriptionStatus} — IA bloqueada durante trial`,
      );
      return;
    }

    let settings = connection.settings as WaSettings | null | undefined;

    log.warn(
      `[DIAG][_processIncoming] conn=${connection.id} ` +
        `settings=${settings ? 'PRESENT' : 'NULL'} ` +
        `sett.isActive=${settings?.isActive} ` +
        `sett.mode=${settings?.mode} ` +
        `sett.aiProvider=${settings?.aiProvider} ` +
        `sett.aiModel=${settings?.aiModel} ` +
        `sett.businessHoursStart=${settings?.businessHoursStart} ` +
        `sett.businessHoursEnd=${settings?.businessHoursEnd} ` +
        `sett.businessDays=${settings?.businessDays}`,
    );

    const conv = await this.getOrCreateConversation(connection, phone, name);

    log.warn(
      `[DIAG][_processIncoming] conv.id=${conv.id} conv.mode=${conv.mode} conv.status=${conv.status}`,
    );

    await this.saveMessage(conv.id, connection.companyId, 'USER', text);
    await this.prisma.whatsappConversation.update({
      where: { id: conv.id },
      data: { lastMessageAt: new Date(), customerName: name },
    });

    // Resposta à pergunta "como foi a pizza?" pós-entrega — intercepta ANTES
    // de qualquer gate de IA (mode/aiDisabled/horário), pois não é uma
    // conversa de pedido: é o cliente respondendo um pedido de feedback.
    const feedbackHandled = await this.tryHandleFeedbackReply(
      connection.companyId,
      phone,
      text,
    );
    if (feedbackHandled) return;

    if (conv.aiDisabled) {
      log.warn(
        `[AI] conv=${conv.id} phone=${phone} — aiDisabled=true, IA permanentemente desativada para este contato (não auto-reseta)`,
      );
      return;
    }

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
        log.warn(
          `[AI] conv=${conv.id} phone=${phone} — auto-reset HUMAN→AI (operador inativo há ${Math.round(minutesSinceOperator)}min)`,
        );
      } else {
        log.warn(
          `[AI] conv=${conv.id} phone=${phone} mode=${conv.mode} — operador assumiu há ${Math.round(minutesSinceOperator)}min, aguardando`,
        );
        return;
      }
    }

    if (!settings) {
      // Reprovisionar a conexão cria uma WhatsappConnection nova e o cascade
      // apaga as settings antigas — sem self-healing a IA fica muda em silêncio.
      // O provider default aqui NÃO pode ser fixo em GEMINI: lojas reais
      // (CLIENTE_REAL) precisam nascer em CLAUDE (motor completo) e a
      // conexão vendedora do SaaS precisa nascer em ANTHROPIC — nunca
      // depender de alguém lembrar de corrigir manualmente após o QR.
      const healingCompany = await this.prisma.company.findUnique({
        where: { id: connection.companyId },
        select: { email: true },
      });
      const healingAmbiente = this.detectAmbiente(
        healingCompany?.email,
        connection.companyId,
      );
      const healingProvider =
        healingAmbiente === 'CLIENTE_REAL' ? 'CLAUDE' : 'ANTHROPIC';
      log.warn(
        `[AI] connection=${connection.id} sem WhatsappAiSettings — criando defaults automaticamente (ambiente=${healingAmbiente}, aiProvider=${healingProvider})`,
      );
      settings = (await this.prisma.whatsappAiSettings.upsert({
        where: { connectionId: connection.id },
        update: {},
        create: {
          connectionId: connection.id,
          companyId: connection.companyId,
          aiProvider: healingProvider,
          aiModel:
            healingProvider === 'CLAUDE'
              ? 'claude-haiku-4-5-20251001'
              : 'gemini-2.0-flash',
        },
      })) as unknown as WaSettings;
    }
    if (!settings.isActive) {
      log.warn(
        `[AI] connection=${connection.id} settings.isActive=false — AI inativa`,
      );
      return;
    }
    if (settings.mode === 'MANUAL') {
      log.warn(
        `[AI] connection=${connection.id} mode=MANUAL — sem resposta automática (configure para AUTO ou HYBRID)`,
      );
      return;
    }

    // Lê businessHours centralizado de Company (nova fonte) com fallback para settings (legado)
    const companyRow = await this.prisma.company.findUnique({
      where: { id: connection.companyId },
      select: { businessHours: true, slug: true },
    });
    const companyHours = companyRow?.businessHours as
      | Record<string, CompanyBusinessHoursDay>
      | null
      | undefined;

    const _inBusinessHours =
      isSalesMode || isBusinessHours(settings, companyHours);
    log.warn(
      `[DIAG][businessHours] conn=${connection.id} inHours=${_inBusinessHours} ambiente=${ambiente} source=${companyHours ? 'Company' : 'WhatsappAiSettings'} start=${settings?.businessHoursStart} end=${settings?.businessHoursEnd} days=${settings?.businessDays}`,
    );
    if (!_inBusinessHours) {
      const prefix =
        settings.offlineMessage ||
        'Olá! No momento estamos fora do horário de atendimento. 🕐';
      const hoursLine = formatTodayHoursLine(companyHours);
      const frontendUrl = this.config.get<string>('FRONTEND_URL');
      const menuLine =
        frontendUrl && companyRow?.slug
          ? `\n\n📋 Enquanto isso, dá pra ver nosso cardápio aqui: ${frontendUrl.replace(/\/$/, '')}/menu/${companyRow.slug}`
          : '';
      const msg = `${prefix}${hoursLine}${menuLine}`;
      await this.saveMessage(conv.id, connection.companyId, 'ASSISTANT', msg);
      await this.dispatchMessage(connection, phone, msg);
      return;
    }

    if (settings.transferKeywords) {
      const kws = settings.transferKeywords
        .split(',')
        .map((k) => k.trim().toLowerCase());
      if (kws.some((kw) => text.toLowerCase().includes(kw))) {
        await this.prisma.whatsappConversation.update({
          where: { id: conv.id },
          data: { mode: 'HUMAN', status: 'TRANSFERRED' },
        });
        this.notifyHumanHelpRequested(
          connection,
          connection.companyId,
          conv.customerPhone,
          conv.customerName,
          text,
          conv.id,
        ).catch((err: unknown) =>
          log.warn(
            `[AI] notifyHumanHelpRequested falhou (transferKeywords): ${(err as Error)?.message}`,
          ),
        );
        const msg =
          '👤 Você foi transferido para um atendente humano. Aguarde um momento...';
        await this.saveMessage(conv.id, connection.companyId, 'ASSISTANT', msg);
        await this.dispatchMessage(connection, phone, msg);
        return;
      }
    }

    try {
      await this.runAiResponse(connection, settings, conv, text);
    } catch (err: unknown) {
      log.error(
        `[AI] runAiResponse falhou conv=${conv.id} provider=${settings.aiProvider ?? 'GEMINI'}: ${(err as Error)?.message}`,
      );
      const fallback =
        'Desculpe, tive um problema temporário. Pode repetir sua mensagem?';
      await this.saveMessage(
        conv.id,
        connection.companyId,
        'ASSISTANT',
        fallback,
      );
      await this.dispatchMessage(connection, phone, fallback);
    }
  }

  /**
   * Detecta o ambiente da IA central a partir da empresa dona da conexão:
   *   - PLATFORM_SELLER_COMPANY_ID → R_FOOD_SAAS (vende o sistema)
   *   - empresas demo              → LOJA_DEMO (demonstra + upsell)
   *   - demais                     → CLIENTE_REAL (atende pedidos)
   *
   * O fallback legado por e-mail (`platform@foodsaas.internal`) foi removido:
   * a empresa matriz "Ruffinu's Pizzaria" (MATRIX_COMPANY_ID) mantém esse
   * e-mail histórico no cadastro mesmo sendo, hoje, uma loja real com
   * clientes reais — o fallback fazia a Kely tentar vender o sistema pra
   * quem só queria pedir pizza. PLATFORM_SELLER_COMPANY_ID já cobre o caso
   * de venda do SaaS com um ID de empresa dedicado e sem essa ambiguidade.
   */
  private detectAmbiente(
    email: string | null | undefined,
    companyId: string,
  ): 'R_FOOD_SAAS' | 'LOJA_DEMO' | 'CLIENTE_REAL' {
    const mail = (email ?? '').toLowerCase();
    if (companyId === PLATFORM_SELLER_COMPANY_ID) return 'R_FOOD_SAAS';
    if (
      mail.includes('@foodsaas.demo') ||
      mail.includes('demo-') ||
      companyId.startsWith('demo-')
    ) {
      return 'LOJA_DEMO';
    }
    return 'CLIENTE_REAL';
  }

  /** Monta o {{DADOS_CONTEXTO}} injetado no prompt-mestre por ambiente. */
  private buildAmbienteContext(
    ambiente: string,
    plan: string | null | undefined,
    menuCtx: string,
  ): string {
    if (ambiente === 'R_FOOD_SAAS') {
      return `PLATAFORMA R_FoodSaaS — ERP completo para restaurantes, pizzarias e delivery.

MÓDULOS: PDV/Caixa, Cardápio Digital, Cozinha (KDS) em tempo real, Estoque com CMV, Financeiro/Fluxo de caixa, Relatórios/BI, Delivery com rastreamento e entregadores, Mesas, Fidelidade/Cupons, Pizza com bordas, e WhatsApp IA (atendimento automatizado que vende e tira pedidos sozinho).

PLANOS:
- BASIC: operação essencial (PDV, cardápio digital, pedidos, cozinha).
- PRO: tudo do Basic + automações, estoque, financeiro, delivery, WhatsApp IA.
- ENTERPRISE: tudo do Pro + IA avançada (áudio, marketing preditivo), BI completo, multi-loja.

DIFERENCIAIS DE VENDA: automatiza o delivery, reduz erros de pedido, atende no WhatsApp 24/7 com IA, aumenta o ticket médio com sugestões, dá relatórios de ROI e facilita a gestão. Conduza para fechar um plano ou agendar uma demonstração.`;
    }
    if (ambiente === 'LOJA_DEMO') {
      return `LOJA DE DEMONSTRAÇÃO — Plano atual em teste: ${plan ?? 'BASIC'}.
O cliente está testando o sistema. Mostre o valor do recurso atual e instigue o upgrade (Basic→Pro→Enterprise) com foco em quanto isso traz de retorno financeiro.

Cardápio de exemplo desta demo:
${menuCtx || '(cardápio de exemplo indisponível)'}`;
    }
    return menuCtx;
  }

  /**
   * Persiste/atualiza um Lead a partir de uma conversa de VENDAS (ambiente
   * R_FOOD_SAAS) — o WhatsApp da plataforma vendendo o próprio FoodSaaS.
   * O número do cliente já qualifica o lead; os demais campos vêm do JSON
   * estruturado da IA (`dados_carrinho_ou_lead`) quando disponíveis.
   * Best-effort e fire-and-forget: nunca quebra o fluxo de atendimento.
   */
  private persistSalesLead(
    conv: WaConversation,
    leadOrCart: Record<string, unknown>,
    reply: string,
  ): void {
    if (!this.leadsService) return;

    const lc = leadOrCart ?? {};
    const pick = (...keys: string[]): string | undefined => {
      for (const k of keys) {
        const v = lc[k];
        if (typeof v === 'string' && v.trim()) return v.trim();
        if (typeof v === 'number') return String(v);
      }
      return undefined;
    };

    // Normaliza o plano citado pela IA para BASIC | PRO | ENTERPRISE
    const rawPlan = pick('plano', 'plano_recomendado', 'recommendedPlan', 'plan');
    let plan: string | undefined;
    if (rawPlan) {
      const u = rawPlan.toUpperCase();
      if (u.includes('ENTERPRISE') || u.includes('AVANÇ') || u.includes('AVANC'))
        plan = 'ENTERPRISE';
      else if (u.includes('PRO') || u.includes('PROFISS')) plan = 'PRO';
      else if (u.includes('BASIC') || u.includes('BÁSIC') || u.includes('BASICO'))
        plan = 'BASIC';
    }

    const name =
      pick('nome', 'name', 'nome_cliente', 'contato') ??
      conv.customerName ??
      undefined;
    const company = pick(
      'empresa',
      'company',
      'nome_loja',
      'loja',
      'restaurante',
      'estabelecimento',
    );

    this.leadsService
      .upsert({
        sessionToken: `wa-sales-${conv.id}`,
        name,
        company,
        whatsapp: conv.customerPhone,
        recommendedPlan: plan,
        conversationSummary: reply?.slice(0, 500),
      })
      .catch((err) =>
        log.warn(
          `[AI] persistSalesLead falhou conv=${conv.id}: ${(err as Error)?.message}`,
        ),
      );
  }

  private async runAiResponse(
    connection: WaConnection,
    settings: WaSettings,
    conv: WaConversation,
    userText: string,
  ) {
    const companyId = connection.companyId;

    const _diagProvider = settings.aiProvider ?? 'GEMINI';
    const _diagModel = settings.aiModel ?? this.config.get('GEMINI_MODEL') ?? 'gemini-2.0-flash';
    log.warn(
      `[DIAG][runAiResponse] START conv=${conv.id} provider=${_diagProvider} model=${_diagModel} ` +
        `GEMINI_KEY=${!!this.config.get('GEMINI_API_KEY')} ANTHROPIC_KEY=${!!this.config.get('ANTHROPIC_API_KEY')}`,
    );

    const [products, categories] = await Promise.all([
      this.productsService
        ? this.productsService.publicMenu(companyId)
        : this.prisma.product.findMany({
            where: { companyId, isActive: true, deletedAt: null },
            include: { sizes: true, category: { select: { name: true } } },
          }),
      this.categoriesService
        ? this.categoriesService.findAll(companyId)
        : this.prisma.category.findMany({ where: { companyId } }),
    ]);

    const menuCtx = this.promptService.buildMenuContext(
      products as Record<string, unknown>[],
      categories as Record<string, unknown>[],
    );

    const ctx = (conv.context ?? {}) as Record<string, unknown>;
    const cart = (ctx['cart'] as Record<string, unknown>[]) ?? [];
    const cartCtx = cart.length
      ? cart
          .map(
            (i) =>
              `${i['name']} x${i['qty']} — R$${(Number(i['price']) * Number(i['qty'])).toFixed(2)}`,
          )
          .join('\n')
      : '';

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, email: true, plan: true },
    });
    const companyName = company?.name ?? 'nossa loja';

    // ── Detecção de ambiente (cérebro multi-modo) ───────────────────────────
    const ambiente = this.detectAmbiente(company?.email, companyId);
    const isSalesMode = ambiente !== 'CLIENTE_REAL';

    const systemPrompt = isSalesMode
      ? this.promptService.buildMasterPrompt(
          ambiente,
          this.buildAmbienteContext(ambiente, company?.plan, menuCtx),
        )
      : this.promptService.buildSystemPrompt(
          settings,
          companyName,
          menuCtx,
          cartCtx,
        );

    const history = await this.prisma.whatsappMessage.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    history.reverse();

    const aiMessages = history
      .filter((m) => m.role !== 'SYSTEM')
      .map((m) => ({
        role: m.role === 'USER' ? ('user' as const) : ('model' as const),
        text: m.content,
      }));

    const hasGreeting = aiMessages.some((m) => m.role === 'model');
    if (!hasGreeting && settings.greetingMessage) {
      aiMessages.unshift({ role: 'model', text: settings.greetingMessage });
    }

    let aiProvider = settings.aiProvider ?? 'GEMINI';

    // Runtime fallback: switch provider if the configured one has no key
    const hasGeminiKey = !!this.config.get('GEMINI_API_KEY');
    const hasAnthropicKey = !!this.config.get('ANTHROPIC_API_KEY');
    if (
      (aiProvider === 'GEMINI' || aiProvider === 'CLAUDE') &&
      !hasGeminiKey &&
      hasAnthropicKey
    ) {
      log.warn(
        `[AI] conv=${conv.id} — aiProvider=${aiProvider} but GEMINI_API_KEY absent; auto-switching to ANTHROPIC`,
      );
      aiProvider = 'ANTHROPIC';
    } else if (aiProvider === 'ANTHROPIC' && !hasAnthropicKey && hasGeminiKey) {
      log.warn(
        `[AI] conv=${conv.id} — aiProvider=ANTHROPIC but ANTHROPIC_API_KEY absent; auto-switching to GEMINI`,
      );
      aiProvider = 'GEMINI';
    }

    if (aiProvider === 'CLAUDE') {
      await this.runClaudeStructuredResponse(
        connection,
        settings,
        conv,
        userText,
        products as Record<string, unknown>[],
        categories as Record<string, unknown>[],
      );
      return;
    }

    let rawResponse = '';
    const DEPRECATED_MODELS: Record<string, string> = {
      'claude-haiku-20240307': 'claude-haiku-4-5-20251001',
      'claude-3-haiku-20240307': 'claude-haiku-4-5-20251001',
      'claude-sonnet-20240229': 'claude-sonnet-4-6',
      'claude-3-5-sonnet-20241022': 'claude-sonnet-4-6',
      'claude-3-5-sonnet-20240620': 'claude-sonnet-4-6',
      'claude-opus-20240229': 'claude-opus-4-8',
    };
    const rawAiModel =
      settings.aiModel ??
      this.config.get('ANTHROPIC_MODEL') ??
      'claude-haiku-4-5-20251001';
    const aiModel = DEPRECATED_MODELS[rawAiModel] ?? rawAiModel;
    if (aiModel !== rawAiModel) {
      log.warn(`[AI] Modelo deprecado "${rawAiModel}" migrado automaticamente para "${aiModel}"`);
    }

    if (aiProvider === 'ANTHROPIC') {
      const anthropicMsgs = aiMessages.map((m) => ({
        role: m.role === 'model' ? ('assistant' as const) : ('user' as const),
        text: m.text,
      }));
      try {
        rawResponse = await this.anthropicChat(
          aiModel,
          systemPrompt,
          anthropicMsgs,
        );
      } catch (anthropicErr: unknown) {
        const errMsg = (anthropicErr as Error)?.message ?? '';
        log.warn(
          `[AI] conv=${conv.id} Anthropic falhou (${errMsg.slice(0, 100)}). Tentando Gemini como fallback...`,
        );
        const geminiModel =
          this.config.get('GEMINI_MODEL') ??
          settings.aiModel ??
          'gemini-2.0-flash';
        rawResponse = await this.geminiChat(
          geminiModel,
          systemPrompt,
          aiMessages,
        );
      }
    } else {
      try {
        rawResponse = await this.geminiChat(aiModel, systemPrompt, aiMessages);
      } catch (geminiErr: unknown) {
        const errMsg = (geminiErr as Error)?.message ?? '';
        log.warn(
          `[AI] conv=${conv.id} Gemini falhou (${errMsg.slice(0, 100)}). Tentando Anthropic como fallback...`,
        );
        if (!hasAnthropicKey) throw geminiErr;
        const anthropicMsgs = aiMessages.map((m) => ({
          role: m.role === 'model' ? ('assistant' as const) : ('user' as const),
          text: m.text,
        }));
        rawResponse = await this.anthropicChat(
          aiModel,
          systemPrompt,
          anthropicMsgs,
        );
      }
    }

    if (!rawResponse) {
      log.warn(
        `[AI] conv=${conv.id} provider=${aiProvider} model=${aiModel} — resposta vazia (possível filtro de segurança, quota excedida ou candidates:[])`,
      );
      const emptyFallback =
        'Desculpe, não consegui processar sua mensagem agora. Pode tentar de novo em instantes? 🙏';
      await this.saveMessage(conv.id, companyId, 'ASSISTANT', emptyFallback);
      await this.dispatchMessage(connection, conv.customerPhone, emptyFallback);
      return;
    }

    // ── Modo VENDAS (R_FOOD_SAAS / LOJA_DEMO): resposta em JSON estruturado ──
    if (isSalesMode) {
      const parsed = this.promptService.parseMasterResponse(rawResponse);
      const reply =
        parsed.reply ||
        'Opa! Pode me contar um pouco mais sobre o que você procura? 😊';

      // Captura de lead — somente no ambiente de venda da própria plataforma
      // (R_FOOD_SAAS). O número do cliente já qualifica o lead; demais campos
      // vêm do JSON estruturado da IA. Best-effort, não bloqueia a resposta.
      if (ambiente === 'R_FOOD_SAAS') {
        this.persistSalesLead(conv, parsed.leadOrCart, reply);
      }

      // Transbordo só trava a conversa se o CLIENTE pediu explicitamente
      // (evita que a IA se transfira sozinha num "oi" e bloqueie tudo).
      if (parsed.transferHuman) {
        const kws = (settings.transferKeywords ?? '')
          .split(',')
          .map((k) => k.trim().toLowerCase())
          .filter(Boolean);
        const userAskedHuman = kws.some((k) =>
          userText.toLowerCase().includes(k),
        );
        if (userAskedHuman) {
          await this.prisma.whatsappConversation
            .update({
              where: { id: conv.id },
              data: { mode: 'HUMAN', status: 'TRANSFERRED' },
            })
            .catch(() => {});
          this.notifyHumanHelpRequested(
            connection,
            companyId,
            conv.customerPhone,
            conv.customerName,
            userText,
            conv.id,
          ).catch((err: unknown) =>
            log.warn(
              `[AI] notifyHumanHelpRequested falhou (sales mode): ${(err as Error)?.message}`,
            ),
          );
        } else {
          log.warn(
            `[AI] conv=${conv.id} ambiente=${ambiente} — IA pediu transbordo mas cliente não solicitou; mantendo modo IA`,
          );
        }
      }

      await this.saveMessage(conv.id, companyId, 'ASSISTANT', reply);
      const sDelay = settings.typingDelay ?? 0;
      if (sDelay > 0) await new Promise((r) => setTimeout(r, sDelay));
      await this.dispatchMessage(connection, conv.customerPhone, reply);
      return;
    }

    const {
      cleanText,
      addItems,
      confirmOrder,
      transferHuman,
      closeConversation,
    } = this.promptService.parseCommands(rawResponse);

    if (addItems.length > 0) {
      const productMap = new Map<string, Record<string, unknown>>(
        (products as Record<string, unknown>[]).map((p) => [
          p['id'] as string,
          p,
        ]),
      );
      const updatedCart = [...cart];
      for (const cmd of addItems) {
        const prod = productMap.get(cmd.productId);
        if (!prod) continue;
        const existing = updatedCart.find(
          (i) => i['productId'] === cmd.productId,
        );
        if (existing) {
          existing['qty'] = Number(existing['qty']) + cmd.qty;
        } else {
          updatedCart.push({
            productId: cmd.productId,
            name: prod['name'] as string,
            price: Number(prod['salePrice'] ?? 0),
            qty: cmd.qty,
          });
        }
      }
      ctx['cart'] = updatedCart;
      await this.prisma.whatsappConversation.update({
        where: { id: conv.id },
        data: {
          context:
            ctx as unknown as import('@prisma/client').Prisma.InputJsonValue,
        },
      });
    }

    if (confirmOrder && cart.length > 0) {
      try {
        const typedCart = cart as {
          productId: string;
          name: string;
          price: number;
          qty: number;
        }[];
        const orderId = await this.createOrderFromCart(
          companyId,
          typedCart,
          confirmOrder,
          conv.customerPhone,
          undefined,
          conv.customerName ?? undefined,
          (ctx['bairro'] as string | undefined) ?? undefined,
        );
        await this.prisma.whatsappConversation.update({
          where: { id: conv.id },
          data: {
            orderId,
            status: 'CLOSED',
            context: {
              ...ctx,
              cart: [],
            } as unknown as import('@prisma/client').Prisma.InputJsonValue,
          },
        });
      } catch (err: unknown) {
        log.warn(`Order creation failed: ${(err as Error)?.message}`);
      }
    }

    if (transferHuman) {
      await this.prisma.whatsappConversation.update({
        where: { id: conv.id },
        data: { mode: 'HUMAN', status: 'TRANSFERRED' },
      });
      this.notifyHumanHelpRequested(
        connection,
        companyId,
        conv.customerPhone,
        conv.customerName,
        userText,
        conv.id,
      ).catch((err: unknown) =>
        log.warn(
          `[AI] notifyHumanHelpRequested falhou: ${(err as Error)?.message}`,
        ),
      );
    }

    if (closeConversation) {
      await this.prisma.whatsappConversation.update({
        where: { id: conv.id },
        data: { status: 'CLOSED' },
      });
    }

    if (cleanText) {
      await this.saveMessage(conv.id, companyId, 'ASSISTANT', cleanText);
      const delay = settings.typingDelay ?? 0;
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      await this.dispatchMessage(connection, conv.customerPhone, cleanText);
    }
  }

  // ── CLAUDE STRUCTURED MODE ────────────────────────────────────────────────

  private async runClaudeStructuredResponse(
    connection: WaConnection,
    settings: WaSettings,
    conv: WaConversation,
    userText: string,
    products: Record<string, unknown>[],
    categories: Record<string, unknown>[],
  ) {
    const companyId = connection.companyId;

    const ctx = (conv.context ?? {}) as Record<string, unknown>;
    const currentCart: CartStatus = {
      itens: (ctx['cart'] as CartStatus['itens']) ?? [],
      itens_identificados:
        (ctx['itens_identificados'] as CartStatus['itens_identificados']) ?? [],
      etapa_atual:
        (ctx['etapa_atual'] as CartStatus['etapa_atual']) ?? 'saudacao',
      pedido_finalizado: (ctx['pedido_finalizado'] as boolean) ?? false,
      endereco: (ctx['endereco'] as string | null) ?? null,
      bairro: (ctx['bairro'] as string | null) ?? null,
      telefone: (ctx['telefone'] as string | null) ?? null,
      formaPagamento: (ctx['formaPagamento'] as string | null) ?? null,
    };

    const historyRaw = await this.prisma.whatsappMessage.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    historyRaw.reverse();

    const conversationHistory: {
      role: 'user' | 'assistant';
      content: string;
    }[] = historyRaw
      .filter((m) => m.role !== 'SYSTEM')
      .map((m) => ({
        role: m.role === 'USER' ? ('user' as const) : ('assistant' as const),
        content: m.content,
      }));

    const menuCtx = this.promptService.buildMenuContext(products, categories);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, slug: true },
    });
    const companyName = company?.name ?? 'nossa loja';
    const attendantName = settings.attendantName ?? 'Atendente';

    let deliveryContext = '';
    try {
      const zones = await this.prisma.deliveryZone.findMany({
        where: { companyId },
      });
      if (zones.length) {
        const lines = zones.map((z) => {
          const fee = Number(
            (z as Record<string, unknown>)['clientFee'] ?? 0,
          ).toFixed(2);
          return `  • ${(z as Record<string, unknown>)['neighborhood'] ?? (z as Record<string, unknown>)['name'] ?? (z as Record<string, unknown>)['type']}: taxa R$${fee}`;
        });
        deliveryContext = `Áreas de entrega disponíveis:\n${lines.join('\n')}`;
      }
    } catch {
      /* zonas opcionais */
    }

    let pizzaBordersContext = '';
    try {
      const borders = (
        this.prisma as unknown as Record<
          string,
          { findMany: (args: unknown) => Promise<Record<string, unknown>[]> }
        >
      )['pizzaBorder'];
      const borderList = await borders.findMany({
        where: { companyId },
        include: { sizes: true },
      });
      if (borderList?.length) {
        const lines = borderList.map((b) => {
          const sizes =
            (b['sizes'] as { size: string; price: unknown }[]) ?? [];
          const prices = sizes
            .map((s) => `${s.size} R$${Number(s.price).toFixed(2)}`)
            .join(' | ');
          return `  • ${b['name']}${prices ? ': ' + prices : ''}`;
        });
        pizzaBordersContext = `Bordas recheadas disponíveis:\n${lines.join('\n')}`;
      }
    } catch {
      /* bordas opcionais */
    }

    const businessHoursInfo = `Horário de atendimento: ${settings.businessHoursStart ?? '08:00'} às ${settings.businessHoursEnd ?? '22:00'} (horário de Brasília). Dias: ${settings.businessDays ?? '1,2,3,4,5,6'}.`;
    const paymentInfo =
      'Formas de pagamento aceitas: PIX (pagamento automático via link), Cartão de Crédito (link seguro), Cartão de Débito (link seguro).';

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
        responseStyle: settings.responseStyle,
        personalityType: settings.personalityType,
        emojiUsage: settings.emojiUsage,
        advancedPersonality: settings.advancedPersonality,
        speechHabits: settings.speechHabits,
        characteristics: settings.characteristics,
        principles: settings.principles,
        humor: settings.humor,
      });
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? '';
      const isQuota = /429|quota|rate.?limit|billing|credit/i.test(msg);
      const isTimeout = /timeout|ETIMEDOUT|AbortError/i.test(msg);
      if (isQuota)
        log.error(
          `[AI] SALDO/QUOTA esgotado em ClaudeCartService (Anthropic+Gemini). conv=${conv.id}: ${msg}`,
        );
      else if (isTimeout)
        log.error(`[AI] TIMEOUT em ClaudeCartService. conv=${conv.id}: ${msg}`);
      else log.error(`[AI] ClaudeCartService error. conv=${conv.id}: ${msg}`);
      const fallback =
        'Desculpe, tive um problema temporário. Pode repetir sua mensagem? 🙏';
      await this.saveMessage(conv.id, companyId, 'ASSISTANT', fallback);
      await this.dispatchMessage(connection, conv.customerPhone, fallback);
      return;
    }

    const { resposta_para_o_cliente, status_carrinho } = structured;

    const newCtx: Record<string, unknown> = {
      ...ctx,
      cart: status_carrinho.itens,
      itens_identificados: status_carrinho.itens_identificados,
      etapa_atual: status_carrinho.etapa_atual,
      pedido_finalizado: status_carrinho.pedido_finalizado,
      endereco: status_carrinho.endereco ?? ctx['endereco'],
      bairro: status_carrinho.bairro ?? ctx['bairro'],
      telefone: status_carrinho.telefone ?? ctx['telefone'],
      formaPagamento: status_carrinho.formaPagamento ?? ctx['formaPagamento'],
    };
    await this.prisma.whatsappConversation.update({
      where: { id: conv.id },
      data: {
        context:
          newCtx as unknown as import('@prisma/client').Prisma.InputJsonValue,
      },
    });

    if (
      status_carrinho.pedido_finalizado &&
      status_carrinho.itens.length > 0 &&
      !ctx['pedido_finalizado']
    ) {
      try {
        const productMap = new Map(products.map((p) => [p['id'] as string, p]));
        const cartForOrder = status_carrinho.itens.map((i) => {
          const prod = productMap.get(i.productId);
          return {
            productId: i.productId,
            name: (prod?.['name'] as string) ?? i.nome,
            price: prod ? Number(prod['salePrice'] ?? 0) : i.preco,
            qty: i.quantidade,
          };
        });

        const orderId = await this.createOrderFromCart(
          companyId,
          cartForOrder,
          {
            deliveryType: status_carrinho.endereco ? 'DELIVERY' : 'PICKUP',
            address: status_carrinho.endereco ?? '',
            phone: status_carrinho.telefone ?? conv.customerPhone,
          },
          conv.customerPhone,
          status_carrinho.formaPagamento ?? undefined,
          conv.customerName ?? undefined,
          status_carrinho.bairro ?? undefined,
        );

        await this.prisma.whatsappConversation.update({
          where: { id: conv.id },
          data: { orderId, status: 'CLOSED' },
        });

        log.log(
          `WhatsApp pedido criado via Claude JSON: orderId=${orderId} conv=${conv.id}`,
        );

        const solicitacao = (structured as unknown as Record<string, unknown>)[
          'solicitacao_pagamento'
        ] as Record<string, unknown> | undefined;
        const rawMetodo: string | null = solicitacao?.['requer_acao']
          ? ((solicitacao['metodo'] ?? status_carrinho.formaPagamento) as
              | string
              | null)
          : (status_carrinho.formaPagamento ?? null);
        const metodo = normalizePaymentMethod(rawMetodo);

        if (metodo && orderId) {
          const orderTotal = cartForOrder.reduce(
            (s, i) => s + i.price * i.qty,
            0,
          );
          const description = cartForOrder
            .map((i) => `${i.qty}x ${i.name}`)
            .join(', ');

          try {
            if (metodo === 'pix') {
              const pix = await this.waPayment.createPix({
                orderId,
                companyId,
                total: orderTotal,
                customerPhone: conv.customerPhone,
                customerName: conv.customerName ?? 'Cliente',
                description,
              });
              const pixMsg = pix.mock
                ? `Aqui está o seu Pix Copia e Cola:\n\`${pix.pixCopyPaste}\`\n\n⏱ Expira em ${PIX_EXPIRATION_MINUTES} minutos. Após o pagamento seu pedido será confirmado automaticamente!`
                : `Aqui está o seu Pix Copia e Cola 💸:\n\`${pix.pixCopyPaste}\`\n\n⏱ Expira em ${PIX_EXPIRATION_MINUTES} minutos. Assim que o pagamento for confirmado, já mandamos o status aqui!`;
              await this.saveMessage(conv.id, companyId, 'ASSISTANT', pixMsg);
              await this.dispatchMessage(
                connection,
                conv.customerPhone,
                pixMsg,
              );
            } else if (metodo === 'credit_card' || metodo === 'debit_card') {
              const linkResult = await this.waPayment.createPaymentLink({
                orderId,
                companyId,
                total: orderTotal,
                description,
                customerName: conv.customerName ?? 'Cliente',
              });
              const methodLabel =
                metodo === 'credit_card'
                  ? 'Cartão de Crédito'
                  : 'Cartão de Débito';
              const linkMsg = `Perfeito! Você pode realizar o pagamento com segurança através deste link oficial 🔒:\n\n${linkResult.paymentUrl}\n\nEssa é a forma de pagamento: *${methodLabel}*. Qualquer dúvida, é só falar! 😊`;
              await this.saveMessage(conv.id, companyId, 'ASSISTANT', linkMsg);
              await this.dispatchMessage(
                connection,
                conv.customerPhone,
                linkMsg,
              );
            }
          } catch (payErr: unknown) {
            log.warn(
              `WaPayment error for order ${orderId}: ${(payErr as Error)?.message}`,
            );
            const fallbackMsg = `Seu pedido foi registrado! 🎉 Em breve enviaremos as instruções de pagamento.`;
            await this.saveMessage(
              conv.id,
              companyId,
              'ASSISTANT',
              fallbackMsg,
            );
            await this.dispatchMessage(
              connection,
              conv.customerPhone,
              fallbackMsg,
            );
          }
        }
      } catch (err: unknown) {
        log.warn(
          `Claude structured — falha ao criar pedido: ${(err as Error)?.message}`,
        );
      }
    }

    if (resposta_para_o_cliente.includes('TRANSFERIR_HUMANO')) {
      await this.prisma.whatsappConversation.update({
        where: { id: conv.id },
        data: { mode: 'HUMAN', status: 'TRANSFERRED' },
      });
      this.notifyHumanHelpRequested(
        connection,
        companyId,
        conv.customerPhone,
        conv.customerName,
        userText,
        conv.id,
      ).catch((err: unknown) =>
        log.warn(
          `[AI] notifyHumanHelpRequested falhou: ${(err as Error)?.message}`,
        ),
      );
    }

    let cleanReply = resposta_para_o_cliente
      .replace('TRANSFERIR_HUMANO', '')
      .trim();

    // Primeira resposta da Kely nesta conversa: sempre acompanha o link do
    // cardápio digital, junto (não em mensagem separada) — pedido explícito
    // do usuário, garantido em código pra não depender do LLM lembrar.
    if (cleanReply && company?.slug) {
      const isFirstReply =
        (await this.prisma.whatsappMessage.count({
          where: { conversationId: conv.id, role: 'ASSISTANT' },
        })) === 0;
      if (isFirstReply) {
        const frontendUrl = this.config.get<string>('FRONTEND_URL');
        if (frontendUrl) {
          cleanReply += `\n\n📋 Nosso cardápio completo: ${frontendUrl.replace(/\/$/, '')}/menu/${company.slug}`;
        }
      }
    }

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
    cart: { productId: string; name: string; price: number; qty: number }[],
    confirmOrder: { deliveryType: string; address: string; phone: string },
    customerPhone: string,
    formaPagamento?: string,
    customerName?: string,
    neighborhood?: string,
  ): Promise<string> {
    if (!this.ordersService) {
      throw new Error(
        '[WA] ordersService indisponível — dependência circular não resolvida',
      );
    }

    const paymentMethodMap: Record<string, string> = {
      pix: 'PIX',
      credit_card: 'CREDIT_CARD',
      debit_card: 'DEBIT_CARD',
    };
    const paymentMethod = paymentMethodMap[formaPagamento ?? ''] ?? 'PIX';

    const order = await this.ordersService.create({
      companyId,
      paymentMethod,
      orderType: confirmOrder.deliveryType === 'PICKUP' ? 'PICKUP' : 'DELIVERY',
      customerPhone,
      customerName: customerName ?? null,
      deliveryAddress: confirmOrder.address || null,
      neighborhood: neighborhood || undefined,
      notes: `Pedido via WhatsApp IA — ${confirmOrder.deliveryType} — ${confirmOrder.address || 'Retirada'} — Tel: ${confirmOrder.phone || customerPhone}`,
      items: cart.map((i) => ({
        productId: i.productId,
        unitPrice: i.price,
        quantity: i.qty,
      })),
    });

    return order.id;
  }

  // ── HELPERS ────────────────────────────────────────────────────────────────

  private async getOrCreateConversation(
    connection: WaConnection,
    phone: string,
    name: string,
  ): Promise<WaConversation> {
    const existing = await this.prisma.whatsappConversation.findUnique({
      where: {
        connectionId_customerPhone: {
          connectionId: connection.id,
          customerPhone: phone,
        },
      },
    });
    if (existing) return existing as unknown as WaConversation;

    return this.prisma.whatsappConversation.create({
      data: {
        connectionId: connection.id,
        companyId: connection.companyId,
        customerPhone: phone,
        customerName: name,
        context: { cart: [], step: 'GREETING' },
      },
    }) as unknown as Promise<WaConversation>;
  }

  private saveMessage(
    conversationId: string,
    companyId: string,
    role: string,
    content: string,
  ) {
    return this.prisma.whatsappMessage.create({
      data: { conversationId, companyId, role, content },
    });
  }

  async sendOrderNotification(params: {
    companyId: string;
    customerPhone: string;
    customerName?: string;
    orderId: string;
    orderType: string;
    total: number;
    items: { name: string; quantity: number }[];
    status:
      | 'CONFIRMED'
      | 'READY'
      | 'OUT_FOR_DELIVERY'
      | 'DELIVERED'
      | 'CANCELLED';
  }) {
    const phone = params.customerPhone?.replace(/\D/g, '');
    if (!phone || phone.length < 8) return;

    let connection: WaConnection | null = null;
    try {
      connection = (await this.prisma.whatsappConnection.findFirst({
        where: { companyId: params.companyId, isActive: true },
        orderBy: { createdAt: 'desc' },
      })) as WaConnection | null;
    } catch {
      return;
    }

    if (!connection) return;

    const statusMsg: Record<string, string> = {
      CONFIRMED: '✅ Pedido confirmado! Estamos preparando.',
      READY: '🟢 Seu pedido está pronto para retirada!',
      OUT_FOR_DELIVERY: '🛵 Seu pedido saiu para entrega!',
      DELIVERED: '🎉 Pedido entregue! Bom apetite!',
      CANCELLED: '❌ Seu pedido foi cancelado.',
    };

    const greeting = params.customerName
      ? `Olá, *${params.customerName}*! `
      : '';
    const itemLines = params.items
      .slice(0, 5)
      .map((i) => `  • ${i.quantity}x ${i.name}`)
      .join('\n');
    const totalFmt = `R$ ${Number(params.total).toFixed(2).replace('.', ',')}`;
    const text = [
      `${greeting}${statusMsg[params.status] ?? 'Status atualizado.'}`,
      `📋 *Pedido #${params.orderId.slice(-6).toUpperCase()}*`,
      itemLines,
      `💰 *Total: ${totalFmt}*`,
      params.orderType === 'DELIVERY'
        ? '📍 Modalidade: Entrega'
        : params.orderType === 'PICKUP'
          ? '📍 Modalidade: Retirada'
          : '',
    ]
      .filter(Boolean)
      .join('\n');

    await this.dispatchMessage(connection, phone, text);
  }

  /**
   * Avisa o dono da loja (WhatsApp + e-mail) quando um cliente pede
   * atendimento humano — antes disso a IA só marcava a conversa como
   * "TRANSFERRED" no banco, sem nenhum aviso ativo (só via se entrasse
   * manualmente na tela de Conversas).
   */
  private async notifyHumanHelpRequested(
    connection: WaConnection,
    companyId: string,
    customerPhone: string,
    customerName: string | null | undefined,
    lastMessage: string,
    conversationId?: string,
  ) {
    // Alerta sonoro em tempo real pro time (ClientShell.tsx escuta esse
    // evento em qualquer tela do painel, não só na aba Conversas — cliente
    // pedindo humano/gerente não pode depender de alguém estar de olho
    // na tela certa).
    this.socketGateway?.emitHumanHelpRequested(companyId, {
      conversationId: conversationId ?? '',
      customerPhone,
      customerName,
      lastMessage,
    });

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, email: true, whatsapp: true, phone: true },
    });

    const notice =
      `⚠️ *Atendimento Humano Solicitado*\n\n` +
      `Cliente: ${customerName || customerPhone}\n` +
      `Telefone: ${customerPhone}\n` +
      `Mensagem: "${lastMessage}"\n\n` +
      `Acesse "Configurar IA → Conversas" ou responda direto no WhatsApp.`;

    const ownerWhatsapp = company?.whatsapp || company?.phone || undefined;
    if (ownerWhatsapp) {
      this.dispatchMessage(connection, ownerWhatsapp, notice).catch(
        (err: unknown) =>
          log.warn(
            `[AI] Falha ao notificar dono via WhatsApp: ${(err as Error)?.message}`,
          ),
      );
    }

    // Fallback: env vars globais (NOTIFY_WHATSAPP_NUMBER é a já usada para
    // avisos de dono em outros fluxos — signup, trial; WHATSAPP_OPERATOR_PHONE
    // é o nome legado). Útil quando a empresa não tem whatsapp/phone cadastrado
    // — evita não notificar ninguém.
    const operatorPhone =
      this.config.get<string>('NOTIFY_WHATSAPP_NUMBER') ||
      this.config.get<string>('WHATSAPP_OPERATOR_PHONE');
    if (operatorPhone && operatorPhone !== ownerWhatsapp) {
      this.dispatchMessage(connection, operatorPhone, notice).catch(
        (err: unknown) =>
          log.warn(
            `[AI] Falha ao notificar operador (env): ${(err as Error)?.message}`,
          ),
      );
    }

    // Empresa matriz ("Ruffinu's Pizzaria", uso interno de dogfooding) tem
    // email cadastrado platform@foodsaas.internal — não é caixa monitorada.
    // Usa ADMIN_NOTIFY_EMAIL (a mesma caixa já usada pra leads/signups) nesse caso.
    const notifyEmail = isMatrixCompany(companyId)
      ? this.config.get<string>('ADMIN_NOTIFY_EMAIL') || company?.email
      : company?.email;

    if (notifyEmail && this.notificationsService) {
      this.notificationsService
        .send({
          to: notifyEmail,
          type: 'HUMAN_HELP_REQUESTED',
          data: {
            companyName: company?.name,
            customerName,
            customerPhone,
            lastMessage,
          },
        })
        .catch((err: unknown) =>
          log.warn(
            `[AI] Falha ao notificar dono via e-mail: ${(err as Error)?.message}`,
          ),
        );
    }
  }

  // ─── Feedback pós-entrega + Google Review condicional ──────────────────────
  //
  // Fluxo: DELIVERED → requestDeliveryFeedback() manda "como foi a pizza?" e
  // grava um DeliveryFeedback pendente. A resposta do cliente é interceptada
  // em _processIncomingWithConnection() ANTES da IA (tryHandleFeedbackReply);
  // se for reclamação, o link do Google NUNCA é enviado — só um pedido de
  // desculpas + alerta pro time (reusa o mesmo canal sonoro de "cliente pediu
  // humano"). Se for elogio/neutro, manda o link na hora. Se o cliente não
  // responder nada, o cron sendPendingFeedbackReviewLinks() manda o link
  // sozinho depois de 2h.

  /**
   * Dispara a pergunta de satisfação pós-entrega. Só roda se a empresa tiver
   * Google Review configurado (sem isso não há pra onde direcionar o elogio)
   * e uma conexão WhatsApp ativa. Idempotente por (orderSource, orderId).
   */
  async requestDeliveryFeedback(params: {
    companyId: string;
    orderId: string;
    orderSource: 'PDV' | 'ONLINE';
    customerPhone: string;
    customerName?: string | null;
  }): Promise<void> {
    try {
      const company = await this.prisma.company.findUnique({
        where: { id: params.companyId },
        select: { googleReviewUrl: true },
      });
      if (!company?.googleReviewUrl) return;

      const raw = params.customerPhone.replace(/\D/g, '');
      if (!raw || raw.length < 8) return;

      const connection = (await this.prisma.whatsappConnection.findFirst({
        where: { companyId: params.companyId, isActive: true },
        orderBy: { createdAt: 'desc' },
      })) as WaConnection | null;
      if (!connection) {
        log.warn(
          `[feedback] sem conexão WhatsApp ativa — pedido de feedback não enviado (order=${params.orderId})`,
        );
        return;
      }

      const existing = await (this.prisma as any).deliveryFeedback
        .findUnique({
          where: {
            orderSource_orderId: {
              orderSource: params.orderSource,
              orderId: params.orderId,
            },
          },
        })
        .catch(() => null);
      if (existing) return; // já pedimos feedback pra este pedido

      const firstName = params.customerName
        ? params.customerName.split(' ')[0]
        : '';
      const msg =
        `🍕 Oi${firstName ? ` ${firstName}` : ''}! Seu pedido foi entregue!\n\n` +
        `Como ficou? Conta pra gente — elogio, sugestão ou o que achar, sua opinião nos ajuda a melhorar sempre! 🙏`;

      const sent = await this.dispatchMessage(connection, raw, msg);
      if (!sent) return;

      await (this.prisma as any).deliveryFeedback.create({
        data: {
          companyId: params.companyId,
          orderSource: params.orderSource,
          orderId: params.orderId,
          customerPhone: raw,
          customerName: params.customerName ?? null,
        },
      });
    } catch (err: any) {
      log.warn(
        `[feedback] requestDeliveryFeedback falhou (order=${params.orderId}): ${err?.message}`,
      );
    }
  }

  /**
   * Classificação determinística por palavra-chave — sem custo de IA extra e
   * sem depender de outra API externa poder falhar. Qualquer coisa que não
   * bata uma palavra negativa é tratada como positiva/neutra (mesma regra
   * pedida: "se não responder nada ou se elogiar, manda o link").
   */
  private classifyFeedbackSentiment(text: string): 'POSITIVE' | 'NEGATIVE' {
    const t = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
    const NEGATIVE_KEYWORDS = [
      'ruim', 'pessim', 'horrivel', 'reclama', 'problema', 'atraso', 'atrasou',
      'fria', 'frio', 'errado', 'errada', 'faltou', 'faltando', 'nao gostei',
      'demorou muito', 'cancelar', 'insatisf', 'decepcion', 'nao voltou',
      'nao recomendo', 'lixo', 'nojent', 'estragad', 'mal feit', 'mal-feit',
      'queimad', 'crua', 'sem gosto', 'sem sabor', 'nao chegou', 'cade meu',
      'cade o meu', 'ate agora nada', 'nunca mais', 'pessimo atendimento',
      'nota 1', 'nota 2', 'nota 0', 'detestei', 'odiei',
    ];
    return NEGATIVE_KEYWORDS.some((kw) => t.includes(kw))
      ? 'NEGATIVE'
      : 'POSITIVE';
  }

  /**
   * Intercepta a resposta do cliente quando há um DeliveryFeedback pendente
   * pro mesmo telefone/empresa (janela de 24h). Retorna true se tratou a
   * mensagem aqui (o caller deve parar o processamento normal da IA).
   */
  private async tryHandleFeedbackReply(
    companyId: string,
    phoneDigitsRaw: string,
    text: string,
  ): Promise<boolean> {
    try {
      const suffix = phoneDigitsRaw.replace(/\D/g, '').slice(-8);
      if (suffix.length < 8) return false;

      const pending = await (this.prisma as any).deliveryFeedback.findFirst({
        where: {
          companyId,
          respondedAt: null,
          requestedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          customerPhone: { endsWith: suffix },
        },
        orderBy: { requestedAt: 'desc' },
      });
      if (!pending) return false;

      const sentiment = this.classifyFeedbackSentiment(text);
      await (this.prisma as any).deliveryFeedback.update({
        where: { id: pending.id },
        data: {
          respondedAt: new Date(),
          responseText: text.slice(0, 1000),
          sentiment,
        },
      });

      const connection = (await this.prisma.whatsappConnection.findFirst({
        where: { companyId, isActive: true },
        orderBy: { createdAt: 'desc' },
      })) as WaConnection | null;
      if (!connection) return true;

      if (sentiment === 'NEGATIVE') {
        await this.dispatchMessage(
          connection,
          phoneDigitsRaw,
          'Poxa, sentimos muito 💔 Sua opinião é muito importante — nossa equipe já foi avisada e vai entrar em contato pra resolver. Obrigado por nos contar!',
        );
        try {
          this.socketGateway?.emitHumanHelpRequested(companyId, {
            conversationId: pending.id,
            customerPhone: phoneDigitsRaw,
            customerName: pending.customerName ?? undefined,
            lastMessage: `⚠️ Feedback negativo pós-entrega: "${text.slice(0, 200)}"`,
          });
        } catch {
          /* socket failure não deve derrubar o fluxo */
        }
        return true;
      }

      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { googleReviewUrl: true },
      });
      if (company?.googleReviewUrl) {
        await this.dispatchMessage(
          connection,
          phoneDigitsRaw,
          `Que ótimo saber disso! 🙌 Se puder, deixa uma avaliação rápida pra gente — ajuda muito!\n\n👉 ${company.googleReviewUrl}`,
        );
        await (this.prisma as any).deliveryFeedback.update({
          where: { id: pending.id },
          data: { reviewLinkSent: true },
        });
      } else {
        await this.dispatchMessage(
          connection,
          phoneDigitsRaw,
          'Que bom! Obrigado pelo retorno 🙏',
        );
      }
      return true;
    } catch (err: any) {
      log.warn(`[feedback] tryHandleFeedbackReply falhou: ${err?.message}`);
      return false;
    }
  }

  /**
   * Cron de segurança: se o cliente não responder a pergunta de feedback em
   * 2h, manda o link do Google mesmo assim (regra pedida: silêncio == ok).
   * Janela superior de 26h evita reprocessar pedidos de feedback muito
   * antigos (ex.: se o cron ficou parado por um tempo).
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async sendPendingFeedbackReviewLinks(): Promise<void> {
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const floor = new Date(Date.now() - 26 * 60 * 60 * 1000);
    let pending: any[] = [];
    try {
      pending = await (this.prisma as any).deliveryFeedback.findMany({
        where: {
          respondedAt: null,
          reviewLinkSent: false,
          requestedAt: { lte: cutoff, gte: floor },
        },
        take: 100,
      });
    } catch {
      return; // tabela pode não existir ainda logo após deploy (migration pendente)
    }
    if (pending.length === 0) return;

    for (const fb of pending) {
      try {
        const company = await this.prisma.company.findUnique({
          where: { id: fb.companyId },
          select: { googleReviewUrl: true },
        });
        if (!company?.googleReviewUrl) {
          await (this.prisma as any).deliveryFeedback.update({
            where: { id: fb.id },
            data: { respondedAt: new Date() },
          });
          continue;
        }
        const connection = (await this.prisma.whatsappConnection.findFirst({
          where: { companyId: fb.companyId, isActive: true },
          orderBy: { createdAt: 'desc' },
        })) as WaConnection | null;
        if (!connection) continue;

        const firstName = fb.customerName ? fb.customerName.split(' ')[0] : '';
        const msg =
          `Oi${firstName ? ` ${firstName}` : ''}! Espero que tenha gostado do pedido 😊 Se puder, deixa uma avaliação rápida pra gente:\n\n` +
          `👉 ${company.googleReviewUrl}`;
        const sent = await this.dispatchMessage(connection, fb.customerPhone, msg);
        if (sent) {
          await (this.prisma as any).deliveryFeedback.update({
            where: { id: fb.id },
            data: { reviewLinkSent: true, respondedAt: new Date() },
          });
        }
      } catch (err: any) {
        log.warn(
          `[feedback] cron follow-up falhou order=${fb.orderId}: ${err?.message}`,
        );
      }
    }
  }

  /**
   * Envia mensagem de texto avulsa pelo primeiro WhatsApp ativo da empresa.
   * Retorna true só quando o dispatch realmente foi tentado com sucesso —
   * usado por quem precisa de rastreamento real de entrega (ex.: campanhas
   * recorrentes), não apenas notificações "melhor esforço".
   */
  async sendTextMessage(companyId: string, phone: string, text: string): Promise<boolean> {
    const raw = phone.replace(/\D/g, '');
    if (!raw || raw.length < 8) return false;
    let connection: WaConnection | null = null;
    try {
      connection = (await this.prisma.whatsappConnection.findFirst({
        where: { companyId, isActive: true },
        orderBy: { createdAt: 'desc' },
      })) as WaConnection | null;
    } catch { return false; }
    if (!connection) return false;
    return this.dispatchMessage(connection, raw, text);
  }

  /**
   * Igual a sendTextMessage, mas com imagem — usado pelas campanhas
   * recorrentes quando o admin anexa uma foto. Provider CLOUD_API (Meta)
   * ainda não suporta envio de mídia aqui (exige upload prévio pra pegar um
   * media ID) — cai pra texto puro nesse caso, com aviso no log, em vez de
   * simplesmente falhar o envio inteiro.
   */
  async sendMediaMessage(
    companyId: string,
    phone: string,
    imageUrl: string,
    caption: string,
  ): Promise<boolean> {
    const raw = phone.replace(/\D/g, '');
    if (!raw || raw.length < 8) return false;
    let connection: WaConnection | null = null;
    try {
      connection = (await this.prisma.whatsappConnection.findFirst({
        where: { companyId, isActive: true },
        orderBy: { createdAt: 'desc' },
      })) as WaConnection | null;
    } catch { return false; }
    if (!connection) return false;

    if (connection.provider !== 'EVOLUTION') {
      log.warn(
        `[sendMediaMessage] Connection ${connection.id}: provider "${connection.provider}" não suporta mídia aqui — enviando só o texto.`,
      );
      return this.dispatchMessage(connection, raw, caption);
    }
    if (!connection.apiUrl || !connection.instanceName) {
      log.error(
        `[sendMediaMessage] Connection ${connection.id} misconfigured: missing apiUrl or instanceName`,
      );
      return false;
    }
    try {
      await sendEvolutionMedia(
        connection.apiUrl,
        connection.instanceName,
        connection.apiToken ?? '',
        raw,
        imageUrl,
        caption,
      );
      return true;
    } catch (err: unknown) {
      log.error(
        `[sendMediaMessage] Connection ${connection.id} send failed: ${(err as Error)?.message}`,
      );
      return false;
    }
  }

  private async dispatchMessage(
    connection: WaConnection,
    phone: string,
    text: string,
  ): Promise<boolean> {
    try {
      if (connection.provider === 'EVOLUTION') {
        if (!connection.apiUrl || !connection.instanceName) {
          log.error(
            `[dispatchMessage] Connection ${connection.id} misconfigured: missing apiUrl or instanceName`,
          );
          return false;
        }
        await sendEvolution(
          connection.apiUrl,
          connection.instanceName,
          connection.apiToken ?? '',
          phone,
          text,
        );
      } else if (connection.provider === 'CLOUD_API') {
        if (!connection.phoneNumberId) {
          log.error(
            `[dispatchMessage] Connection ${connection.id} misconfigured: missing phoneNumberId`,
          );
          return false;
        }
        await sendCloudApi(
          connection.phoneNumberId,
          connection.apiToken ?? '',
          phone,
          text,
        );
      } else {
        log.error(
          `[dispatchMessage] Connection ${connection.id}: unsupported provider "${connection.provider}"`,
        );
        return false;
      }
      return true;
    } catch (err: unknown) {
      log.error(
        `[dispatchMessage] Connection ${connection.id} send failed: ${(err as Error)?.message}`,
      );
      return false;
    }
  }

  // ── BRIDGE (para script local Baileys) ─────────────────────────────────────

  async getBridgeOutbox(connectionId: string, afterId?: string) {
    const since = new Date(Date.now() - 30_000);

    const messages = await this.prisma.whatsappMessage.findMany({
      where: {
        conversation: { connectionId },
        role: 'ASSISTANT',
        createdAt: { gte: since },
        ...(afterId ? { id: { gt: afterId } } : {}),
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        conversation: { select: { customerPhone: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    return messages.map((m) => ({
      id: m.id,
      phone: m.conversation?.customerPhone,
      text: m.content,
      createdAt: m.createdAt,
    }));
  }

  // ── MERCADO PAGO WEBHOOK (WhatsApp orders) ────────────────────────────────

  async handleMpPaymentWebhook(
    body: Record<string, unknown>,
    query: Record<string, unknown>,
  ): Promise<void> {
    const mpPaymentId =
      (body?.data as Record<string, unknown>)?.id ?? query?.id;
    if (!mpPaymentId) return;

    const accessToken = (this.waPayment as unknown as Record<string, unknown>)[
      'accessToken'
    ] as string | undefined;
    if (!accessToken) return;

    let mp: Record<string, unknown>;
    try {
      const res = await fetch(
        `https://api.mercadopago.com/v1/payments/${mpPaymentId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(15_000),
        },
      );
      mp = (await res.json()) as Record<string, unknown>;
    } catch (err: unknown) {
      log.warn(
        `[WA MP Webhook] fetch payment error: ${(err as Error)?.message}`,
      );
      return;
    }

    const ref = (mp['external_reference'] as string) ?? '';
    if (!ref.startsWith('WA_ORDER|')) return;

    const [, orderId, companyId] = ref.split('|');
    if (!orderId || !companyId) return;

    if (mp['status'] !== 'approved') return;

    const existingOrder = await this.prisma.order.findFirst({
      where: { id: orderId },
      select: { status: true },
    });
    if (!existingOrder) {
      log.warn(`[WA MP Webhook] Order ${orderId} not found — skipping`);
      return;
    }
    if (existingOrder.status === OrderStatus.CONFIRMED) {
      log.log(
        `[WA MP Webhook] Order ${orderId} already CONFIRMED — idempotency skip`,
      );
      return;
    }

    try {
      if (this.ordersService) {
        await this.ordersService.updateStatus(
          orderId,
          OrderStatus.CONFIRMED,
          'SYSTEM',
          companyId,
        );
      } else {
        await this.prisma.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.CONFIRMED },
        });
      }
      log.log(
        `[WA MP Webhook] Order ${orderId} CONFIRMED after payment ${String(mpPaymentId)}`,
      );
    } catch (err: unknown) {
      log.warn(
        `[WA MP Webhook] order update error: ${(err as Error)?.message}`,
      );
      return;
    }

    try {
      const conv = await this.prisma.whatsappConversation.findFirst({
        where: { orderId, companyId },
        include: { connection: true },
      });
      if (conv?.customerPhone) {
        const msg = `✅ Pagamento confirmado! Seu pedido #${orderId.slice(-6).toUpperCase()} está em preparo. Avisaremos quando estiver pronto! 🍕`;
        await this.saveMessage(conv.id, companyId, 'ASSISTANT', msg);
        await this.dispatchMessage(
          conv.connection as unknown as WaConnection,
          conv.customerPhone,
          msg,
        );
      }
    } catch (err: unknown) {
      log.warn(
        `[WA MP Webhook] notification error: ${(err as Error)?.message}`,
      );
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
