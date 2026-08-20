"use client";

/**
 * Painel de controle interno — módulo Mercado.
 * Visão ao vivo de todos os caixas abertos agora (até 5), pro gerente
 * acompanhar sem precisar sair da própria tela. Sistema visualmente
 * independente do resto do painel — dedicado a operação de loja física.
 */

import { useCallback, useEffect, useState } from "react";
import { api } from "@/services/api";
import { RoleGuard } from "@/components/role-guard";
import { RefreshCw, CircleDot } from "lucide-react";

type Register = {
  id: string;
  registerNumber: number | null;
  terminalName: string | null;
  openedByName: string | null;
  openingValue: number;
  balance: number;
  entries: number;
  createdAt: string;
};

const fmt = (v: number) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MercadoControlePage() {
  const [registers, setRegisters] = useState<Register[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get("/cash/registers");
      setRegisters(Array.isArray(r.data) ? r.data : []);
      setLastUpdate(new Date());
    } catch {
      /* silent — mantém último estado conhecido na tela */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const slots = Array.from({ length: 5 }, (_, i) => i + 1).map(
    (n) => registers.find((r) => r.registerNumber === n) ?? null,
  );
  const totalHoje = registers.reduce((s, r) => s + Number(r.entries || 0), 0);

  return (
    <RoleGuard allowedRoles={["SUPER_ADMIN", "ADMIN", "MANAGER"]}>
      <main className="min-h-screen bg-gray-100 text-gray-900 font-sans p-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-xl font-bold">Controle de caixas</h1>
              <p className="text-sm text-gray-500">
                {registers.length} de 5 abertos {lastUpdate && `· atualizado ${lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
              </p>
            </div>
            <button onClick={load} className="flex items-center gap-1.5 text-sm border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-white">
              <RefreshCw size={14} />Atualizar
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
            <p className="text-xs text-gray-400 mb-1">Vendas em dinheiro — todos os caixas</p>
            <p className="text-3xl font-bold">R$ {fmt(totalHoje)}</p>
          </div>

          {loading ? (
            <div className="text-center text-gray-400 py-12 text-sm">Carregando...</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {slots.map((reg, i) => (
                <div
                  key={i}
                  className={`bg-white rounded-xl p-4 ${reg ? "border border-gray-200" : "border border-dashed border-gray-200 opacity-60"}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold">Caixa {i + 1}</span>
                    <CircleDot size={10} className={reg ? "text-green-500" : "text-gray-300"} />
                  </div>
                  {reg ? (
                    <>
                      <p className="text-xs text-gray-500 mb-2 truncate">{reg.openedByName || "Operador"}</p>
                      <p className="text-lg font-bold">R$ {fmt(reg.balance)}</p>
                      <p className="text-xs text-gray-400">
                        abertura R$ {fmt(reg.openingValue)}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400 mt-2">Fechado</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </RoleGuard>
  );
}
