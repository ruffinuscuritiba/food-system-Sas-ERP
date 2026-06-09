import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { GenerateCampaignDto } from './dto/generate-campaign.dto';

export interface CampaignResult {
  nome_campanha: string;
  copy_whatsapp: string;
  sugestao_publico: string;
  melhor_horario: string;
  insight_ia: string;
}

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models';

@Injectable()
export class MarketingService {
  private readonly logger = new Logger(MarketingService.name);

  async generateCampaign(dto: GenerateCampaignDto): Promise<CampaignResult> {
    const prompt = this.buildPrompt(dto);

    // Gemini text-only call with JSON mode
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash';

    if (!apiKey) {
      throw new BadRequestException(
        'GEMINI_API_KEY não configurada no servidor.',
      );
    }

    const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`;

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7, // Criativo mas coerente
        responseMimeType: 'application/json',
      },
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err: any) {
      this.logger.error('Gemini fetch error:', err?.message);
      throw new BadRequestException(
        'Falha ao conectar com a IA. Tente novamente.',
      );
    }

    if (!res.ok) {
      const errText = await res.text();
      this.logger.error(`Gemini ${res.status}: ${errText.slice(0, 300)}`);
      throw new BadRequestException(
        `Erro da IA (${res.status}). Tente novamente.`,
      );
    }

    const data = (await res.json()) as any;
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (!text) {
      const reason = data?.candidates?.[0]?.finishReason ?? 'unknown';
      throw new BadRequestException(
        `IA retornou resposta vazia (motivo: ${reason}).`,
      );
    }

    try {
      const parsed: CampaignResult = JSON.parse(text);
      // Garantia de campos obrigatórios
      if (
        !parsed.nome_campanha ||
        !parsed.copy_whatsapp ||
        !parsed.sugestao_publico ||
        !parsed.melhor_horario ||
        !parsed.insight_ia
      ) {
        throw new Error('Campos obrigatórios ausentes na resposta da IA');
      }
      return parsed;
    } catch {
      this.logger.error('Falha ao parsear JSON da IA:', text.slice(0, 500));
      throw new BadRequestException(
        'A IA retornou um formato inesperado. Tente novamente.',
      );
    }
  }

  private buildPrompt(dto: GenerateCampaignDto): string {
    return `Você é o motor de inteligência artificial de um sistema de gestão de vendas e marketing.
Sua função é gerar campanhas de marketing ultra-personalizadas e prontas para execução com base nos dados fornecidos.

Dados do estabelecimento:
- Tipo de Negócio: ${dto.tipoNegocio}
- Objetivo da Campanha: ${dto.objetivo}
- Item/Produto Foco: ${dto.produto}
- Preço Original: R$ ${dto.precoDe}
- Preço Promocional: ${dto.precoPor ? `R$ ${dto.precoPor}` : 'Sem desconto'}
- Tom de Voz da Marca: ${dto.tomVoz}
${dto.contextoExtra ? `- Contexto adicional: ${dto.contextoExtra}` : ''}

Regras estritas:
1. Gere uma copy de WhatsApp curta, persuasiva, com gatilhos mentais e uso estratégico de emojis.
2. Gere uma sugestão de público-alvo baseada nos dados fornecidos.
3. Gere um insight de recomendação de melhor horário para o disparo.
4. Responda APENAS em formato JSON válido, sem qualquer texto explicativo antes ou depois.

O JSON deve seguir exatamente esta estrutura:
{
  "nome_campanha": "Nome interno da campanha",
  "copy_whatsapp": "Texto completo para o disparo",
  "sugestao_publico": "Descrição de qual segmento de clientes focar",
  "melhor_horario": "Sugestão de dia e hora para disparo",
  "insight_ia": "Um conselho rápido de vendas para o dono do negócio sobre este produto"
}`;
  }
}
