import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, AIImageRequest } from '../ai-provider.interface';

const VALID_MIMES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;
type ValidMime = (typeof VALID_MIMES)[number];

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  private client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
    this.client = new Anthropic({ apiKey });
  }

  async analyzeImage({
    prompt,
    imageBase64,
    mimeType,
    textContent,
  }: AIImageRequest): Promise<string> {
    let content: any[];

    if (textContent) {
      // Text-only request (PDF with extracted text, spreadsheet, etc.)
      content = [
        {
          type: 'text',
          text: `${prompt}\n\nDados do arquivo:\n${textContent}`,
        },
      ];
    } else if (imageBase64) {
      const validMime: ValidMime =
        VALID_MIMES.find((m) => m === mimeType) ?? 'image/jpeg';
      content = [
        {
          type: 'image',
          source: { type: 'base64', media_type: validMime, data: imageBase64 },
        },
        { type: 'text', text: prompt },
      ];
    } else {
      throw new Error(
        'Anthropic: nenhum conteúdo fornecido (sem imagem nem texto)',
      );
    }

    const response = await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      messages: [{ role: 'user', content }],
    });

    const text = (response.content[0] as any)?.text as string;
    if (!text) throw new Error('Anthropic retornou resposta vazia');
    return text;
  }
}
