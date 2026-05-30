"use client";
/**
 * ImageUploaderPreview — upload com preview instantâneo.
 *
 * Comprime client-side (max 1200px, q=0.82) e retorna base64.
 * Zero dependência de backend para preview.
 */

import { useRef, useState } from "react";
import { ImageIcon, Trash2, RefreshCw, ZoomIn } from "lucide-react";

interface Props {
  value?: string;               // URL ou data URL existente
  onChange: (url: string | null) => void;
  maxDimension?: number;
  quality?: number;
  /** Tamanho máximo do arquivo ORIGINAL antes da compressão. Default 5 MB. */
  maxFileSizeMB?: number;
  className?: string;
}

async function compressToBase64(file: File, maxDim = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const r = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * r);
          height = Math.round(height * r);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function ImageUploaderPreview({
  value,
  onChange,
  maxDimension = 1200,
  quality = 0.82,
  maxFileSizeMB = 5,
  className = "",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Apenas imagens são aceitas (JPG, PNG, WEBP)");
      return;
    }
    // A-02 — validação visual de tamanho antes do envio
    const maxBytes = maxFileSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setError(`Imagem muito grande: ${sizeMB} MB. Máximo: ${maxFileSizeMB} MB. Reduza no celular ou use um app de compressão.`);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const b64 = await compressToBase64(file, maxDimension, quality);
      onChange(b64);
    } catch {
      setError("Falha ao processar imagem. Tente outro arquivo.");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  if (loading) {
    return (
      <div className={`relative rounded-2xl overflow-hidden border-2 border-orange-200 bg-orange-50 flex flex-col items-center justify-center gap-2 h-48 ${className}`}>
        <div className="w-8 h-8 border-3 border-orange-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-orange-500 font-semibold">Comprimindo…</p>
      </div>
    );
  }

  if (value) {
    return (
      <div className={`relative group ${className}`}>
        {/* Zoom modal */}
        {zoom && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setZoom(false)}
          >
            <img src={value} alt="preview ampliado" className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain" />
          </div>
        )}

        <div className="relative rounded-2xl overflow-hidden border-2 border-gray-100 shadow-sm h-48">
          <img
            src={value}
            alt="preview"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => onChange(null)}
          />
          {/* Overlay actions */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
            <button
              type="button"
              onClick={() => setZoom(true)}
              className="w-10 h-10 rounded-xl bg-white/90 hover:bg-white flex items-center justify-center shadow-lg transition"
              title="Ampliar"
            >
              <ZoomIn size={16} className="text-gray-700" />
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-10 h-10 rounded-xl bg-white/90 hover:bg-white flex items-center justify-center shadow-lg transition"
              title="Trocar"
            >
              <RefreshCw size={16} className="text-gray-700" />
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="w-10 h-10 rounded-xl bg-red-500/90 hover:bg-red-500 flex items-center justify-center shadow-lg transition"
              title="Remover"
            >
              <Trash2 size={16} className="text-white" />
            </button>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleChange}
        />
      </div>
    );
  }

  return (
    <div
      className={`relative ${className}`}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <label className="flex flex-col items-center justify-center gap-3 h-48 border-2 border-dashed border-gray-200 hover:border-orange-400 rounded-2xl cursor-pointer transition-all duration-200 hover:bg-orange-50 group">
        <div className="w-12 h-12 rounded-2xl bg-gray-100 group-hover:bg-orange-100 flex items-center justify-center transition">
          <ImageIcon size={20} className="text-gray-400 group-hover:text-orange-500 transition" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-500 group-hover:text-orange-600 transition">
            Clique ou arraste uma imagem
          </p>
          <p className="text-xs text-gray-400 mt-0.5">JPG, PNG, WEBP · max 20 MB</p>
        </div>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleChange}
        />
      </label>
      {error && (
        <div className="mt-2 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}
    </div>
  );
}
