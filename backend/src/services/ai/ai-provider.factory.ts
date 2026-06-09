import { AIProvider, AIImageRequest } from './ai-provider.interface';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { AnthropicProvider } from './providers/anthropic.provider';

export class AIProviderFactory {
  /** Build ordered fallback chain based on available API keys. */
  static buildChain(): AIProvider[] {
    const chain: AIProvider[] = [];

    // 1. Gemini Flash — primary (free tier, best OCR)
    try {
      chain.push(new GeminiProvider());
    } catch {}

    // 2. OpenRouter — fallback (free models)
    try {
      chain.push(new OpenRouterProvider());
    } catch {}

    // 3. Anthropic — last resort (premium, optional)
    try {
      chain.push(new AnthropicProvider());
    } catch {}

    return chain;
  }

  /**
   * Try each provider in order, returning the first successful result.
   * Throws a user-friendly error if all providers fail.
   */
  static async analyzeWithFallback(
    providers: AIProvider[],
    params: AIImageRequest,
    onAttempt?: (providerName: string) => void,
  ): Promise<{ result: string; provider: string }> {
    if (providers.length === 0) {
      throw new Error(
        'Nenhum provedor de IA configurado. Adicione GEMINI_API_KEY ao .env',
      );
    }

    const errors: string[] = [];

    for (const provider of providers) {
      try {
        onAttempt?.(provider.name);
        const result = await provider.analyzeImage(params);
        return { result, provider: provider.name };
      } catch (err: any) {
        const msg = err?.message?.slice(0, 120) ?? 'erro desconhecido';
        errors.push(`[${provider.name}] ${msg}`);
      }
    }

    // All failed — log full details server-side (visible in Render logs)
    const detail = errors.join(' | ');
    console.error('[AIProviderFactory] All providers failed:', detail);

    // Surface the first meaningful error so toUserMessage() can map it
    // (quota, 404, timeout, etc.) — only fall back to generic if no detail
    if (errors.length > 0) {
      throw new Error(errors[0]);
    }
    throw new Error(
      'Não foi possível processar a imagem agora. Tente novamente em alguns instantes.',
    );
  }
}
