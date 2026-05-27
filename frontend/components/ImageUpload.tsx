"use client";

import { apiBaseUrl } from "@/services/env";
import { useState } from "react";

type Props = {
  value?: string;
  onChange: (url: string) => void;
  /** Max width/height for resize (default 1200). Set lower for logos. */
  maxDimension?: number;
  /** JPEG quality 0–1 (default 0.82) */
  quality?: number;
};

/**
 * Compresses and converts the selected image to a base64 data URL client-side.
 * Falls back to backend /upload (Cloudinary) only if the result exceeds 3 MB.
 * This avoids ephemeral-filesystem issues on Render.
 */
export default function ImageUpload({
  value,
  onChange,
  maxDimension = 1200,
  quality = 0.82,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function compress(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = (ev) => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            const ratio = Math.min(maxDimension / width, maxDimension / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  async function uploadImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");

    try {
      // 1. Try client-side compression → base64 data URL
      const dataUrl = await compress(file);

      // If resulting base64 is small enough (<= 3 MB), use it directly
      if (dataUrl.length <= 3 * 1024 * 1024) {
        onChange(dataUrl);
        return;
      }

      // 2. Fallback: upload to backend (Cloudinary or local disk)
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${apiBaseUrl}/upload`, {
        method: "POST",
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as any).message || `HTTP ${response.status}`);
      }
      const data = await response.json();
      onChange(data.url);
    } catch {
      setError("Falha no upload. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  return (
    <div className="space-y-4">
      {value && (
        <img
          src={value}
          className="w-full h-64 object-cover rounded-3xl border border-slate-700"
          alt="Preview"
        />
      )}

      <label className="block cursor-pointer">
        <div
          className={`border rounded-2xl p-6 text-center transition ${
            loading
              ? "bg-slate-800 border-slate-600 cursor-not-allowed"
              : "bg-slate-900 border-slate-700 hover:border-green-500"
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2 text-slate-400">
              <span className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              Processando...
            </span>
          ) : (
            <span className="text-slate-400 hover:text-white transition">
              {value ? "Trocar imagem" : "Selecionar imagem"}
            </span>
          )}
        </div>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={loading}
          onChange={uploadImage}
        />
      </label>

      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}
