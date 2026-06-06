"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saApi } from "@/services/superAdminApi";

interface Lead {
  id: string;
  createdAt: string;
  updatedAt: string;
  sessionToken: string;
  name: string | null;
  company: string | null;
  whatsapp: string | null;
  recommendedPlan: string | null;
  source: string;
  conversationSummary: string | null;
  status: string;
}

const STATUS_COLORS: Record<string, string> = {
  NOVO: "bg-blue-900 text-blue-300",
  CONTATADO: "bg-yellow-900 text-yellow-300",
  QUALIFICADO: "bg-green-900 text-green-300",
  PERDIDO: "bg-red-900 text-red-300",
};

const PLAN_COLORS: Record<string, string> = {
  BASIC: "bg-gray-700 text-gray-300",
  PRO: "bg-violet-900 text-violet-300",
  ENTERPRISE: "bg-amber-900 text-amber-300",
};

function waLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const num = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${num}`;
}

export default function SuperAdminLeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("sa_token");
    if (!token) {
      router.replace("/super-admin/login");
      return;
    }
    saApi
      .get<Lead[]>("/super-admin/leads")
      .then((r) => setLeads(r.data))
      .catch(() => router.replace("/super-admin/login"))
      .finally(() => setLoading(false));
  }, [router]);

  const filtered = leads.filter((l) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      l.name?.toLowerCase().includes(q) ||
      l.company?.toLowerCase().includes(q) ||
      l.whatsapp?.includes(q) ||
      l.recommendedPlan?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-xl font-black">Leads — Kely IA</h1>
          <p className="text-sm text-white/40 mt-0.5">
            {leads.length} lead{leads.length !== 1 ? "s" : ""} capturado
            {leads.length !== 1 ? "s" : ""}
          </p>
        </div>
        <a
          href="/super-admin/dashboard"
          className="text-xs text-white/40 hover:text-white transition"
        >
          ← Dashboard
        </a>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nome, empresa, WhatsApp ou plano..."
        className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 mb-4"
      />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-white/30 text-sm">
          Carregando...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-white/30 text-sm">
          {search ? "Nenhum lead encontrado." : "Nenhum lead capturado ainda."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/[0.07]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.07] text-white/40 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Nome / Empresa</th>
                <th className="px-4 py-3 text-left">WhatsApp</th>
                <th className="px-4 py-3 text-left">Plano</th>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Resumo</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <>
                  <tr
                    key={lead.id}
                    className="border-b border-white/[0.04] hover:bg-white/[0.03] transition cursor-pointer"
                    onClick={() =>
                      setExpanded((p) => (p === lead.id ? null : lead.id))
                    }
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-white/90">
                        {lead.name ?? (
                          <span className="text-white/25 italic">—</span>
                        )}
                      </div>
                      {lead.company && (
                        <div className="text-xs text-white/40 mt-0.5">
                          {lead.company}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {lead.whatsapp ? (
                        <a
                          href={waLink(lead.whatsapp)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition"
                        >
                          {lead.whatsapp}
                        </a>
                      ) : (
                        <span className="text-white/25 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {lead.recommendedPlan ? (
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${PLAN_COLORS[lead.recommendedPlan] ?? "bg-gray-700 text-gray-300"}`}
                        >
                          {lead.recommendedPlan}
                        </span>
                      ) : (
                        <span className="text-white/25 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/50 text-xs whitespace-nowrap">
                      {new Date(lead.createdAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[lead.status] ?? "bg-gray-700 text-gray-300"}`}
                      >
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {lead.conversationSummary ? (
                        <span className="text-[11px] text-violet-400 underline underline-offset-2">
                          {expanded === lead.id ? "Fechar ▲" : "Ver ▼"}
                        </span>
                      ) : (
                        <span className="text-white/25 italic text-xs">—</span>
                      )}
                    </td>
                  </tr>
                  {expanded === lead.id && lead.conversationSummary && (
                    <tr
                      key={`${lead.id}-expanded`}
                      className="bg-white/[0.02]"
                    >
                      <td colSpan={6} className="px-4 py-3">
                        <pre className="text-[11px] text-white/50 whitespace-pre-wrap leading-relaxed font-mono max-h-48 overflow-y-auto">
                          {lead.conversationSummary}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
