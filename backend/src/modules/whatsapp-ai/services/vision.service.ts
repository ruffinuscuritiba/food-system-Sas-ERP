import { Injectable, Logger } from '@nestjs/common';
import { AIProviderFactory } from '@/services/ai/ai-provider.factory';

/**
 * VisionService — descreve imagens/figurinhas recebidas no WhatsApp sem
 * legenda, pra Kely nunca descartar a mensagem em silêncio (achado real do
 * item 186: só `imageMessage.caption` era lido — foto sem texto virava
 * "[WH] skipped — empty phone/text" e o cliente nunca recebia resposta
 * nenhuma, igual comparado ao que Brendi anuncia — "entende texto, áudio,
 * imagem e figurinha").
 *
 * Reaproveita AIProviderFactory (mesmo motor Gemini→OpenRouter→Anthropic já
 * usado pelo Cadastro Inteligente) em vez de um provider novo — já tem
 * fallback simétrico embutido (REGRA PRINCIPAL do CLAUDE.md), suporte a
 * visão em pelo menos 2 dos 3 providers, e nenhuma dependência nova.
 */
@Injectable()
export class VisionService {
  private readonly log = new Logger('VisionService');

  async describeFromUrl(
    imageUrl: string,
    mimeType = 'image/jpeg',
    downloadHeaders: Record<string, string> = {},
  ): Promise<string> {
    try {
      const res = await fetch(imageUrl, {
        headers: downloadHeaders,
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        throw new Error(`Download falhou HTTP ${res.status}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 50) {
        throw new Error(`Imagem suspeita: apenas ${buf.length} bytes`);
      }
      const imageBase64 = buf.toString('base64');

      const chain = AIProviderFactory.buildChain();
      const { result } = await AIProviderFactory.analyzeWithFallback(chain, {
        prompt:
          'Um cliente de uma pizzaria mandou esta imagem pelo WhatsApp, sem escrever nada. ' +
          'Descreva em 1 frase curta e natural o que aparece — se for comida/print de cardápio/comprovante, diga isso; ' +
          'se não for possível identificar, diga apenas "imagem não identificada". Responda só a frase, sem formatação.',
        imageBase64,
        mimeType,
      });
      return result.trim().slice(0, 300);
    } catch (err: any) {
      this.log.warn(`describeFromUrl falhou: ${err?.message}`);
      return 'imagem recebida (não consegui identificar o conteúdo agora)';
    }
  }
}
