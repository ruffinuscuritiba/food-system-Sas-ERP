import { Injectable, NotFoundException } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import * as XLSX from 'xlsx';
import { PrismaService } from 'src/database/prisma.service';

// Lazy-load pdf-parse so the entire backend doesn't crash at startup
// on Node < 22.6 (pdf-parse pulls in code that needs process.getBuiltinModule).
let _pdfParse: ((buf: Buffer) => Promise<{ text: string }>) | null = null;
function pdfParse(buf: Buffer): Promise<{ text: string }> {
  if (!_pdfParse) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _pdfParse = require('pdf-parse');
  }
  return _pdfParse!(buf);
}
import { AIProvider } from 'src/services/ai/ai-provider.interface';
import { AIProviderFactory } from 'src/services/ai/ai-provider.factory';

// ── Prompts ────────────────────────────────────────────────────────────────────

const MENU_PROMPT = `Você é especialista em análise de cardápios de restaurantes brasileiros.
Analise o conteúdo (imagem ou texto) e extraia TODOS os itens reais do cardápio.

IMPORTANTE: Retorne SOMENTE JSON válido, no formato EXATO abaixo, com os VALORES REAIS extraídos (NUNCA copie o texto de exemplo):

{
  "items": [
    {
      "name": "<nome real do prato>",
      "description": "<descrição real ou null>",
      "price": 29.90,
      "category": "Lanches",
      "confidence": 0.95
    }
  ]
}

Regras OBRIGATÓRIAS:
- Cada item DEVE ter o campo "name" preenchido com o NOME REAL do produto (string não vazia)
- NÃO retorne placeholders como "nome do produto" — extraia o nome REAL
- price: número decimal em reais (ex: 29.90), null se não houver
- category: uma das opções [Lanches, Pizzas, Bebidas, Combos, Adicionais, Sobremesas, Massas, Porções, Pratos, Outros]
- confidence: 0 a 1 indicando certeza da leitura daquele item
- Os campos devem ficar no NÍVEL RAIZ de cada item (NÃO aninhe dentro de "data" ou outro objeto)
- Retorne APENAS o JSON puro — sem markdown \`\`\`, sem texto antes ou depois`;

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

    // Diagnostic: log raw data shape from DB
    if (session.items.length > 0) {
      const first = session.items[0];
      console.log(`[SmartImport getSession] item[0].data type=${typeof first.data}, value=`, JSON.stringify(first.data)?.slice(0, 300));
    }

    // Flatten data fields onto each item so the frontend can read them directly
    // (guards against Json column serialization quirks in Prisma/Supabase)
    return {
      ...session,
      items: session.items.map(item => {
        const d: any = (typeof item.data === 'object' && item.data !== null) ? item.data : {};
        return {
          ...item,
          name: d.name ?? '',
          description: d.description ?? null,
          price: d.price ?? null,
          category: d.category ?? null,
          suggestedCategoryId: d.suggestedCategoryId ?? null,
          quantity: d.quantity ?? null,
          unit: d.unit ?? null,
          unitCost: d.unitCost ?? null,
          total: d.total ?? null,
        };
      }),
    };
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

  async processMenuImage(buffer: Buffer, mimeType: string, companyId: string, fileUrl?: string, filename?: string) {
    const session = await this.prisma.importSession.create({
      data: { companyId, type: 'MENU', status: 'PROCESSING', fileUrl },
    });

    const ext = (filename ?? '').split('.').pop()?.toLowerCase() ?? '';
    const SPREADSHEET_MIMES = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel.sheet.macroEnabled.12',
      'application/vnd.ms-excel',
    ];
    const isSpreadsheet =
      SPREADSHEET_MIMES.some(t => mimeType.includes(t)) ||
      ['xlsx', 'xlsm', 'xls'].includes(ext);

    if (isSpreadsheet) {
      setImmediate(() => this.runSpreadsheetExtraction(session.id, buffer, companyId));
    } else {
      setImmediate(() => this.runMenuExtraction(session.id, buffer, mimeType, companyId));
    }
    return { sessionId: session.id, status: 'PROCESSING' };
  }

  private async runMenuExtraction(sessionId: string, buffer: Buffer, mimeType: string, companyId: string) {
    try {
      const isPdf = mimeType === 'application/pdf';
      await this.log(sessionId, 'INFO', isPdf ? 'Extraindo texto do PDF...' : 'Analisando imagem...');

      let aiParams: import('src/services/ai/ai-provider.interface').AIImageRequest;

      if (isPdf) {
        // Extract text from PDF — much more reliable than sending as binary to vision AI
        let pdfText = '';
        try {
          const parsed = await pdfParse(buffer);
          pdfText = (parsed.text ?? '').trim();
        } catch (e) {
          pdfText = '';
        }

        if (!pdfText || pdfText.length < 30) {
          // Scanned PDF (image-only) — fall back to Gemini inline_data vision
          await this.log(sessionId, 'INFO', 'PDF escaneado detectado, usando visão computacional...');
          aiParams = {
            prompt: MENU_PROMPT,
            imageBase64: buffer.toString('base64'),
            mimeType: 'application/pdf',
          };
        } else {
          await this.log(sessionId, 'INFO', `Texto extraído do PDF (${pdfText.length} chars). Analisando com IA...`);
          aiParams = { prompt: MENU_PROMPT, textContent: pdfText.slice(0, 40_000) };
        }
      } else {
        aiParams = {
          prompt: MENU_PROMPT,
          imageBase64: buffer.toString('base64'),
          mimeType: this.toSafeMime(mimeType),
        };
      }

      await this.log(sessionId, 'INFO', `Conectando ao serviço de IA...`);

      const { result, provider } = await AIProviderFactory.analyzeWithFallback(
        this.aiProviders,
        aiParams,
        (name) => this.log(sessionId, 'INFO', `Tentando provedor: ${name}...`),
      );

      await this.log(sessionId, 'INFO', `Extraindo produtos (via ${provider})...`);

      const parsed = this.parseJson(result);
      const rawItems: any[] = parsed?.items ?? parsed?.products ?? parsed?.menu ?? [];

      // Log a preview of the raw response for debugging
      console.log(`[SmartImport ${sessionId}] Raw response preview (${provider}):`, JSON.stringify(parsed).slice(0, 500));

      // Normalize: Gemini sometimes nests fields under "data" or returns alt field names.
      // Flatten so item.name / item.price / item.description / item.category are top-level.
      const items = rawItems.map((raw: any) => {
        const src = raw?.data && typeof raw.data === 'object' ? { ...raw, ...raw.data } : raw;
        return {
          name: src.name ?? src.title ?? src.product_name ?? src.productName ?? src.nome ?? '',
          description: src.description ?? src.desc ?? src.descricao ?? null,
          price: typeof src.price === 'number' ? src.price
               : typeof src.preco === 'number' ? src.preco
               : typeof src.valor === 'number' ? src.valor
               : src.price ? Number(String(src.price).replace(',', '.')) || null
               : null,
          category: src.category ?? src.categoria ?? src.cat ?? null,
          sizes: src.sizes ?? src.tamanhos ?? [],
          notes: src.notes ?? src.observacoes ?? null,
          confidence: typeof src.confidence === 'number' ? src.confidence
                    : typeof raw.confidence === 'number' ? raw.confidence
                    : null,
        };
      }).filter((it: any) => it.name && String(it.name).trim().length > 0);

      if (items.length === 0) {
        throw new Error('Nenhum produto encontrado na imagem. Verifique se a imagem contém um cardápio legível.');
      }

      await this.log(sessionId, 'INFO', `${items.length} produto(s) identificado(s)`);
      await this.log(sessionId, 'INFO', 'Organizando categorias...');

      // Diagnostic: log first item shape so we can verify data in Render logs
      if (items.length > 0) {
        console.log(`[SmartImport ${sessionId}] First item shape:`, JSON.stringify(items[0]).slice(0, 300));
      }

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
            data: { sessionId, data: JSON.parse(JSON.stringify(item)), confidence: item.confidence ?? null },
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

  // ── Spreadsheet processing ─────────────────────────────────────────────────

  private async runSpreadsheetExtraction(sessionId: string, buffer: Buffer, companyId: string) {
    try {
      await this.log(sessionId, 'INFO', 'Lendo planilha Excel...');

      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error('Planilha vazia ou formato inválido.');

      const sheet = workbook.Sheets[sheetName];
      // Convert to CSV-style text for AI
      const csvText = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });

      if (!csvText || csvText.trim().length < 5) {
        throw new Error('A planilha parece estar vazia. Verifique se há dados na primeira aba.');
      }

      await this.log(sessionId, 'INFO', `Planilha lida (${workbook.SheetNames.length} aba(s)). Analisando com IA...`);

      const { result, provider } = await AIProviderFactory.analyzeWithFallback(
        this.aiProviders,
        { prompt: MENU_PROMPT, textContent: csvText.slice(0, 30_000) },
        (name) => this.log(sessionId, 'INFO', `Tentando provedor: ${name}...`),
      );

      await this.log(sessionId, 'INFO', `Extraindo produtos (via ${provider})...`);

      const parsed = this.parseJson(result);
      const items: any[] = parsed?.items ?? [];

      if (items.length === 0) {
        throw new Error('Nenhum produto encontrado na planilha. Verifique se há colunas de nome e preço.');
      }

      await this.log(sessionId, 'INFO', `${items.length} produto(s) identificado(s)`);

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
            data: { sessionId, data: JSON.parse(JSON.stringify(item)), confidence: item.confidence ?? null },
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
      const isPdf = mimeType === 'application/pdf';
      await this.log(sessionId, 'INFO', isPdf ? 'Extraindo texto do PDF fiscal...' : 'Analisando documento fiscal...');

      let aiParams: import('src/services/ai/ai-provider.interface').AIImageRequest;

      if (isPdf) {
        let pdfText = '';
        try {
          const parsed = await pdfParse(buffer);
          pdfText = (parsed.text ?? '').trim();
        } catch { pdfText = ''; }

        if (!pdfText || pdfText.length < 30) {
          aiParams = { prompt: INVOICE_PROMPT, imageBase64: buffer.toString('base64'), mimeType: 'application/pdf' };
        } else {
          await this.log(sessionId, 'INFO', `Texto extraído (${pdfText.length} chars). Analisando...`);
          aiParams = { prompt: INVOICE_PROMPT, textContent: pdfText.slice(0, 40_000) };
        }
      } else {
        aiParams = { prompt: INVOICE_PROMPT, imageBase64: buffer.toString('base64'), mimeType: this.toSafeMime(mimeType) };
      }

      await this.log(sessionId, 'INFO', 'Conectando ao serviço de IA...');

      const { result, provider } = await AIProviderFactory.analyzeWithFallback(
        this.aiProviders,
        aiParams,
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
          data: { sessionId, data: JSON.parse(JSON.stringify(item)), confidence: item.confidence ?? null },
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
    // Strip markdown fences if any
    let cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Direct parse
    try { return JSON.parse(cleaned); } catch {}

    // Try to slice from first '{' to last '}'
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const slice = cleaned.slice(firstBrace, lastBrace + 1);
      try { return JSON.parse(slice); } catch {}
    }

    // Truncated array recovery: find "items": [ and parse items one by one
    const itemsMatch = cleaned.match(/"items"\s*:\s*\[/);
    if (itemsMatch) {
      const startIdx = itemsMatch.index! + itemsMatch[0].length;
      const items: any[] = [];
      let i = startIdx;
      while (i < cleaned.length) {
        // Skip whitespace and commas
        while (i < cleaned.length && /[\s,]/.test(cleaned[i])) i++;
        if (cleaned[i] !== '{') break;

        // Find matching closing brace (track nesting and string state)
        let depth = 0;
        let inStr = false;
        let escape = false;
        const objStart = i;
        for (; i < cleaned.length; i++) {
          const c = cleaned[i];
          if (escape) { escape = false; continue; }
          if (c === '\\') { escape = true; continue; }
          if (c === '"') { inStr = !inStr; continue; }
          if (inStr) continue;
          if (c === '{') depth++;
          else if (c === '}') {
            depth--;
            if (depth === 0) { i++; break; }
          }
        }
        if (depth !== 0) break; // truncated mid-object, stop
        const objStr = cleaned.slice(objStart, i);
        try { items.push(JSON.parse(objStr)); } catch { /* skip invalid */ }
      }
      if (items.length) return { items };
    }

    throw new Error('Resposta da IA não é um JSON válido. Tente novamente com uma imagem mais nítida.');
  }

  private toSafeMime(mimeType: string): string {
    const safe = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    return safe.includes(mimeType) ? mimeType : 'image/jpeg';
  }

  /** Convert technical error messages to user-friendly text. */
  private toUserMessage(msg?: string): string {
    if (!msg) return 'Não foi possível processar o arquivo. Tente novamente.';
    // Log the raw error so we can debug from Render logs
    console.error('[SmartImport] Raw error:', msg);
    // Already a user-friendly message from our factory or thrown above
    if (
      msg.includes('Não foi possível') ||
      msg.includes('Nenhum produto') ||
      msg.includes('Nenhum provedor') ||
      msg.includes('planilha') ||
      msg.includes('Planilha') ||
      msg.includes('formato inválido') ||
      msg.includes('PDF')
    ) return msg;
    // Map common API errors to friendlier text
    if (msg.includes('Gemini 404') || msg.includes('404') || msg.includes('not found for API')) {
      return 'O modelo de IA configurado não existe mais. Atualize GEMINI_MODEL no servidor para gemini-1.5-flash.';
    }
    if (msg.includes('Gemini 429') || msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
      return 'Cota da IA esgotada. Aguarde alguns minutos e tente novamente.';
    }
    if (msg.includes('credit balance is too low')) {
      return 'Crédito do provedor de IA esgotado.';
    }
    if (msg.includes('GEMINI_API_KEY')) {
      return 'Chave da API Gemini não configurada no servidor. Adicione GEMINI_API_KEY nas variáveis de ambiente do Render.';
    }
    if (msg.includes('aborted') || msg.includes('timeout') || msg.includes('TimeoutError')) {
      return 'Tempo limite atingido ao processar a imagem. Tente com uma imagem menor ou mais simples.';
    }
    // Expose at least a short hint of the real error to help diagnosis
    return `Falha no processamento: ${(msg ?? '').slice(0, 140)}`;
  }
}
