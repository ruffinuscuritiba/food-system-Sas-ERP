import { Injectable, Logger } from '@nestjs/common';
import { writeFileSync, unlinkSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * WhisperService — transcreve áudios do WhatsApp via OpenAI Whisper API.
 *
 * Env obrigatória: OPENAI_API_KEY
 *
 * Fluxo:
 *   1. Baixa o áudio da URL (autenticado ou público)
 *   2. Grava em arquivo temporário
 *   3. Envia para /v1/audio/transcriptions (Whisper-1)
 *   4. Retorna texto transcrito
 *   5. Remove o arquivo temporário
 *
 * Se OPENAI_API_KEY não estiver configurada, retorna placeholder sem lançar erro.
 */
@Injectable()
export class WhisperService {
  private readonly log = new Logger('WhisperService');

  // ── Transcrição a partir de URL direta ─────────────────────────────────────

  async transcribeFromUrl(
    audioUrl: string,
    mimeType = 'audio/ogg',
    downloadHeaders: Record<string, string> = {},
  ): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      this.log.warn('OPENAI_API_KEY não configurado — transcrição Whisper ignorada');
      return '[transcrição de áudio indisponível — OPENAI_API_KEY ausente]';
    }

    const ext     = this.mimeToExt(mimeType);
    const tmpPath = join(tmpdir(), `wa_audio_${Date.now()}${ext}`);

    try {
      // 1. Download do áudio
      const downloadRes = await fetch(audioUrl, {
        headers: downloadHeaders,
        signal:  AbortSignal.timeout(30_000),
      });
      if (!downloadRes.ok) {
        throw new Error(`Download do áudio falhou: HTTP ${downloadRes.status}`);
      }
      const buf = Buffer.from(await downloadRes.arrayBuffer());
      writeFileSync(tmpPath, buf);
      this.log.log(`Áudio baixado: ${buf.length} bytes → ${tmpPath}`);

      // 2. Enviar para Whisper API
      const mimeBase = mimeType.split(';')[0].trim(); // remove '; codecs=opus'
      const fileBlob = new Blob([readFileSync(tmpPath)], { type: mimeBase });
      const formData = new FormData();
      formData.append('file', fileBlob, `audio${ext}`);
      formData.append('model', 'whisper-1');
      formData.append('language', 'pt');
      formData.append('response_format', 'text');

      const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method:  'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body:    formData,
        signal:  AbortSignal.timeout(60_000),
      });

      if (!whisperRes.ok) {
        const errBody = await whisperRes.text();
        throw new Error(`Whisper API HTTP ${whisperRes.status}: ${errBody.slice(0, 200)}`);
      }

      const transcript = (await whisperRes.text()).trim();
      this.log.log(`Whisper transcreveu (${ext}): "${transcript.slice(0, 100)}"`);
      return transcript;

    } catch (err: any) {
      this.log.error(`WhisperService.transcribeFromUrl: ${err?.message}`);
      return '[não foi possível transcrever o áudio]';
    } finally {
      try { unlinkSync(tmpPath); } catch { /* arquivo pode não existir */ }
    }
  }

  // ── Utilitário: obtém URL real de mídia da Meta Cloud API ──────────────────

  async fetchMetaMediaUrl(mediaId: string, accessToken: string): Promise<string | null> {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v18.0/${mediaId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal:  AbortSignal.timeout(10_000),
        },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as any;
      return data?.url ?? null;
    } catch (err: any) {
      this.log.warn(`fetchMetaMediaUrl: ${err?.message}`);
      return null;
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private mimeToExt(mimeType: string): string {
    if (mimeType.includes('ogg'))                    return '.ogg';
    if (mimeType.includes('mp3') || mimeType.includes('mpeg')) return '.mp3';
    if (mimeType.includes('mp4') || mimeType.includes('m4a')) return '.m4a';
    if (mimeType.includes('wav'))                    return '.wav';
    if (mimeType.includes('webm'))                   return '.webm';
    if (mimeType.includes('amr'))                    return '.amr';
    return '.ogg'; // padrão WhatsApp PTT
  }
}
