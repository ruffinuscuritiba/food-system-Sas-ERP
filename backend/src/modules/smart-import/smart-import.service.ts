import { Injectable, NotFoundException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { XMLParser } from 'fast-xml-parser';
import { PrismaService } from 'src/database/prisma.service';

const MENU_PROMPT = `Você é especialista em análise de cardápios de restaurantes brasileiros.
Analise esta imagem e extraia TODOS os itens do cardápio. Retorne SOMENTE JSON válido, sem texto extra:

{
  "items": [
    {
      "name": "nome do produto",
      "description": "descrição curta ou null",
      "price": 29.90,
      "category": "Lanches",
      "sizes": [],
      "notes": null,
      "confidence": 0.95
    }
  ]
}

Regras:
- price: número float em reais, null se não encontrado
- category: Lanches, Pizzas, Bebidas, Combos, Adicionais, Sobremesas, Massas, Porções, Pratos, Outros
- confidence: 0 a 1
- Retorne APENAS o JSON puro`;

const INVOICE_PROMPT = `Você é especialista em documentos fiscais brasileiros (NF-e, NFC-e, cupom fiscal).
Analise este documento e extraia os dados. Retorne SOMENTE JSON válido:

{
  "supplier": { "name": "nome", "cnpj": "00.000.000/0000-00", "address": null },
  "document": { "number": "000", "date": "YYYY-MM-DD", "total": 0.00 },
  "items": [
    {
      "name": "nome do produto",
      "code": null,
      "quantity": 1.0,
      "unit": "UN",
      "unitCost": 0.00,
      "total": 0.00,
      "confidence": 0.95
    }
  ]
}

Retorne APENAS o JSON puro`;

@Injectable()
export class SmartImportService {
  private claude: Anthropic;
  private xmlParser: XMLParser;

  constructor(private prisma: PrismaService) {
    this.claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  }

  // ── Session helpers ────────────────────────────────────────────────────────

  private async log(sessionId: string, level: string, message: string) {
    await this.prisma.importLog.create({ data: { sessionId, level, message } });
  }

  async getSession(sessionId: string, companyId: string) {
    const session = await this.prisma.importSession.findFirst({
      where: { id: sessionId, companyId },
      include: { items: true, logs: { orderBy: { createdAt: 'asc' } } },
    });
    if (!session) throw new NotFoundException('Sessão não encontrada.');
    return session;
  }

  async listSessions(companyId: string) {
    return this.prisma.importSession.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, type: true, status: true, createdAt: true, _count: { select: { items: true } } },
    });
  }

  // ── Menu image processing ──────────────────────────────────────────────────

  async processMenuImage(
    buffer: Buffer,
    mimeType: string,
    companyId: string,
    fileUrl?: string,
  ) {
    const session = await this.prisma.importSession.create({
      data: { companyId, type: 'MENU', status: 'PROCESSING', fileUrl },
    });

    setImmediate(() => this.runMenuExtraction(session.id, buffer, mimeType, companyId));
    return { sessionId: session.id, status: 'PROCESSING' };
  }

  private async runMenuExtraction(sessionId: string, buffer: Buffer, mimeType: string, companyId: string) {
    try {
      await this.log(sessionId, 'INFO', 'Enviando imagem para análise IA...');

      const base64 = buffer.toString('base64');
      const validMime = (['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const)
        .find(m => m === mimeType) ?? 'image/jpeg';

      const response = await this.claude.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: validMime, data: base64 } },
            { type: 'text', text: MENU_PROMPT },
          ],
        }],
      });

      const raw = (response.content[0] as any).text as string;
      await this.log(sessionId, 'INFO', `IA respondeu com ${raw.length} caracteres`);

      const parsed = this.parseJson(raw);
      const items: any[] = parsed?.items ?? [];

      await this.log(sessionId, 'INFO', `${items.length} itens extraídos da imagem`);

      // Enrich with existing categories from company
      const categories = await this.prisma.category.findMany({ where: { companyId }, select: { id: true, name: true } });

      const enriched = items.map(item => ({
        ...item,
        suggestedCategoryId: categories.find(c =>
          c.name.toLowerCase().includes(item.category?.toLowerCase() ?? '') ||
          item.category?.toLowerCase().includes(c.name.toLowerCase())
        )?.id ?? null,
      }));

      await this.prisma.$transaction([
        this.prisma.importSession.update({
          where: { id: sessionId },
          data: { status: 'DONE', rawResult: parsed as any },
        }),
        ...enriched.map(item =>
          this.prisma.importItem.create({
            data: { sessionId, data: item as any, confidence: item.confidence ?? null },
          })
        ),
      ]);

      await this.log(sessionId, 'INFO', 'Extração concluída com sucesso');
    } catch (err: any) {
      await this.prisma.importSession.update({
        where: { id: sessionId },
        data: { status: 'ERROR', errorMsg: err?.message ?? 'Erro desconhecido' },
      });
      await this.log(sessionId, 'ERROR', err?.message ?? 'Erro ao processar imagem');
    }
  }

  // ── Invoice processing ─────────────────────────────────────────────────────

  async processInvoice(
    buffer: Buffer,
    mimeType: string,
    companyId: string,
    fileUrl?: string,
  ) {
    const session = await this.prisma.importSession.create({
      data: { companyId, type: 'INVOICE', status: 'PROCESSING', fileUrl },
    });

    const isXml = mimeType === 'application/xml' || mimeType === 'text/xml';
    setImmediate(() =>
      isXml
        ? this.runXmlExtraction(session.id, buffer, companyId)
        : this.runInvoiceVision(session.id, buffer, mimeType, companyId)
    );
    return { sessionId: session.id, status: 'PROCESSING' };
  }

  private async runXmlExtraction(sessionId: string, buffer: Buffer, companyId: string) {
    try {
      await this.log(sessionId, 'INFO', 'Processando XML de NF-e...');
      const xml = buffer.toString('utf-8');
      const doc = this.xmlParser.parse(xml);

      const nfe = doc?.nfeProc?.NFe?.infNFe ?? doc?.NFe?.infNFe ?? {};
      const emit = nfe?.emit ?? {};
      const det = nfe?.det ? (Array.isArray(nfe.det) ? nfe.det : [nfe.det]) : [];

      const supplier = {
        name: emit?.xNome ?? 'Fornecedor',
        cnpj: emit?.CNPJ ?? null,
        address: null,
      };

      const document = {
        number: nfe?.ide?.nNF ?? null,
        date: nfe?.ide?.dhEmi?.substring(0, 10) ?? null,
        total: parseFloat(nfe?.total?.ICMSTot?.vNF ?? '0'),
      };

      const items = det.map((d: any) => ({
        name: d?.prod?.xProd ?? 'Produto',
        code: d?.prod?.cProd ?? null,
        quantity: parseFloat(d?.prod?.qCom ?? '1'),
        unit: d?.prod?.uCom ?? 'UN',
        unitCost: parseFloat(d?.prod?.vUnCom ?? '0'),
        total: parseFloat(d?.prod?.vProd ?? '0'),
        confidence: 1.0,
      }));

      await this.log(sessionId, 'INFO', `XML processado: ${items.length} itens encontrados`);
      await this.saveInvoiceResult(sessionId, { supplier, document, items });
    } catch (err: any) {
      await this.prisma.importSession.update({
        where: { id: sessionId },
        data: { status: 'ERROR', errorMsg: err?.message },
      });
      await this.log(sessionId, 'ERROR', err?.message ?? 'Erro ao processar XML');
    }
  }

  private async runInvoiceVision(sessionId: string, buffer: Buffer, mimeType: string, companyId: string) {
    try {
      await this.log(sessionId, 'INFO', 'Enviando documento para análise IA...');

      const base64 = buffer.toString('base64');
      const validMime = (['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const)
        .find(m => m === mimeType) ?? 'image/jpeg';

      const response = await this.claude.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: validMime, data: base64 } },
            { type: 'text', text: INVOICE_PROMPT },
          ],
        }],
      });

      const raw = (response.content[0] as any).text as string;
      const parsed = this.parseJson(raw);

      await this.log(sessionId, 'INFO', `IA extraiu ${parsed?.items?.length ?? 0} itens`);
      await this.saveInvoiceResult(sessionId, parsed);
    } catch (err: any) {
      await this.prisma.importSession.update({
        where: { id: sessionId },
        data: { status: 'ERROR', errorMsg: err?.message },
      });
      await this.log(sessionId, 'ERROR', err?.message ?? 'Erro ao processar documento');
    }
  }

  private async saveInvoiceResult(sessionId: string, data: any) {
    const items: any[] = data?.items ?? [];
    await this.prisma.$transaction([
      this.prisma.importSession.update({
        where: { id: sessionId },
        data: { status: 'DONE', rawResult: data as any },
      }),
      ...items.map(item =>
        this.prisma.importItem.create({
          data: { sessionId, data: item as any, confidence: item.confidence ?? null },
        })
      ),
    ]);
    await this.log(sessionId, 'INFO', 'Extração concluída com sucesso');
  }

  // ── Confirm: save products ─────────────────────────────────────────────────

  async confirmMenuItems(
    sessionId: string,
    items: Array<{ itemId: string; name: string; description?: string; price?: number; categoryId?: string }>,
    companyId: string,
  ) {
    const results: string[] = [];

    for (const item of items) {
      const product = await this.prisma.product.create({
        data: {
          name: item.name,
          description: item.description ?? null,
          salePrice: item.price ?? 0,
          costPrice: 0,
          profitMargin: 0,
          categoryId: item.categoryId ?? null,
          companyId,
          isActive: true,
          trackStock: false,
          unit: 'un',
        },
      });
      await this.prisma.importItem.update({
        where: { id: item.itemId },
        data: { confirmed: true, savedId: product.id },
      });
      results.push(product.id);
    }

    await this.prisma.importSession.update({
      where: { id: sessionId },
      data: { status: 'DONE' },
    });

    return { created: results.length, productIds: results };
  }

  async confirmInvoiceItems(
    sessionId: string,
    items: Array<{ itemId: string; name: string; quantity: number; unitCost: number; unit?: string; createProduct?: boolean }>,
    companyId: string,
  ) {
    const results: string[] = [];

    for (const item of items) {
      // Find or create product
      let product = await this.prisma.product.findFirst({
        where: { companyId, name: { contains: item.name, mode: 'insensitive' } },
      });

      if (!product && item.createProduct) {
        product = await this.prisma.product.create({
          data: {
            name: item.name,
            salePrice: item.unitCost * 1.3,
            costPrice: item.unitCost,
            profitMargin: 30,
            companyId,
            isActive: true,
            trackStock: true,
            unit: item.unit ?? 'un',
          },
        });
      }

      if (product) {
        // Create stock movement
        const movement = await this.prisma.stockMovement.create({
          data: {
            productId: product.id,
            companyId,
            type: 'ENTRY',
            quantity: item.quantity,
            unitCost: item.unitCost,
            totalCost: item.quantity * item.unitCost,
            reason: `Entrada via importação (sessão ${sessionId})`,
          },
        });
        await this.prisma.importItem.update({
          where: { id: item.itemId },
          data: { confirmed: true, savedId: movement.id },
        });
        results.push(movement.id);
      }
    }

    return { created: results.length, movementIds: results };
  }

  // ── Util ───────────────────────────────────────────────────────────────────

  private parseJson(raw: string): any {
    // Strip markdown code blocks if present
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      // Try to extract JSON from text
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error('Resposta da IA não é JSON válido');
    }
  }
}
