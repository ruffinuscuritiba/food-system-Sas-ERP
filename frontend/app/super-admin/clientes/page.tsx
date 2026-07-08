"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { saApi } from "@/services/superAdminApi";
import {
  Users, Download, Search, RefreshCw, ChevronLeft, ChevronRight,
  Phone, Mail, Store, TrendingUp, UserCheck, Clock, Ghost,
  UserMinus, Filter, FileText, Lock, Unlock, ChevronDown, ChevronUp,
} from "lucide-react";
import { SuperAdminTopBar, saBtn } from "@/components/super-admin/SuperAdminTopBar";
import toast from "react-hot-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

type ContactType = "ALL" | "ACTIVE" | "TRIAL" | "DEMO" | "EX_CLIENT" | "LEAD";

interface CustomerRow {
  id: string;
  contactName: string;
  restaurantName: string;
  email: string;
  whatsapp: string;
  type: ContactType;
  status: string;
  plan: string;
  createdAt: string;
  dueDate: string | null;
  isArchived: boolean;
}

interface Summary {
  total: number;
  active: number;
  trial: number;
  demo: number;
  exClient: number;
  leads: number;
}

interface CashStatusRow {
  companyId: string;
  companyName: string;
  isOpen: boolean;
  openingValue: number | null;
  balance: number | null;
  since: string | null;
  lastClosedAt: string | null;
  hasEverOpened: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<ContactType | string, string> = {
  ALL:       "Todos",
  ACTIVE:    "Clientes Ativos",
  TRIAL:     "Em Trial",
  DEMO:      "Demonstração",
  EX_CLIENT: "Ex-clientes",
  LEAD:      "Leads",
};

const TYPE_COLORS: Record<string, string> = {
  ACTIVE:    "bg-green-100 text-green-700 border border-green-200",
  TRIAL:     "bg-blue-100 text-blue-700 border border-blue-200",
  DEMO:      "bg-violet-100 text-violet-700 border border-violet-200",
  EX_CLIENT: "bg-orange-100 text-orange-700 border border-orange-200",
  LEAD:      "bg-gray-100 text-gray-600 border border-gray-200",
};

const KPI_CONFIG = [
  { key: "total",    label: "Total",          icon: Users,      color: "text-slate-600", bg: "bg-slate-50" },
  { key: "active",   label: "Clientes Ativos", icon: UserCheck,  color: "text-green-600", bg: "bg-green-50" },
  { key: "trial",    label: "Em Trial",        icon: Clock,      color: "text-blue-600",  bg: "bg-blue-50" },
  { key: "demo",     label: "Demonstração",    icon: Ghost,      color: "text-violet-600",bg: "bg-violet-50" },
  { key: "exClient", label: "Ex-clientes",     icon: UserMinus,  color: "text-orange-600",bg: "bg-orange-50" },
  { key: "leads",    label: "Leads",           icon: TrendingUp, color: "text-pink-600",  bg: "bg-pink-50" },
];

// Maps KPI summary key (camelCase) to ContactType enum value (SCREAMING_SNAKE_CASE)
const KPI_TO_TYPE: Record<string, ContactType> = {
  total:    "ALL",
  active:   "ACTIVE",
  trial:    "TRIAL",
  demo:     "DEMO",
  exClient: "EX_CLIENT",
  leads:    "LEAD",
};

const BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

// ── Component ─────────────────────────────────────────────────────────────────

export default function ClientesPage() {
  const router = useRouter();
  const [rows,       setRows]       = useState<CustomerRow[]>([]);
  const [summary,    setSummary]    = useState<Summary | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [typeFilter, setTypeFilter] = useState<ContactType>("ALL");
  const [page,       setPage]       = useState(1);
  const [total,      setTotal]      = useState(0);
  const [cashRows,   setCashRows]   = useState<CashStatusRow[]>([]);
  const [cashSummary, setCashSummary] = useState<{ total: number; open: number; neverOpened: number } | null>(null);
  const [cashLoading, setCashLoading] = useState(true);
  const [showCash,   setShowCash]   = useState(true);
  const LIMIT = 50;

  const loadCashStatus = useCallback(async () => {
    setCashLoading(true);
    try {
      const res = await saApi.get("/super-admin/cash-status");
      setCashRows(res.data.items ?? []);
      setCashSummary(res.data.summary ?? null);
    } catch {
      // silencioso — widget de conveniência, não bloqueia a página principal
    } finally {
      setCashLoading(false);
    }
  }, []);

  useEffect(() => { loadCashStatus(); }, [loadCashStatus]);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await saApi.get("/super-admin/customers-report", {
        params: { page: p, limit: LIMIT, type: typeFilter, search },
      });
      setRows(res.data.items ?? []);
      setTotal(res.data.total ?? 0);
      setSummary(res.data.summary ?? null);
      setPage(p);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Erro ao carregar relatório";
      toast.error(`Erro: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, search]);

  useEffect(() => { load(1); }, [load]);

  function downloadCsv() {
    const token = localStorage.getItem("sa_token");
    const url   = `${BASE}/super-admin/customers-report/csv`;
    // Open with auth header via fetch + blob
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "foodsaas-clientes.csv";
        a.click();
      })
      .catch(() => toast.error("Erro ao exportar CSV"));
  }

  function downloadTxt() {
    const token = localStorage.getItem("sa_token");
    const url   = `${BASE}/super-admin/customers-report/txt`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "foodsaas-whatsapps.txt";
        a.click();
      })
      .catch(() => toast.error("Erro ao exportar TXT"));
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="min-h-screen bg-gray-50">
      <SuperAdminTopBar actions={
        <>
          <button onClick={() => load(1)} className={`flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-300 ${saBtn}`}>
            <RefreshCw className="h-3.5 w-3.5" />Atualizar
          </button>
          <button onClick={downloadTxt} className={`flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-300 ${saBtn}`}>
            <FileText className="h-3.5 w-3.5" />Exportar TXT
          </button>
          <button onClick={downloadCsv} className={`flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm ${saBtn}`}>
            <Download className="h-3.5 w-3.5" />Exportar CSV
          </button>
        </>
      } />

      <div className="p-6">
      {/* ── Header ── */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-indigo-600" />
            Central de Leads &amp; Clientes
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Todos que interagiram com o FoodSaaS — leads, demos, trials e clientes.
          </p>
        </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {KPI_CONFIG.map(({ key, label, icon: Icon, color, bg }) => (
          <button
            key={key}
            onClick={() => { setTypeFilter(KPI_TO_TYPE[key] ?? "ALL"); setPage(1); }}
            className={`rounded-2xl border border-gray-100 p-4 text-left transition hover:shadow-sm ${bg} ${typeFilter === KPI_TO_TYPE[key] ? "ring-2 ring-indigo-400" : ""}`}
          >
            <Icon className={`h-5 w-5 mb-2 ${color}`} />
            <div className={`text-2xl font-black ${color}`}>
              {summary ? (summary as any)[key] ?? 0 : "—"}
            </div>
            <div className="text-xs text-gray-500 font-semibold mt-0.5">{label}</div>
          </button>
        ))}
      </div>

      {/* ── Status de Caixa por tenant ── */}
      <div className="mb-6 rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <button
          onClick={() => setShowCash((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-gray-400" />
            <span className="font-bold text-gray-800 text-sm">Status de Caixa por Loja</span>
            {cashSummary && (
              <span className="text-xs text-gray-400">
                {cashSummary.open} aberto{cashSummary.open === 1 ? "" : "s"} de {cashSummary.total}
                {cashSummary.neverOpened > 0 && ` · ${cashSummary.neverOpened} nunca abriu`}
              </span>
            )}
          </div>
          {showCash ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </button>
        {showCash && (
          <div className="border-t border-gray-100 max-h-80 overflow-y-auto">
            {cashLoading ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">
                <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />Carregando…
              </div>
            ) : cashRows.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">Nenhuma loja encontrada.</div>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {cashRows.map((r) => (
                    <tr key={r.companyId} className="hover:bg-gray-50/60">
                      <td className="px-5 py-2.5 font-medium text-gray-700">{r.companyName}</td>
                      <td className="px-5 py-2.5">
                        {!r.hasEverOpened ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-500 px-2.5 py-0.5 text-[11px] font-bold">
                            Nunca abriu caixa
                          </span>
                        ) : r.isOpen ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 px-2.5 py-0.5 text-[11px] font-bold">
                            <Unlock className="h-3 w-3" />Aberto
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-600 px-2.5 py-0.5 text-[11px] font-bold">
                            <Lock className="h-3 w-3" />Fechado
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-xs text-gray-400">
                        {r.isOpen && r.since
                          ? `desde ${new Date(r.since).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
                          : !r.isOpen && r.lastClosedAt
                          ? `fechado em ${new Date(r.lastClosedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
                          : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── Filters + Search ── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Type filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(TYPE_LABELS) as ContactType[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTypeFilter(t); setPage(1); }}
              className={`rounded-full px-3 py-1 text-xs font-bold transition border ${
                typeFilter === t
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              <Filter className="h-3 w-3 inline mr-1" />
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail ou WhatsApp…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(1)}
            className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-indigo-400 w-72"
          />
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide">Contato</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide">Restaurante</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide hidden md:table-cell">E-mail</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide">WhatsApp</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide">Tipo</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide hidden lg:table-cell">Plano</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide hidden lg:table-cell">Cadastro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Carregando…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  Nenhum resultado encontrado.
                </td>
              </tr>
            ) : rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50/60 transition">
                <td className="px-4 py-3 font-semibold text-gray-800">
                  {row.contactName || <span className="text-gray-400 italic">—</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Store className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span className="text-gray-700">{row.restaurantName || "—"}</span>
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {row.email ? (
                    <a href={`mailto:${row.email}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                      <Mail className="h-3 w-3" />{row.email}
                    </a>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  {row.whatsapp ? (
                    <a
                      href={`https://wa.me/${row.whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-green-600 hover:underline font-medium"
                    >
                      <Phone className="h-3 w-3" />{row.whatsapp}
                    </a>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${TYPE_COLORS[row.type] ?? "bg-gray-100 text-gray-600"}`}>
                    {TYPE_LABELS[row.type] ?? row.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">{row.status}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs uppercase font-semibold">{row.plan || "—"}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-gray-400 text-xs">
                  {row.createdAt ? new Date(row.createdAt).toLocaleDateString("pt-BR") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <span>{total} registros · página {page} de {totalPages}</span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => load(page - 1)}
              className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 font-semibold disabled:opacity-40 hover:bg-gray-50"
            >
              <ChevronLeft className="h-4 w-4" />Anterior
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => load(page + 1)}
              className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 font-semibold disabled:opacity-40 hover:bg-gray-50"
            >
              Próxima<ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Footer tip ── */}
      <div className="mt-8 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-700">
        <strong>💡 Dica de marketing:</strong> Filtre por "Ex-clientes" → clique em "Exportar TXT" →
        copie a lista de WhatsApps e carregue direto no seu software de disparo em massa para reengajamento.
      </div>
      </div>{/* /p-6 */}
    </div>
  );
}
