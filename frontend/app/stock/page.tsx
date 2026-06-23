"use client";
import { useEffect, useState } from "react";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import { Layers, TrendingUp, TrendingDown } from "lucide-react";
import { useNavKeyGuard } from "@/hooks/useNavKeyGuard";

const TYPE_LABELS: Record<string, string> = {
  ENTRY: "Entrada", EXIT: "Saída", LOSS: "Perda",
  INVENTORY: "Inventário", ADJUSTMENT: "Ajuste",
  SALE: "Venda", PURCHASE: "Compra", PRODUCTION: "Produção",
};

export default function StockPage() {
  useNavKeyGuard("stock");
  const [movements, setMovements] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"movements" | "low">("movements");

  function getCompanyId() {
    try { return JSON.parse(localStorage.getItem("user") || "{}").companyId || ""; } catch { return ""; }
  }

  async function load() {
    const companyId = getCompanyId();
    if (!companyId) { setLoading(false); return; }
    try {
      const [mvRes, lowRes] = await Promise.all([
        api.get(`/stock/movements`),
        api.get(`/stock/low-stock`),
      ]);
      setMovements(Array.isArray(mvRes.data) ? mvRes.data : []);
      setLowStock(Array.isArray(lowRes.data) ? lowRes.data : []);
    } catch {
      toast.error("Erro ao carregar movimentações");
      setMovements([]);
      setLowStock([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Layers size={28} className="text-blue-400" />
          <div>
            <h1 className="text-3xl font-bold">Movimentações de Estoque</h1>
            <p className="text-gray-500 text-sm mt-0.5">Entradas, saídas e perdas</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { key: "movements", label: `Movimentações (${movements.length})` },
            { key: "low",       label: `Estoque baixo (${lowStock.length})`, warn: lowStock.length > 0 },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition ${tab === t.key ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-300"} ${t.warn ? "ring-1 ring-red-500" : ""}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "movements" && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 bg-gray-50">
                  {["Ingrediente", "Tipo", "Qtd", "Estoque antes", "Estoque após", "Custo unit.", "Data"].map((h) => (
                    <th key={h} className="text-left px-5 py-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">Carregando...</td></tr>
                ) : movements.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">Nenhuma movimentação registrada</td></tr>
                ) : movements.map((m) => {
                  const isEntry = ["ENTRY","PURCHASE","INVENTORY","ADJUSTMENT"].includes(m.type);
                  return (
                    <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                      <td className="px-5 py-4 font-medium">{m.ingredient?.name || "—"}</td>
                      <td className="px-5 py-4">
                        <span className={`flex items-center gap-1 ${isEntry ? "text-green-400" : "text-red-400"}`}>
                          {isEntry ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          {TYPE_LABELS[m.type] || m.type}
                        </span>
                      </td>
                      <td className="px-5 py-4">{Number(m.quantity).toFixed(2)}</td>
                      <td className="px-5 py-4 text-gray-500">{Number(m.previousStock).toFixed(2)}</td>
                      <td className="px-5 py-4">{Number(m.currentStock).toFixed(2)}</td>
                      <td className="px-5 py-4">{m.unitCost ? `R$ ${Number(m.unitCost).toFixed(2)}` : "—"}</td>
                      <td className="px-5 py-4 text-gray-500">{new Date(m.createdAt).toLocaleDateString("pt-BR")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === "low" && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 bg-gray-50">
                  {["Ingrediente", "Estoque atual", "Estoque mínimo", "Unidade", "Diferença"].map((h) => (
                    <th key={h} className="text-left px-5 py-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lowStock.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-green-400">Estoque em dia!</td></tr>
                ) : lowStock.map((i) => (
                  <tr key={i.id} className="border-b border-gray-100">
                    <td className="px-5 py-4 font-medium text-red-300">{i.name}</td>
                    <td className="px-5 py-4 text-red-400 font-bold">{Number(i.stock).toFixed(2)}</td>
                    <td className="px-5 py-4">{Number(i.minimumStock).toFixed(2)}</td>
                    <td className="px-5 py-4 text-gray-500">{i.unit}</td>
                    <td className="px-5 py-4 text-red-400">{(Number(i.stock) - Number(i.minimumStock)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
