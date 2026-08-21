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
import { RefreshCw, CircleDot, Wallet, Banknote, FileCheck2 } from "lucide-react";

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

type TodaySales = {
  todayCashSales: number;
  todayTotalSales: number;
  orderCount: number;
};

type RegisterHistory = {
  id: string;
  registerNumber: number | null;
  openedByName: string | null;
  closedByName: string | null;
  openingValue: number;
  balance: number;
  declaredValue: number | null;
  systemValue: number | null;
  difference: number | null;
  closedAt: string | null;
};

const fmt = (v: number) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MercadoControlePage() {
  const [registers, setRegisters] = useState<Register[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [todaySales, setTodaySales] = useState<TodaySales>({
    todayCashSales: 0,
    todayTotalSales: 0,
    orderCount: 0,
  });
  const [history, setHistory] = useState<RegisterHistory[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await api.get("/cash/registers");
      setRegisters(Array.isArray(r.data) ? r.data : []);
      const s = await api.get("/cash/today-cash-sales");
      if (s.data) setTodaySales(s.data);
      const h = await api.get("/cash/history");
      setHistory(Array.isArray(h.data) ? h.data : []);
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
  const totalHoje = todaySales.todayCashSales;
  const totalVendas = todaySales.todayTotalSales;
  const totalSuprimentos = registers.reduce((s, r) => s + Number(r.entries || 0), 0);
  const caixasAbertos = registers.filter((r) => r).length;
  const recentClosings = history.slice(0, 8);

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

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Banknote size={12} /> Vendas em dinheiro hoje</p>
              <p className="text-2xl font-bold">R$ {fmt(totalHoje)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Wallet size={12} /> Vendas totais hoje</p>
              <p className="text-2xl font-bold">R$ {fmt(totalVendas)}</p>
              <p className="text-xs text-gray-400 mt-1">{todaySales.orderCount} pedidos</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-400 mb-1">Suprimentos (entries)</p>
              <p className="text-2xl font-bold">R$ {fmt(totalSuprimentos)}</p>
              <p className="text-xs text-gray-400 mt-1">movimentações de entrada</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-400 mb-1">Caixas abertos</p>
              <p className="text-2xl font-bold">{caixasAbertos} / 5</p>
            </div>
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
                      <div className="mt-3 flex gap-1.5">
                        <a
                          href={`/pdv-mercado`}
                          className="flex-1 text-center text-[10px] font-bold text-blue-600 border border-blue-200 rounded-md py-1.5 hover:bg-blue-50"
                        >
                          Operar
                        </a>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400 mt-2">Fechado</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileCheck2 size={16} className="text-gray-400" />
              <h2 className="text-sm font-bold">Fechamentos recentes</h2>
            </div>
            {recentClosings.length === 0 ? (
              <p className="text-xs text-gray-400">Nenhum fechamento registrado ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-400 text-xs">
                      <th className="text-left font-normal px-3 py-2">Caixa</th>
                      <th className="text-left font-normal px-3 py-2">Fechado por</th>
                      <th className="text-right font-normal px-3 py-2">Sistema</th>
                      <th className="text-right font-normal px-3 py-2">Contado</th>
                      <th className="text-right font-normal px-3 py-2">Diferença</th>
                      <th className="text-right font-normal px-3 py-2">Horário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentClosings.map((c) => {
                      const diff = Number(c.difference || 0);
                      return (
                        <tr key={c.id} className="border-t border-gray-100">
                          <td className="px-3 py-2 font-semibold">Caixa {c.registerNumber ?? "—"}</td>
                          <td className="px-3 py-2">{c.closedByName || c.openedByName || "—"}</td>
                          <td className="text-right px-3 py-2">R$ {fmt(Number(c.systemValue))}</td>
                          <td className="text-right px-3 py-2">R$ {fmt(Number(c.declaredValue))}</td>
                          <td className={`text-right px-3 py-2 font-semibold ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-gray-400"}`}>
                            {diff > 0 ? "+" : ""}{fmt(diff)}
                          </td>
                          <td className="text-right px-3 py-2 text-gray-400">
                            {c.closedAt ? new Date(c.closedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </RoleGuard>
  );
}
