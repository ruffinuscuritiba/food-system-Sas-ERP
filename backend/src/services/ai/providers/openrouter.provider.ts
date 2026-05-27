import { AIProvider, AIImageRequest } from '../ai-provider.interface';

export class OpenRouterProvider implements AIProvider {
  readonly name = 'openrouter';
  private apiKey: string;
  private model: string;

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');
    this.apiKey = apiKey;
    // Default to a free vision-capable model
    this.model = process.env.OPENROUTER_MODEL ?? 'google/gemini-2.0-flash-exp:free';
  }

  async analyzeImage({ prompt, imageBase64, mimeType, textContent }: AIImageRequest): Promise<string> {
    // Build message content: text-only for spreadsheets, image+text otherwise
    const contentParts: any[] = [];
    if (textContent) {
      contentParts.push({ type: 'text', text: `${prompt}\n\nDados do arquivo:\n${textContent}` });
    } else if (imageBase64 && mimeType) {
      contentParts.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } });
      contentParts.push({ type: 'text', text: prompt });
    } else {
      contentParts.push({ type: 'text', text: prompt });
    }

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.BACKEND_URL ?? 'http://localhost:3001',
        'X-Title': 'FoodSaaS ERP',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 8192,
        temperature: 0.1,
        messages: [{ role: 'user', content: contentParts }],
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = (await res.json()) as any;
    const text: string = data?.choices?.[0]?.message?.content ?? '';
    if (!text) throw new Error('OpenRouter retornou resposta vazia');
    return text;
  }
}
