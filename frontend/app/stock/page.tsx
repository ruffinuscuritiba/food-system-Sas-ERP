"use client";
import { useEffect, useState } from "react";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import { Layers, TrendingUp, TrendingDown, Printer } from "lucide-react";
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

  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterType, setFilterType] = useState("");

  function getCompanyId() {
    try { return JSON.parse(localStorage.getItem("user") || "{}").companyId || ""; } catch { return ""; }
  }

  async function load() {
    const companyId = getCompanyId();
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);
      if (filterType) params.set("type", filterType);
      const qs = params.toString();

      const [mvRes, lowRes] = await Promise.all([
        api.get(`/stock/movements${qs ? `?${qs}` : ""}`),
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

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function clearFilters() {
    setFilterFrom("");
    setFilterTo("");
    setFilterType("");
    setTimeout(load, 0);
  }

  function printReport() {
    if (movements.length === 0) {
      toast.error("Nenhuma movimentação para imprimir com esse filtro");
      return;
    }

    const rows = movements.map((m) => `
      <tr>
        <td>${new Date(m.createdAt).toLocaleDateString("pt-BR")}</td>
        <td>${m.ingredient?.name ?? "—"}</td>
        <td>${TYPE_LABELS[m.type] || m.type}</td>
        <td style="text-align:right">${Number(m.quantity).toFixed(2)}</td>
        <td style="text-align:right">${m.unitCost ? `R$ ${Number(m.unitCost).toFixed(2)}` : "—"}</td>
        <td style="text-align:right">${m.totalCost ? `R$ ${Number(m.totalCost).toFixed(2)}` : "—"}</td>
        <td>${m.reason ?? "—"}</td>
      </tr>
    `).join("");

    const totalValue = movements.reduce((sum, m) => sum + (Number(m.totalCost) || 0), 0);
    const periodLabel = `${filterFrom ? new Date(filterFrom).toLocaleDateString("pt-BR") : "início"} até ${filterTo ? new Date(filterTo).toLocaleDateString("pt-BR") : "hoje"}`;
    const typeLabel = filterType ? (TYPE_LABELS[filterType] || filterType) : "Todos os tipos";

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Movimentações de Estoque</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p.sub { color: #555; font-size: 12px; margin: 0 0 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  th { background: #f0f0f0; }
  tfoot td { font-weight: bold; background: #fafafa; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>Movimentações de Estoque</h1>
  <p class="sub">Período: ${periodLabel} — Tipo: ${typeLabel} — Gerado em ${new Date().toLocaleString("pt-BR")}</p>
  <table>
    <thead>
      <tr><th>Data</th><th>Ingrediente</th><th>Tipo</th><th>Qtd</th><th>Custo unit.</th><th>Total</th><th>Nota / Motivo</th></tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr><td colspan="5"></td><td>R$ ${totalValue.toFixed(2)}</td><td></td></tr>
    </tfoot>
  </table>
</body>
</html>`;

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) {
      toast.error("Permita pop-ups no navegador para gerar o PDF");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
          <div className="flex items-center gap-3">
            <Layers size={28} className="text-blue-400" />
            <div>
              <h1 className="text-3xl font-bold">Movimentações de Estoque</h1>
              <p className="text-gray-500 text-sm mt-0.5">Entradas, saídas e perdas</p>
            </div>
          </div>
          {tab === "movements" && (
            <button
              onClick={printReport}
              className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition"
            >
              <Printer size={16} /> Imprimir / Exportar PDF
            </button>
          )}
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
          <>
            {/* Filtros */}
            <div className="flex flex-wrap items-end gap-3 mb-4 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              <div>
                <label className="block text-xs text-gray-500 mb-1">De</label>
                <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Até</label>
                <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tipo</label>
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Todos</option>
                  {Object.entries(TYPE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </div>
              <button onClick={load} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
                Aplicar filtro
              </button>
              <button onClick={clearFilters} className="text-gray-500 hover:text-gray-700 text-sm px-2 py-2 transition">
                Limpar
              </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 bg-gray-50">
                    {["Ingrediente", "Tipo", "Qtd", "Estoque antes", "Estoque após", "Custo unit.", "Nota / Motivo", "Data"].map((h) => (
                      <th key={h} className="text-left px-5 py-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400">Carregando...</td></tr>
                  ) : movements.length === 0 ? (
                    <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400">Nenhuma movimentação registrada</td></tr>
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
                        <td className="px-5 py-4 text-gray-500 max-w-[220px] truncate" title={m.reason || ""}>{m.reason || "—"}</td>
                        <td className="px-5 py-4 text-gray-500">{new Date(m.createdAt).toLocaleDateString("pt-BR")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
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
