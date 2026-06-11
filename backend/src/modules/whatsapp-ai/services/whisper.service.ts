import { Injectable, Logger } from '@nestjs/common';
import { writeFileSync, unlinkSync, readFileSync, existsSync } from 'fs';
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
      this.log.warn(
        'OPENAI_API_KEY não configurado — transcrição Whisper ignorada',
      );
      return '[transcrição de áudio indisponível — OPENAI_API_KEY ausente]';
    }

    this.log.log(
      `[Whisper] Iniciando transcrição | mimeType=${mimeType} | url=${audioUrl.slice(0, 80)}...`,
    );
    this.log.log(
      `[Whisper] Headers de download: ${JSON.stringify(Object.keys(downloadHeaders))}`,
    );

    const ext = this.mimeToExt(mimeType);
    const tmpPath = join(tmpdir(), `wa_audio_${Date.now()}${ext}`);

    // Tenta a transcrição até 2 vezes antes de desistir
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        // ── Etapa 1: Download do áudio ─────────────────────────────────────
        this.log.log(`[Whisper] Tentativa ${attempt}/2 — baixando áudio...`);
        const downloadRes = await fetch(audioUrl, {
          headers: downloadHeaders,
          signal: AbortSignal.timeout(30_000),
        });

        if (!downloadRes.ok) {
          const errText = await downloadRes.text().catch(() => '');
          throw new Error(
            `Download falhou HTTP ${downloadRes.status}: ${errText.slice(0, 120)}`,
          );
        }

        const buf = Buffer.from(await downloadRes.arrayBuffer());
        this.log.log(
          `[Whisper] Download OK: ${buf.length} bytes (tipo: ${downloadRes.headers.get('content-type') ?? 'desconhecido'})`,
        );

        // Arquivo corrompido ou vazio
        if (buf.length < 100) {
          throw new Error(
            `Arquivo de áudio suspeito: apenas ${buf.length} bytes — possível link expirado ou mídia corrompida`,
          );
        }

        writeFileSync(tmpPath, buf);

        // ── Etapa 2: Envio para Whisper API ───────────────────────────────
        const mimeBase = mimeType.split(';')[0].trim(); // remove '; codecs=opus'
        const fileBlob = new Blob([readFileSync(tmpPath)], { type: mimeBase });
        const formData = new FormData();
        formData.append('file', fileBlob, `audio${ext}`);
        formData.append('model', 'whisper-1');
        formData.append('language', 'pt');
        formData.append('response_format', 'text');

        this.log.log(
          `[Whisper] Enviando para OpenAI Whisper: ${buf.length} bytes, ext=${ext}, mimeBase=${mimeBase}`,
        );

        const whisperRes = await fetch(
          'https://api.openai.com/v1/audio/transcriptions',
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}` },
            body: formData,
            signal: AbortSignal.timeout(60_000),
          },
        );

        if (!whisperRes.ok) {
          const errBody = await whisperRes.text();
          throw new Error(
            `Whisper API HTTP ${whisperRes.status}: ${errBody.slice(0, 300)}`,
          );
        }

        const transcript = (await whisperRes.text()).trim();

        if (!transcript) {
          throw new Error('Whisper retornou transcrição vazia (áudio silencioso ou formato inválido)');
        }

        this.log.log(
          `[Whisper] Transcrição OK (tentativa ${attempt}): "${transcript.slice(0, 120)}"`,
        );
        return transcript;
      } catch (err: any) {
        this.log.error(
          `[Whisper] Falha na tentativa ${attempt}/2: ${err?.message}`,
        );
        if (attempt === 2) {
          this.log.error(
            '[Whisper] Esgotadas as 2 tentativas — retornando placeholder',
          );
        } else {
          this.log.warn('[Whisper] Aguardando 1s antes de retry...');
          await new Promise((r) => setTimeout(r, 1_000));
        }
      } finally {
        // Limpa arquivo temp independente de sucesso ou falha
        try {
          if (existsSync(tmpPath)) unlinkSync(tmpPath);
        } catch {
          /* ignora falha de limpeza */
        }
      }
    }

    return '[não foi possível transcrever o áudio]';
  }

  // ── Utilitário: obtém URL real de mídia da Meta Cloud API ──────────────────

  async fetchMetaMediaUrl(
    mediaId: string,
    accessToken: string,
  ): Promise<string | null> {
    try {
      const res = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10_000),
      });
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
    if (mimeType.includes('ogg')) return '.ogg';
    if (mimeType.includes('mp3') || mimeType.includes('mpeg')) return '.mp3';
    if (mimeType.includes('mp4') || mimeType.includes('m4a')) return '.m4a';
    if (mimeType.includes('wav')) return '.wav';
    if (mimeType.includes('webm')) return '.webm';
    if (mimeType.includes('amr')) return '.amr';
    return '.ogg'; // padrão WhatsApp PTT
  }
}
