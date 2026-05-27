import { AIProvider, AIImageRequest } from '../ai-provider.interface';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  private apiKey: string;
  private primaryModel: string;

  // Ordered list of models to try if the primary fails
  private static readonly FALLBACK_MODELS = [
    'gemini-1.5-flash',
    'gemini-2.0-flash-lite',
  ];

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
    this.apiKey = apiKey;
    // Default: gemini-1.5-flash (stable free-tier model)
    // Override via GEMINI_MODEL env var (e.g. gemini-2.0-flash)
    this.primaryModel = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash';
  }

  async analyzeImage(params: AIImageRequest): Promise<string> {
    // Try primary model first, then fallbacks
    const modelsToTry = [
      this.primaryModel,
      ...GeminiProvider.FALLBACK_MODELS.filter(m => m !== this.primaryModel),
    ];

    let lastError: Error = new Error('Gemini: nenhum modelo disponível');
    for (const model of modelsToTry) {
      try {
        return await this.callModel(model, params);
      } catch (err: any) {
        lastError = err;
        const msg: string = err?.message ?? '';
        // Only continue to fallback on quota/not-found errors
        if (
          msg.includes('404') ||
          msg.includes('not found') ||
          msg.includes('429') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('quota')
        ) {
          console.warn(`[GeminiProvider] Model ${model} failed (${msg.slice(0, 80)}), trying next…`);
          continue;
        }
        // For other errors (network, timeout, bad response) don't retry
        throw err;
      }
    }
    throw lastError;
  }

  private async callModel(
    model: string,
    { prompt, imageBase64, mimeType, textContent }: AIImageRequest,
  ): Promise<string> {
    const url = `${GEMINI_API_URL}/${model}:generateContent?key=${this.apiKey}`;

    // Build parts: text prompt + file data (image/pdf) or plain text
    const parts: any[] = [{ text: prompt }];
    if (textContent) {
      parts.push({ text: `\n\nDados do arquivo:\n${textContent}` });
    } else if (imageBase64 && mimeType) {
      parts.push({ inline_data: { mime_type: mimeType, data: imageBase64 } });
    }

    const body = {
      contents: [{ parts }],
      generationConfig: {
        maxOutputTokens: 16384,
        temperature: 0.1,
        // Force Gemini to return JSON only (no markdown, no commentary)
        responseMimeType: 'application/json',
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini ${res.status} (${model}): ${err.slice(0, 200)}`);
    }

    const data = (await res.json()) as any;
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!text) {
      // Log finish reason to help diagnose safety/quota blocks
      const finishReason = data?.candidates?.[0]?.finishReason ?? 'unknown';
      throw new Error(`Gemini retornou resposta vazia (model=${model}, finishReason=${finishReason})`);
    }
    return text;
  }
}
