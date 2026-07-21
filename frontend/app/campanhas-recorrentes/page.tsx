"use client";

import { useEffect, useState } from "react";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import {
  Repeat, Users, Zap, CheckCircle2, Plus, Pause, Play, X, Info, Loader2,
} from "lucide-react";
import { useNavKeyGuard } from "@/hooks/useNavKeyGuard";

interface CampaignStats {
  sent: number;
  failed: number;
  skipped: number;
  total: number;
}

interface Campaign {
  id: string;
  name: string;
  message: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED";
  minIntervalDays: number;
  createdAt: string;
  stats: CampaignStats;
}

interface Summary {
  eligibleContacts: number;
  activeCampaigns: number;
  deliveryRate: number | null;
}

const STATUS_LABELS: Record<Campaign["status"], { label: string; className: string }> = {
  DRAFT:     { label: "Rascunho",  className: "bg-gray-100 text-gray-600" },
  ACTIVE:    { label: "Ativa",     className: "bg-emerald-100 text-emerald-700" },
  PAUSED:    { label: "Pausada",   className: "bg-amber-100 text-amber-700" },
  COMPLETED: { label: "Concluída", className: "bg-blue-100 text-blue-700" },
};

export default function CampanhasRecorrentesPage() {
  useNavKeyGuard("campanhas-recorrentes");

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary>({ eligibleContacts: 0, activeCampaigns: 0, deliveryRate: null });
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", message: "", minIntervalDays: 15 });

  async function load() {
    setLoading(true);
    try {
      const [summaryRes, listRes] = await Promise.all([
        api.get("/whatsapp-campaigns/summary"),
        api.get("/whatsapp-campaigns"),
      ]);
      setSummary(summaryRes.data);
      setCampaigns(Array.isArray(listRes.data) ? listRes.data : []);
    } catch {
      toast.error("Erro ao carregar campanhas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createCampaign() {
    if (!form.name.trim() || !form.message.trim()) {
      toast.error("Preencha nome e mensagem");
      return;
    }
    setSaving(true);
    try {
      await api.post("/whatsapp-campaigns", form);
      toast.success("Campanha criada como rascunho!");
      setShowModal(false);
      setForm({ name: "", message: "", minIntervalDays: 15 });
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Erro ao criar campanha");
    } finally {
      setSaving(false);
    }
  }

  async function activate(id: string) {
    setBusyId(id);
    try {
      await api.patch(`/whatsapp-campaigns/${id}/activate`);
      toast.success("Campanha ativada — envio iniciado em segundo plano.");
      load();
    } catch {
      toast.error("Erro ao ativar campanha");
    } finally {
      setBusyId(null);
    }
  }

  async function pause(id: string) {
    setBusyId(id);
    try {
      await api.patch(`/whatsapp-campaigns/${id}/pause`);
      toast.success("Campanha pausada.");
      load();
    } catch {
      toast.error("Erro ao pausar campanha");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
          <div className="flex items-center gap-3">
            <Repeat size={28} className="text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Reengajamento WhatsApp</h1>
              <p className="text-gray-500 text-sm mt-0.5">Campanhas recorrentes só pra quem deu opt-in — respeita intervalo mínimo entre envios</p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition"
          >
            <Plus size={16} /> Nova Campanha
          </button>
        </div>

        {/* Aviso de opt-in */}
        <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-8 text-sm text-blue-800">
          <Info size={16} className="mt-0.5 shrink-0" />
          <p>
            Só clientes com consentimento de marketing (<code className="font-mono text-xs bg-blue-100 px-1 py-0.5 rounded">marketingOptIn</code>) recebem essas campanhas.
            Nenhum cliente é contatado sem ter dado esse aceite antes.
          </p>
        </div>

        {/* KPI cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 text-xs font-bold uppercase tracking-wide mb-2">
              <Users size={14} /> Contatos aptos agora
            </div>
            <p className="text-3xl font-black text-gray-900">{loading ? "—" : summary.eligibleContacts}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 text-xs font-bold uppercase tracking-wide mb-2">
              <Zap size={14} /> Campanhas ativas
            </div>
            <p className="text-3xl font-black text-gray-900">{loading ? "—" : summary.activeCampaigns}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 text-xs font-bold uppercase tracking-wide mb-2">
              <CheckCircle2 size={14} /> Taxa de entrega (30 dias)
            </div>
            <p className="text-3xl font-black text-gray-900">
              {loading ? "—" : summary.deliveryRate === null ? "—" : `${summary.deliveryRate}%`}
            </p>
          </div>
        </div>

        {/* Histórico de campanhas */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-bold text-gray-800">Histórico de campanhas</h2>
          </div>
          {campaigns.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-10">Nenhuma campanha criada ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 text-xs uppercase tracking-wide">
                    <th className="px-5 py-3">Nome</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Enviados</th>
                    <th className="px-5 py-3">Falhas</th>
                    <th className="px-5 py-3">Pulados</th>
                    <th className="px-5 py-3">Criada em</th>
                    <th className="px-5 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {campaigns.map((c) => (
                    <tr key={c.id}>
                      <td className="px-5 py-3 font-semibold text-gray-800">{c.name}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_LABELS[c.status].className}`}>
                          {STATUS_LABELS[c.status].label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-emerald-600 font-semibold">{c.stats.sent}</td>
                      <td className="px-5 py-3 text-red-500 font-semibold">{c.stats.failed}</td>
                      <td className="px-5 py-3 text-gray-400">{c.stats.skipped}</td>
                      <td className="px-5 py-3 text-gray-500">{new Date(c.createdAt).toLocaleDateString("pt-BR")}</td>
                      <td className="px-5 py-3">
                        {(c.status === "DRAFT" || c.status === "PAUSED") && (
                          <button
                            onClick={() => activate(c.id)}
                            disabled={busyId === c.id}
                            className="flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 font-semibold text-xs disabled:opacity-50"
                          >
                            {busyId === c.id ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                            {c.status === "DRAFT" ? "Ativar" : "Retomar"}
                          </button>
                        )}
                        {c.status === "ACTIVE" && (
                          <button
                            onClick={() => pause(c.id)}
                            disabled={busyId === c.id}
                            className="flex items-center gap-1.5 text-amber-600 hover:text-amber-700 font-semibold text-xs disabled:opacity-50"
                          >
                            {busyId === c.id ? <Loader2 size={13} className="animate-spin" /> : <Pause size={13} />}
                            Pausar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal — Nova Campanha */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Nova Campanha</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nome da campanha</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Reengajamento Julho"
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Mensagem</label>
                <p className="text-xs text-gray-400 mb-1.5">
                  Use <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">{"{{nome}}"}</code> pra personalizar com o nome do cliente.
                </p>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Oi {{nome}}! Sentimos sua falta — que tal pedir sua pizza favorita hoje?"
                  rows={4}
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Intervalo mínimo entre envios (dias)</label>
                <input
                  type="number"
                  min={1}
                  value={form.minIntervalDays}
                  onChange={(e) => setForm({ ...form, minIntervalDays: Number(e.target.value) || 15 })}
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                />
                <p className="text-xs text-gray-400 mt-1">Nenhum cliente recebe 2 campanhas (dessa ou de outra) dentro desse período.</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={createCampaign}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                Criar como rascunho
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
