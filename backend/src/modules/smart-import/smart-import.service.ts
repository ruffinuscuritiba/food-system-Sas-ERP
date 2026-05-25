import { Injectable, NotFoundException } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { PrismaService } from 'src/database/prisma.service';
import { AIProvider } from 'src/services/ai/ai-provider.interface';
import { AIProviderFactory } from 'src/services/ai/ai-provider.factory';

// ── Prompts ────────────────────────────────────────────────────────────────────

const MENU_PROMPT = `Você é especialista em análise de cardápios de restaurantes brasileiros.
Analise esta imagem e extraia TODOS os itens do cardápio visíveis. Retorne SOMENTE JSON válido, sem texto extra:

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
- Extraia TODOS os produtos visíveis, sem omitir nenhum
- price: número float em reais, null se não encontrado
- category: Lanches, Pizzas, Bebidas, Combos, Adicionais, Sobremesas, Massas, Porções, Pratos, Outros
- confidence: 0 a 1 indicando certeza da leitura
- Retorne APENAS o JSON puro, sem markdown, sem explicações`;

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

Retorne APENAS o JSON puro, sem markdown, sem explicações`;

@Injectable()
export class SmartImportService {
  private aiProviders: AIProvider[];
  private xmlParser: XMLParser;

  constructor(private prisma: PrismaService) {
    this.aiProviders = AIProviderFactory.buildChain();
    this.xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

    const names = this.aiProviders.map(p => p.name).join(', ') || 'nenhum';
    console.log(`[SmartImport] AI providers disponíveis: ${names}`);
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

  async processMenuImage(buffer: Buffer, mimeType: string, companyId: string, fileUrl?: string) {
    const session = await this.prisma.importSession.create({
      data: { companyId, type: 'MENU', status: 'PROCESSING', fileUrl },
    });
    setImmediate(() => this.runMenuExtraction(session.id, buffer, mimeType, companyId));
    return { sessionId: session.id, status: 'PROCESSING' };
  }

  private async runMenuExtraction(sessionId: string, buffer: Buffer, mimeType: string, companyId: string) {
    try {
      await this.log(sessionId, 'INFO', 'Analisando imagem...');

      const imageBase64 = buffer.toString('base64');
      const safeMime = this.toSafeMime(mimeType);

      await this.log(sessionId, 'INFO', `Conectando ao serviço de IA...`);

      const { result, provider } = await AIProviderFactory.analyzeWithFallback(
        this.aiProviders,
        { prompt: MENU_PROMPT, imageBase64, mimeType: safeMime },
        (name) => this.log(sessionId, 'INFO', `Tentando provedor: ${name}...`),
      );

      await this.log(sessionId, 'INFO', `Extraindo produtos (via ${provider})...`);

      const parsed = this.parseJson(result);
      const items: any[] = parsed?.items ?? [];

      if (items.length === 0) {
        throw new Error('Nenhum produto encontrado na imagem. Verifique se a imagem contém um cardápio legível.');
      }

      await this.log(sessionId, 'INFO', `${items.length} produto(s) identificado(s)`);
      await this.log(sessionId, 'INFO', 'Organizando categorias...');

      const categories = await this.prisma.category.findMany({
        where: { companyId },
        select: { id: true, name: true },
      });

      const enriched = items.map(item => ({
        ...item,
        suggestedCategoryId: categories.find(c =>
          c.name.toLowerCase().includes((item.category ?? '').toLowerCase()) ||
          (item.category ?? '').toLowerCase().includes(c.name.toLowerCase())
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

      await this.log(sessionId, 'INFO', `Extração concluída — ${items.length} produto(s) prontos para revisão`);
    } catch (err: any) {
      const userMsg = this.toUserMessage(err?.message);
      await this.prisma.importSession.update({
        where: { id: sessionId },
        data: { status: 'ERROR', errorMsg: userMsg },
      });
      await this.log(sessionId, 'ERROR', userMsg);
    }
  }

  // ── Invoice processing ─────────────────────────────────────────────────────

  async processInvoice(buffer: Buffer, mimeType: string, companyId: string, fileUrl?: string) {
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

  private async runXmlExtraction(sessionId: string, buffer: Buffer, _companyId: string) {
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

      await this.log(sessionId, 'INFO', `XML processado: ${items.length} item(ns) encontrado(s)`);
      await this.saveInvoiceResult(sessionId, { supplier, document, items });
    } catch (err: any) {
      const userMsg = this.toUserMessage(err?.message);
      await this.prisma.importSession.update({
        where: { id: sessionId },
        data: { status: 'ERROR', errorMsg: userMsg },
      });
      await this.log(sessionId, 'ERROR', userMsg);
    }
  }

  private async runInvoiceVision(sessionId: string, buffer: Buffer, mimeType: string, _companyId: string) {
    try {
      await this.log(sessionId, 'INFO', 'Analisando documento fiscal...');

      const imageBase64 = buffer.toString('base64');
      const safeMime = this.toSafeMime(mimeType);

      await this.log(sessionId, 'INFO', 'Conectando ao serviço de IA...');

      const { result, provider } = await AIProviderFactory.analyzeWithFallback(
        this.aiProviders,
        { prompt: INVOICE_PROMPT, imageBase64, mimeType: safeMime },
        (name) => this.log(sessionId, 'INFO', `Tentando provedor: ${name}...`),
      );

      await this.log(sessionId, 'INFO', `Extraindo dados do documento (via ${provider})...`);

      const parsed = this.parseJson(result);
      await this.log(sessionId, 'INFO', `${parsed?.items?.length ?? 0} item(ns) extraído(s)`);
      await this.saveInvoiceResult(sessionId, parsed);
    } catch (err: any) {
      const userMsg = this.toUserMessage(err?.message);
      await this.prisma.importSession.update({
        where: { id: sessionId },
        data: { status: 'ERROR', errorMsg: userMsg },
      });
      await this.log(sessionId, 'ERROR', userMsg);
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
    await this.log(sessionId, 'INFO', `Extração concluída — ${items.length} item(ns) prontos para revisão`);
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
      let ingredient = await this.prisma.ingredient.findFirst({
        where: { companyId, name: { contains: item.name, mode: 'insensitive' } },
      });
      if (!ingredient && item.createProduct) {
        ingredient = await this.prisma.ingredient.create({
          data: { name: item.name, stock: 0, unit: item.unit ?? 'un', cost: item.unitCost, companyId },
        });
      }
      if (ingredient) {
        const previousStock = Number(ingredient.stock);
        const newStock = previousStock + item.quantity;
        const movement = await this.prisma.stockMovement.create({
          data: {
            ingredient: { connect: { id: ingredient.id } },
            company: { connect: { id: companyId } },
            type: 'ENTRY',
            quantity: item.quantity,
            previousStock,
            currentStock: newStock,
            unitCost: item.unitCost,
            totalCost: item.quantity * item.unitCost,
            reason: `Entrada via importação (sessão ${sessionId})`,
          },
        });
        await this.prisma.ingredient.update({
          where: { id: ingredient.id },
          data: { stock: newStock, lastPurchaseCost: item.unitCost },
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

  // ── Utils ──────────────────────────────────────────────────────────────────

  private parseJson(raw: string): any {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error('Resposta da IA não é um JSON válido. Tente novamente com uma imagem mais nítida.');
    }
  }

  private toSafeMime(mimeType: string): string {
    const safe = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    return safe.includes(mimeType) ? mimeType : 'image/jpeg';
  }

  /** Convert technical error messages to user-friendly text. */
  private toUserMessage(msg?: string): string {
    if (!msg) return 'Não foi possível processar a imagem. Tente novamente.';
    // Already a user-friendly message from our factory
    if (msg.includes('Não foi possível') || msg.includes('Nenhum produto')) return msg;
    // Generic fallback — never expose internal errors
    return 'Serviço temporariamente indisponível. Tente novamente em alguns instantes.';
  }
}
