import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, AIImageRequest } from '../ai-provider.interface';

const VALID_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
type ValidMime = typeof VALID_MIMES[number];

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  private client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
    this.client = new Anthropic({ apiKey });
  }

  async analyzeImage({ prompt, imageBase64, mimeType }: AIImageRequest): Promise<string> {
    const validMime: ValidMime = VALID_MIMES.find(m => m === mimeType) ?? 'image/jpeg';

    const response = await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: validMime as any, data: imageBase64 as any } },
          { type: 'text', text: prompt },
        ],
      }],
    });

    const text = (response.content[0] as any).text as string;
    if (!text) throw new Error('Anthropic retornou resposta vazia');
    return text;
  }
}
