"use client";

import { api } from "@/services/api";
import { useState } from "react";

type Props = {
  value?: string;
  onChange: (url: string) => void;
};

export default function ImageUpload({ value, onChange }: Props) {

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function uploadImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onChange(response.data.url);
    } catch {
      setError("Falha no upload. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
      // Reset input so same file can be re-uploaded
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
        <div className={`border rounded-2xl p-6 text-center transition ${
          loading
            ? "bg-slate-800 border-slate-600 cursor-not-allowed"
            : "bg-slate-900 border-slate-700 hover:border-green-500"
        }`}>
          {loading ? (
            <span className="flex items-center justify-center gap-2 text-slate-400">
              <span className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              Enviando...
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

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

    </div>
  );
}
