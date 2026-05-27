import { AIProvider, AIImageRequest } from '../ai-provider.interface';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  private apiKey: string;
  private model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
    this.apiKey = apiKey;
    this.model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
  }

  async analyzeImage({ prompt, imageBase64, mimeType, textContent }: AIImageRequest): Promise<string> {
    const url = `${GEMINI_API_URL}/${this.model}:generateContent?key=${this.apiKey}`;

    // Build parts: text prompt + file data (image/pdf) or plain text
    const parts: any[] = [{ text: prompt }];
    if (textContent) {
      parts.push({ text: `\n\nDados do arquivo:\n${textContent}` });
    } else if (imageBase64 && mimeType) {
      parts.push({ inline_data: { mime_type: mimeType, data: imageBase64 } });
    }

    const body = {
      contents: [{ parts }],
      generationConfig: { maxOutputTokens: 8192, temperature: 0.1 },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = (await res.json()) as any;
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!text) throw new Error('Gemini retornou resposta vazia');
    return text;
  }
}
