import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * O campo "Vídeo Promocional" do produto convida a colar link do YouTube/Vimeo,
 * mas a tag <video> nativa só toca arquivo direto (mp4/webm) — link de página
 * (youtube.com/watch?v=...) carrega um player vazio parado em 0:00, sem erro
 * visível. Detecta YouTube/Vimeo e devolve a URL de embed pra usar em <iframe>;
 * qualquer outro link (mp4 direto, CDN, etc.) continua indo pra <video> como antes.
 */
export function getVideoEmbed(url?: string | null): { type: "iframe" | "video"; src: string } | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();

  const yt = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (yt) {
    return { type: "iframe", src: `https://www.youtube.com/embed/${yt[1]}?autoplay=1&playsinline=1` };
  }

  const vimeo = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) {
    return { type: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1` };
  }

  return { type: "video", src: trimmed };
}
