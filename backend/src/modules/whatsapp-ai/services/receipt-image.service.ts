import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const log = new Logger('ReceiptImageService');

/**
 * ReceiptImageService — gera um cupom/recibo estilizado (fundo creme, visual
 * de papel de impressora) como imagem PNG, pra ser enviado como mídia no
 * WhatsApp em vez da mensagem de texto puro. WhatsApp não permite customizar
 * cor de fundo de mensagem de texto — a única forma de ter esse visual é
 * renderizar uma imagem de verdade.
 *
 * Usa satori (layout flexbox → SVG, sem browser/Chromium) + resvg (SVG → PNG),
 * ambos leves o suficiente pro VPS de 512MB. As fontes (JetBrains Mono
 * Regular/Bold) são arquivos .ttf estáticos embutidos no módulo — nunca
 * baixadas em runtime — decodificados uma única vez de .woff2 pra .ttf
 * durante o desenvolvimento (ver histórico do commit).
 */

export interface ReceiptItemComplement {
  name: string;
  price: number;
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice?: number;
  /** Category.categoryType do produto — usado só pra agrupar em seções
   * (PIZZAS/LANCHES/BEBIDAS). Ausente ou desconhecido = seção "ITENS". */
  categoryType?: string | null;
  complements?: ReceiptItemComplement[];
}

export interface ReceiptImageParams {
  companyName: string;
  cnpj?: string | null;
  addressLine?: string | null;
  orderId: string;
  orderTypeLabel: string;
  createdAt: Date;
  customerName?: string | null;
  deliveryAddress?: string | null;
  items: ReceiptItem[];
  subtotalLabel?: string | null;
  deliveryFeeLabel?: string | null;
  discountLabel?: string | null;
  totalLabel: string;
  paymentLabel: string;
  websiteFooter?: string | null;
}

const WIDTH = 420;
const PADDING = 26;
const BG = '#FBF3E0';
const INK = '#2b2620';
const MUTED = '#8a7f6a';
const DASH_COLOR = '#c9bd9e';
const GOLD = '#c9a227';
const FONT_FAMILY = 'Receipt Mono';

const CATEGORY_LABELS: Record<string, string> = {
  pizza: 'PIZZAS',
  lanche: 'LANCHES',
  bebidas: 'BEBIDAS',
};
// Ordem de exibição das seções — comida primeiro, bebida sempre por último.
const CATEGORY_ORDER = ['pizza', 'lanche', 'normal', 'bebidas'];

/** Constrói um elemento no formato que o satori entende (plain object tree —
 * satori aceita isso sem precisar de JSX nem do pacote `react` de verdade). */
function h(type: string, props: Record<string, any> = {}): any {
  return { type, props };
}

function money(v: number): string {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

function formatDateTime(d: Date): string {
  return d
    .toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(',', '');
}

function dashedLine(): any {
  return h('div', {
    style: {
      display: 'flex',
      width: '100%',
      borderBottom: `2px dashed ${DASH_COLOR}`,
      margin: '10px 0 10px 0',
    },
  });
}

/** Desenha 5 "estrelas" como losangos (diamond shapes via CSS rotate) em vez
 * do glifo Unicode ★ — a fonte monoespaçada usada aqui (JetBrains Mono, sem
 * fallback de sistema no container) não tem esse glifo, renderizava como
 * caixa vazia/tofu. Forma geométrica funciona independente de cobertura de
 * fonte. */
function starsRow(): any {
  const diamond = () =>
    h('div', {
      style: {
        display: 'flex',
        width: 9,
        height: 9,
        marginLeft: 5,
        marginRight: 5,
        backgroundColor: GOLD,
        transform: 'rotate(45deg)',
      },
    });
  return h('div', {
    style: { display: 'flex', flexDirection: 'row', marginTop: 10 },
    children: [diamond(), diamond(), diamond(), diamond(), diamond()],
  });
}

function textRow(left: string, right: string, extraStyle: Record<string, any> = {}): any {
  return h('div', {
    style: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      ...extraStyle,
    },
    children: [
      h('span', { style: {}, children: left }),
      h('span', { style: {}, children: right }),
    ],
  });
}

@Injectable()
export class ReceiptImageService {
  private regularFont: Buffer | null = null;
  private boldFont: Buffer | null = null;
  private regularFontPath = '';
  private boldFontPath = '';

  private loadFonts(): void {
    if (this.regularFont && this.boldFont) return;
    const dir = path.join(__dirname, '..', 'assets', 'fonts');
    this.regularFontPath = path.join(dir, 'JetBrainsMono-Regular.ttf');
    this.boldFontPath = path.join(dir, 'JetBrainsMono-Bold.ttf');
    this.regularFont = fs.readFileSync(this.regularFontPath);
    this.boldFont = fs.readFileSync(this.boldFontPath);
  }

  private groupByCategory(
    items: ReceiptItem[],
  ): { key: string; items: ReceiptItem[] }[] {
    const map = new Map<string, ReceiptItem[]>();
    for (const item of items) {
      const key =
        item.categoryType && CATEGORY_LABELS[item.categoryType]
          ? item.categoryType
          : 'normal';
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return CATEGORY_ORDER.filter((k) => map.has(k)).map((k) => ({
      key: k,
      items: map.get(k)!,
    }));
  }

  /**
   * Estimativa de altura total do cupom em px. Satori exige width/height
   * fixos no momento da renderização (não redimensiona pra caber o
   * conteúdo sozinho) — por isso calculamos aqui usando as mesmas
   * constantes de espaçamento usadas no layout real. Sempre erra pra MAIS
   * (+40px de margem de segurança no final): sobrar fundo creme em branco
   * é inofensivo, cortar conteúdo não é.
   */
  private estimateHeight(
    params: ReceiptImageParams,
    buckets: { key: string; items: ReceiptItem[] }[],
  ): number {
    let height = PADDING * 2;
    height += 30; // nome da loja
    if (params.cnpj) height += 15;
    if (params.addressLine) height += 15;
    height += 22; // separador

    height += 22; // PEDIDO #
    height += 18; // data/hora
    height += 24; // badge do tipo
    if (params.customerName) height += 20;
    if (params.deliveryAddress) {
      height += 18 * Math.max(1, Math.ceil(params.deliveryAddress.length / 46));
    }
    height += 22; // separador

    const showHeaders = buckets.length > 1;
    for (const bucket of buckets) {
      if (showHeaders) height += 26;
      for (const item of bucket.items) {
        // Nome quebra em várias linhas quando é longo (ver fix do overlap
        // com o preço, mesma correção) — sem contar isso aqui, o rodapé do
        // cupom (estrelas/link) podia ficar cortado pra fora da imagem.
        const nameText = `${item.quantity}x ${item.name}`;
        const nameLines = Math.max(1, Math.ceil(nameText.length / 32));
        height += 22 + (nameLines - 1) * 16;
        height += (item.complements?.length ?? 0) * 16;
      }
    }
    height += 22; // separador

    if (params.subtotalLabel) height += 18;
    if (params.deliveryFeeLabel) height += 18;
    if (params.discountLabel) height += 18;
    height += 30; // total
    height += 20; // pagamento
    height += 22; // separador

    height += 20; // obrigado
    height += 28; // estrelas
    if (params.websiteFooter) height += 16;

    return Math.round(height) + 40;
  }

  async render(params: ReceiptImageParams): Promise<Buffer> {
    this.loadFonts();
    const buckets = this.groupByCategory(params.items);
    const showHeaders = buckets.length > 1;
    const height = this.estimateHeight(params, buckets);

    const children: any[] = [];

    // ── Cabeçalho ──────────────────────────────────────────────────────────
    children.push(
      h('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
        },
        children: [
          h('div', {
            style: { fontSize: 22, fontWeight: 700, letterSpacing: 1 },
            children: params.companyName.toUpperCase(),
          }),
          ...(params.cnpj
            ? [
                h('div', {
                  style: { fontSize: 11, color: MUTED, marginTop: 6 },
                  children: `CNPJ: ${params.cnpj}`,
                }),
              ]
            : []),
          ...(params.addressLine
            ? [
                h('div', {
                  style: { fontSize: 11, color: MUTED, marginTop: 2 },
                  children: params.addressLine,
                }),
              ]
            : []),
        ],
      }),
    );
    children.push(dashedLine());

    // ── Dados do pedido ──────────────────────────────────────────────────────
    const orderInfoChildren: any[] = [
      h('div', {
        style: { fontSize: 15, fontWeight: 700 },
        children: `PEDIDO #${params.orderId}`,
      }),
      h('div', {
        style: { fontSize: 11, color: MUTED, marginTop: 4 },
        children: formatDateTime(params.createdAt),
      }),
      h('div', {
        style: {
          display: 'flex',
          fontSize: 11,
          fontWeight: 700,
          color: INK,
          border: `1px solid ${INK}`,
          borderRadius: 4,
          padding: '2px 8px',
          marginTop: 8,
          alignSelf: 'flex-start',
        },
        children: params.orderTypeLabel,
      }),
    ];
    if (params.customerName) {
      orderInfoChildren.push(
        h('div', {
          style: { fontSize: 12, marginTop: 10 },
          children: `Cliente: ${params.customerName}`,
        }),
      );
    }
    if (params.deliveryAddress) {
      orderInfoChildren.push(
        h('div', {
          style: { fontSize: 12, marginTop: 2 },
          children: params.deliveryAddress,
        }),
      );
    }
    children.push(
      h('div', {
        style: { display: 'flex', flexDirection: 'column', width: '100%' },
        children: orderInfoChildren,
      }),
    );
    children.push(dashedLine());

    // ── Itens (agrupados por categoria quando há mais de uma) ────────────────
    for (const bucket of buckets) {
      if (showHeaders) {
        children.push(
          h('div', {
            style: {
              display: 'flex',
              width: '100%',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
              margin: '4px 0 8px 0',
            },
            children: `--- ${CATEGORY_LABELS[bucket.key] ?? 'ITENS'} ---`,
          }),
        );
      }
      for (const item of bucket.items) {
        const priceStr =
          item.unitPrice != null ? money(item.unitPrice * item.quantity) : '';
        children.push(
          h('div', {
            style: {
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'space-between',
              width: '100%',
              fontSize: 13,
              fontWeight: 700,
              marginTop: 6,
            },
            children: [
              // Nome sem `flex`/largura própria deixava o texto invadir a
              // coluna do preço em nomes longos (satori/yoga não quebra
              // linha de um filho flex sem tamanho definido) — achado real:
              // "Calabresa com alho e batata" sobrepondo "R$ 67,99".
              h('span', {
                style: { flex: '1 1 auto', minWidth: 0, paddingRight: 8 },
                children: `${item.quantity}x ${item.name}`,
              }),
              h('span', {
                style: { flexShrink: 0 },
                children: priceStr,
              }),
            ],
          }),
        );
        for (const comp of item.complements ?? []) {
          children.push(
            h('div', {
              style: {
                display: 'flex',
                fontSize: 11,
                fontStyle: 'italic',
                color: MUTED,
                marginLeft: 14,
                marginTop: 2,
              },
              children:
                comp.price > 0
                  ? `+ ${comp.name} (${money(comp.price)})`
                  : `+ ${comp.name}`,
            }),
          );
        }
      }
    }
    children.push(dashedLine());

    // ── Totais ────────────────────────────────────────────────────────────
    const totalsChildren: any[] = [];
    if (params.subtotalLabel) {
      totalsChildren.push(textRow('Subtotal', params.subtotalLabel, { fontSize: 12 }));
    }
    if (params.deliveryFeeLabel) {
      totalsChildren.push(
        textRow('Taxa de entrega', params.deliveryFeeLabel, {
          fontSize: 12,
          marginTop: 4,
        }),
      );
    }
    if (params.discountLabel) {
      totalsChildren.push(
        textRow('Desconto', `-${params.discountLabel}`, {
          fontSize: 12,
          marginTop: 4,
          color: '#a13f3f',
        }),
      );
    }
    totalsChildren.push(
      textRow('TOTAL', params.totalLabel, {
        fontSize: 17,
        fontWeight: 700,
        marginTop: 10,
      }),
    );
    totalsChildren.push(
      h('div', {
        style: {
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          fontSize: 12,
          fontWeight: 700,
          marginTop: 10,
        },
        children: [
          h('span', { style: {}, children: `PAGAMENTO: ${params.paymentLabel}` }),
          h('div', {
            style: {
              display: 'flex',
              marginLeft: 8,
              fontSize: 10,
              fontWeight: 700,
              color: '#fdf8ee',
              backgroundColor: '#5a7a52',
              borderRadius: 3,
              padding: '2px 7px',
            },
            children: 'CONFIRMADO',
          }),
        ],
      }),
    );
    children.push(
      h('div', {
        style: { display: 'flex', flexDirection: 'column', width: '100%' },
        children: totalsChildren,
      }),
    );
    children.push(dashedLine());

    // ── Rodapé ────────────────────────────────────────────────────────────
    children.push(
      h('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
        },
        children: [
          h('div', {
            style: { fontSize: 12, fontStyle: 'italic' },
            children: 'Obrigado pela preferência!',
          }),
          starsRow(),
          ...(params.websiteFooter
            ? [
                h('div', {
                  style: { fontSize: 10, color: MUTED, marginTop: 8 },
                  children: params.websiteFooter,
                }),
              ]
            : []),
        ],
      }),
    );

    const root = h('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: WIDTH,
        height,
        backgroundColor: BG,
        padding: PADDING,
        fontFamily: FONT_FAMILY,
        color: INK,
      },
      children,
    });

    const svg = await satori(root as any, {
      width: WIDTH,
      height,
      fonts: [
        { name: FONT_FAMILY, data: this.regularFont!, weight: 400, style: 'normal' },
        { name: FONT_FAMILY, data: this.boldFont!, weight: 700, style: 'normal' },
      ],
    });

    const resvg = new Resvg(svg, {
      font: {
        fontFiles: [this.regularFontPath, this.boldFontPath],
        loadSystemFonts: false,
        defaultFontFamily: FONT_FAMILY,
      },
      fitTo: { mode: 'width', value: WIDTH },
    });
    const rendered = resvg.render();
    const png = rendered.asPng();
    log.debug(`Cupom renderizado: ${WIDTH}x${height}px, ${png.length} bytes`);
    return Buffer.from(png);
  }
}
