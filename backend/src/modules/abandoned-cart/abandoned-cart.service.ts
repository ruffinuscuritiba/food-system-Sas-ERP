import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@/database/prisma.service';
import { CompanyService } from '@/modules/company/company.service';
import { WhatsappAiService } from '@/modules/whatsapp-ai/whatsapp-ai.service';

const REMINDER_AFTER_MINUTES = 30;
// Nunca processa um lote gigante numa única passada do cron — proteção
// contra pico incomum, não um limite de produto real (uma loja rodando
// nesse volume de carrinhos abandonados por hora seria notícia boa).
const BATCH_LIMIT = 200;

interface TrackItem {
  name: string;
  quantity: number;
}

@Injectable()
export class AbandonedCartService {
  private readonly logger = new Logger(AbandonedCartService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companyService: CompanyService,
    @Optional() private readonly whatsappAi?: WhatsappAiService,
  ) {}

  /**
   * Chamado pelo cardápio digital a cada mudança de carrinho/telefone
   * enquanto o checkout está aberto (debounced no frontend). Atualiza o
   * episódio em aberto (se existir) em vez de criar um novo a cada chamada —
   * senão o cron veria dezenas de linhas idênticas pro mesmo cliente digitando.
   */
  async track(
    companySlugOrId: string,
    rawPhone: string,
    customerName: string | undefined,
    items: TrackItem[],
    total: number,
  ) {
    const phone = String(rawPhone ?? '').replace(/\D/g, '');
    if (phone.length < 8 || !Array.isArray(items) || items.length === 0) {
      return { ok: false };
    }
    const companyId = await this.companyService.resolveId(companySlugOrId);
    if (!companyId) return { ok: false };

    const last8 = phone.slice(-8);
    const open = await this.prisma.abandonedCart.findFirst({
      where: {
        companyId,
        phone: { endsWith: last8 },
        recoveredAt: null,
        notifiedAt: null,
      },
      orderBy: { lastActivityAt: 'desc' },
    });

    const data = {
      customerName: customerName?.trim() || null,
      items: items.map((i) => ({ name: String(i.name).slice(0, 120), quantity: Number(i.quantity) || 1 })),
      total: Number(total) || 0,
      lastActivityAt: new Date(),
    };

    if (open) {
      await this.prisma.abandonedCart.update({ where: { id: open.id }, data });
    } else {
      await this.prisma.abandonedCart.create({ data: { companyId, phone, ...data } });
    }
    return { ok: true };
  }

  /**
   * Chamado depois que um pedido real é criado (PDV, WhatsApp/Kely ou o
   * próprio cardápio) — fecha qualquer episódio em aberto pro mesmo
   * telefone, pra nunca mandar o lembrete de "você esqueceu algo" pra quem
   * já finalizou a compra. Fire-and-forget nos callers.
   */
  async markRecovered(companyId: string, rawPhone: string | null | undefined) {
    const phone = String(rawPhone ?? '').replace(/\D/g, '');
    if (phone.length < 8 || !companyId) return;
    const last8 = phone.slice(-8);
    await this.prisma.abandonedCart.updateMany({
      where: { companyId, phone: { endsWith: last8 }, recoveredAt: null },
      data: { recoveredAt: new Date() },
    });
  }

  @Cron('*/5 * * * *')
  async sendReminders() {
    const threshold = new Date(Date.now() - REMINDER_AFTER_MINUTES * 60 * 1000);
    const pending = await this.prisma.abandonedCart.findMany({
      where: { recoveredAt: null, notifiedAt: null, lastActivityAt: { lte: threshold } },
      include: { company: { select: { slug: true, id: true, name: true } } },
      take: BATCH_LIMIT,
      orderBy: { lastActivityAt: 'asc' },
    });
    if (pending.length === 0) return;

    this.logger.log(`[CarrinhoAbandonado] ${pending.length} carrinho(s) elegível(is) pra lembrete`);

    for (const cart of pending) {
      try {
        const message = this.buildMessage(cart);
        const sent = this.whatsappAi
          ? await this.whatsappAi.sendTextMessage(cart.companyId, cart.phone, message)
          : false;
        // Marca notifiedAt independente do resultado do envio — é um único
        // lembrete por episódio, nunca fica reprocessando indefinidamente se
        // a conexão de WhatsApp estiver fora do ar naquele momento.
        await this.prisma.abandonedCart.update({
          where: { id: cart.id },
          data: { notifiedAt: new Date() },
        });
        if (!sent) {
          this.logger.warn(`[CarrinhoAbandonado] falha ao enviar (id=${cart.id}, phone=${cart.phone})`);
        }
      } catch (e: any) {
        this.logger.warn(`[CarrinhoAbandonado] erro processando id=${cart.id}: ${e?.message}`);
      }
    }
  }

  private buildMessage(cart: {
    customerName: string | null;
    items: unknown;
    total: unknown;
    company: { slug: string | null; id: string; name: string };
  }): string {
    const firstName = (cart.customerName || '').trim().split(' ')[0] || 'tudo bem';
    const items = Array.isArray(cart.items) ? (cart.items as TrackItem[]) : [];
    const itemsList = items
      .slice(0, 3)
      .map((i) => (i.quantity > 1 ? `${i.quantity}x ${i.name}` : i.name))
      .join(', ');
    const extra = items.length > 3 ? ` e mais ${items.length - 3} item(ns)` : '';
    const total = Number(cart.total) || 0;
    const frontendUrl = process.env.FRONTEND_URL || 'https://food-system-sas-erp-frontend.vercel.app';
    const link = `${frontendUrl}/menu/${cart.company.slug || cart.company.id}`;

    return (
      `Oi ${firstName}! 👋 Vimos que você tava escolhendo ${itemsList}${extra} ` +
      `(total ~R$ ${total.toFixed(2).replace('.', ',')}) mas não finalizou o pedido.\n\n` +
      `Ainda dá tempo! Toque aqui pra voltar: ${link}\n\n` +
      `Se precisar de ajuda, é só chamar por aqui mesmo 🍕`
    );
  }
}
