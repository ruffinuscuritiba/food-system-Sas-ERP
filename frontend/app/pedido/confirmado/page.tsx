"use client";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

function ConfirmadoContent() {
  const params = useSearchParams();
  const orderId = params.get("orderId");
  const mock = params.get("mock");

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6 px-4 text-center text-white">
      <div className="bg-green-500/10 rounded-full p-6">
        <CheckCircle2 size={72} className="text-green-400" />
      </div>
      <h1 className="text-4xl font-black text-green-400">Pagamento confirmado!</h1>
      <p className="text-slate-300 text-lg max-w-sm">
        Seu pedido foi pago com sucesso e já está sendo preparado.
      </p>
      {orderId && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl px-6 py-3 text-sm text-slate-400">
          Pedido <span className="text-white font-mono font-bold">#{orderId.slice(-8).toUpperCase()}</span>
        </div>
      )}
      {mock && (
        <p className="text-xs text-slate-600">
          (modo demonstração — sem gateway configurado)
        </p>
      )}
      <p className="text-slate-400 text-sm">
        Aguarde — em breve você receberá uma confirmação.
      </p>
    </div>
  );
}

export default function PedidoConfirmadoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ConfirmadoContent />
    </Suspense>
  );
}
