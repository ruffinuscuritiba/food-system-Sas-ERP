"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function GarcomCardapio() {
  const router = useRouter();

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      <h1 className="text-xl font-bold text-gray-900 mb-2">Cardápio</h1>
      <p className="text-sm text-gray-500 mb-6">
        Para adicionar itens ao pedido, acesse uma mesa e use o cardápio integrado.
      </p>

      <button
        onClick={() => router.push("/garcom")}
        className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition"
      >
        <ArrowLeft size={16} />
        Ver Mesas
      </button>
    </div>
  );
}
