"use client";
/**
 * ImageUploaderPreview — upload com preview instantâneo + drag-to-reposition.
 *
 * Comprime client-side (max 1200px, q=0.82) e retorna base64.
 * Drag na imagem define o focal point via object-position.
 */

import { useRef, useState, useCallback } from "react";
import { ImageIcon, Trash2, RefreshCw, ZoomIn, Move } from "lucide-react";

interface Props {
  value?: string;                              // URL ou data URL existente
  onChange: (url: string | null) => void;
  /** "50% 50%" — posição atual do focal point */
  position?: string;
  /** Chamado ao arrastar para reposicionar */
  onPositionChange?: (pos: string) => void;
  maxDimension?: number;
  quality?: number;
  /** Tamanho máximo do arquivo ORIGINAL antes da compressão. Default 5 MB. */
  maxFileSizeMB?: number;
  className?: string;
  /**
   * Zoom em %, 30–150 (100 = padrão). Quando fornecido junto com onZoomChange,
   * exibe uma barra de zoom abaixo do preview E aplica o mesmo scale() na
   * imagem exibida aqui — o preview passa a mostrar o corte real (WYSIWYG),
   * em vez de só guardar um número que só é aplicado em outra tela.
   */
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  /**
   * Classe Tailwind de altura do preview (default "h-48"). Passe uma altura
   * baixa (ex: "h-24") quando a imagem final renderiza numa faixa larga e
   * baixa (banner de categoria), para o preview cortar na mesma proporção
   * do resultado real — sem isso o corte parece certo aqui e errado lá.
   */
  previewHeightClassName?: string;
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

/** Parse "X% Y%" → {x, y}. Fallback 50/50. */
function parsePos(pos?: string): { x: number; y: number } {
  if (!pos) return { x: 50, y: 50 };
  const [xs, ys] = pos.split(" ");
  return { x: parseInt(xs) || 50, y: parseInt(ys) || 50 };
}

export function ImageUploaderPreview({
  value,
  onChange,
  position,
  onPositionChange,
  maxDimension = 1200,
  quality = 0.82,
  maxFileSizeMB = 5,
  className = "",
  zoom,
  onZoomChange,
  previewHeightClassName = "h-48",
}: Props) {
  const inputRef      = useRef<HTMLInputElement>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const [loading,    setLoading]   = useState(false);
  const [zoomModalOpen, setZoomModalOpen] = useState(false);
  const [error,      setError]     = useState("");
  const [moveMode,   setMoveMode]  = useState(false);
  const [dragging,   setDragging]  = useState(false);

  // Internal pos state — controlled by prop if provided
  const [internalPos, setInternalPos] = useState<{ x: number; y: number }>(parsePos(position));
  const pos = position ? parsePos(position) : internalPos;
  const objectPos = `${pos.x}% ${pos.y}%`;

  // ─── Drag-to-reposition ────────────────────────────────────────────────────

  const applyPos = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.round(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width)  * 100)));
    const y = Math.round(Math.max(0, Math.min(100, ((e.clientY - rect.top)  / rect.height) * 100)));
    setInternalPos({ x, y });
    onPositionChange?.(`${x}% ${y}%`);
  }, [onPositionChange]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!moveMode) return;
    e.preventDefault();
    setDragging(true);
    applyPos(e);
  }, [moveMode, applyPos]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    applyPos(e);
  }, [dragging, applyPos]);

  const onMouseUp = useCallback(() => setDragging(false), []);

  // ─── File handling ─────────────────────────────────────────────────────────

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Apenas imagens são aceitas (JPG, PNG, WEBP)");
      return;
    }
    const maxBytes = maxFileSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setError(`Imagem muito grande: ${sizeMB} MB. Máximo: ${maxFileSizeMB} MB.`);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const b64 = await compressToBase64(file, maxDimension, quality);
      onChange(b64);
      // reset position when image is replaced
      setInternalPos({ x: 50, y: 50 });
      onPositionChange?.("50% 50%");
      setMoveMode(false);
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

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={`relative rounded-2xl overflow-hidden border-2 border-orange-200 bg-orange-50 flex flex-col items-center justify-center gap-2 ${previewHeightClassName} ${className}`}>
        <div className="w-8 h-8 border-3 border-orange-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-orange-500 font-semibold">Comprimindo…</p>
      </div>
    );
  }

  // ─── Preview (image exists) ────────────────────────────────────────────────

  if (value) {
    return (
      <div className={`relative group ${className}`}>

        {/* Zoom modal */}
        {zoomModalOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setZoomModalOpen(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="preview ampliado" className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain" />
          </div>
        )}

        <div
          ref={containerRef}
          className={`relative rounded-2xl overflow-hidden border-2 border-gray-100 shadow-sm select-none bg-gray-50 ${previewHeightClassName}`}
          style={{ cursor: moveMode ? (dragging ? "grabbing" : "grab") : undefined }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            draggable={false}
            src={value}
            alt="preview"
            className="w-full h-full object-cover transition-[object-position,transform] duration-100"
            style={{ objectPosition: objectPos, transform: `scale(${(zoom ?? 100) / 100})`, transformOrigin: "center center" }}
            onError={() => onChange(null)}
          />

          {/* Move-mode hint banner */}
          {moveMode && (
            <div className="absolute top-0 inset-x-0 bg-indigo-600/90 text-white text-[10px] font-semibold text-center py-1.5 pointer-events-none">
              ✥ Arraste para reposicionar · {pos.x}% {pos.y}%
            </div>
          )}

          {/* Focal-point crosshair */}
          {moveMode && (
            <div
              className="absolute w-5 h-5 pointer-events-none"
              style={{
                left: `${pos.x}%`,
                top:  `${pos.y}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div className="absolute inset-x-0 top-1/2 h-[1.5px] bg-white/80" />
              <div className="absolute inset-y-0 left-1/2 w-[1.5px] bg-white/80" />
              <div className="absolute inset-[4px] rounded-full border-2 border-white/80" />
            </div>
          )}

          {/* Overlay action buttons */}
          {!moveMode && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
              <button
                type="button"
                onClick={() => setZoomModalOpen(true)}
                className="w-10 h-10 rounded-xl bg-white/90 hover:bg-white flex items-center justify-center shadow-lg transition"
                title="Ampliar"
              >
                <ZoomIn size={16} className="text-gray-700" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setMoveMode(true); }}
                className="w-10 h-10 rounded-xl bg-white/90 hover:bg-white flex items-center justify-center shadow-lg transition"
                title="Mover / Reposicionar"
              >
                <Move size={16} className="text-gray-700" />
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
          )}

          {/* Move-mode exit button */}
          {moveMode && (
            <button
              type="button"
              onClick={() => setMoveMode(false)}
              className="absolute bottom-2 right-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold shadow-lg transition"
            >
              ✓ Confirmar posição
            </button>
          )}
        </div>

        {onZoomChange && (
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-gray-500">
              <span>Zoom da imagem</span>
              <span className="font-semibold text-gray-700">{zoom ?? 100}%</span>
            </div>
            <input
              type="range"
              min={30}
              max={150}
              step={5}
              value={zoom ?? 100}
              onChange={(e) => onZoomChange(Number(e.target.value))}
              className="w-full accent-orange-500"
            />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>Menor</span><span>Normal</span><span>Zoom +</span>
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleChange}
        />

        {error && (
          <div className="mt-2 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}
      </div>
    );
  }

  // ─── Empty state (drop zone) ───────────────────────────────────────────────

  return (
    <div
      className={`relative ${className}`}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <label className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-200 hover:border-orange-400 rounded-2xl cursor-pointer transition-all duration-200 hover:bg-orange-50 group ${previewHeightClassName}`}>
        <div className="w-12 h-12 rounded-2xl bg-gray-100 group-hover:bg-orange-100 flex items-center justify-center transition">
          <ImageIcon size={20} className="text-gray-400 group-hover:text-orange-500 transition" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-500 group-hover:text-orange-600 transition">
            Clique ou arraste uma imagem
          </p>
          <p className="text-xs text-gray-400 mt-0.5">JPG, PNG, WEBP · max {maxFileSizeMB} MB</p>
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
