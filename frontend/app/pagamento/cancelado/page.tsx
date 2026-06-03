"use client";
import Link from "next/link";

export default function PagamentoCanceladoPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-7xl mb-6">😔</div>
        <h1 className="text-3xl font-black mb-3">Pagamento cancelado</h1>
        <p className="text-slate-400 mb-8">
          Nenhuma cobrança foi realizada. Você pode tentar novamente quando quiser.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/planos"
            className="rounded-xl bg-red-500 px-8 py-3 font-bold hover:bg-red-600 transition"
          >
            Tentar novamente
          </Link>
          <Link
            href="/pdv"
            className="rounded-xl border border-slate-700 px-8 py-3 font-semibold hover:border-slate-500 transition"
          >
            Voltar ao painel
          </Link>
        </div>
      </div>
    </div>
  );
}
