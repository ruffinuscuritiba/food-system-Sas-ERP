"use client";

import { useEffect, useState } from "react";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import {
  Repeat, Users, Zap, CheckCircle2, Plus, Pause, Play, X, Info, Loader2,
  UserPlus, Archive, Gauge, Image as ImageIcon,
} from "lucide-react";
import { ImageUploaderPreview } from "@/components/ui/ImageUploaderPreview";
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
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
  minIntervalDays: number;
  maxPerRun: number;
  imageUrl: string | null;
  createdAt: string;
  stats: CampaignStats;
}

interface Summary {
  eligibleContacts: number;
  activeCampaigns: number;
  deliveryRate: number | null;
}

const MAX_PER_RUN_MIN = 10;
const MAX_PER_RUN_MAX = 500;

const STATUS_LABELS: Record<Campaign["status"], { label: string; className: string }> = {
  DRAFT:     { label: "Rascunho",   className: "bg-gray-100 text-gray-600" },
  ACTIVE:    { label: "Ativa",      className: "bg-emerald-100 text-emerald-700" },
  PAUSED:    { label: "Pausada",    className: "bg-amber-100 text-amber-700" },
  COMPLETED: { label: "Concluída",  className: "bg-blue-100 text-blue-700" },
  ARCHIVED:  { label: "Desativada", className: "bg-gray-200 text-gray-500" },
};

export default function CampanhasRecorrentesPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary>({ eligibleContacts: 0, activeCampaigns: 0, deliveryRate: null });
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingContacts, setSavingContacts] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", message: "", minIntervalDays: 15, maxPerRun: 50, imageUrl: null as string | null });
  const [contactsText, setContactsText] = useState("");

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
      setForm({ name: "", message: "", minIntervalDays: 15, maxPerRun: 50, imageUrl: null as string | null });
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
      toast.success("Lote de envio disparado em segundo plano.");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Erro ao ativar campanha");
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

  async function archive(id: string) {
    setBusyId(id);
    try {
      await api.patch(`/whatsapp-campaigns/${id}/archive`);
      toast.success("Campanha desativada definitivamente.");
      setConfirmArchiveId(null);
      load();
    } catch {
      toast.error("Erro ao desativar campanha");
    } finally {
      setBusyId(null);
    }
  }

  function parseContactsText(raw: string): { name?: string; phone: string }[] {
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(",").map((p) => p.trim());
        if (parts.length >= 2) return { name: parts[0], phone: parts[1] };
        return { phone: parts[0] };
      });
  }

  async function saveContacts() {
    const contacts = parseContactsText(contactsText);
    if (contacts.length === 0) {
      toast.error("Cole ao menos um contato");
      return;
    }
    setSavingContacts(true);
    try {
      const { data } = await api.post("/whatsapp-campaigns/contacts", { contacts });
      toast.success(
        `${data.created} novo(s) + ${data.updated} atualizado(s) marcado(s) com opt-in.` +
          (data.invalid > 0 ? ` ${data.invalid} inválido(s) ignorado(s).` : ""),
      );
      setContactsText("");
      setShowContactsModal(false);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Erro ao adicionar contatos");
    } finally {
      setSavingContacts(false);
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
          <div className="flex gap-2">
            <button
              onClick={() => setShowContactsModal(true)}
              className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition"
            >
              <UserPlus size={16} /> Adicionar Contatos
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition"
            >
              <Plus size={16} /> Nova Campanha
            </button>
          </div>
        </div>

        {/* Aviso de opt-in */}
        <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-8 text-sm text-blue-800">
          <Info size={16} className="mt-0.5 shrink-0" />
          <p>
            Só clientes com consentimento de marketing (<code className="font-mono text-xs bg-blue-100 px-1 py-0.5 rounded">marketingOptIn</code>) recebem essas campanhas.
            Use "Adicionar Contatos" pra marcar o opt-in manualmente (ex: lista de convite de inauguração) — você está confirmando que pode mandar pra esses números.
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
                    <th className="px-5 py-3">Lote</th>
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
                      <td className="px-5 py-3 font-semibold text-gray-800">
                        <span className="flex items-center gap-1.5">
                          {c.name}
                          {c.imageUrl && (
                            <span title="Campanha com imagem">
                              <ImageIcon size={13} className="text-gray-400" />
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_LABELS[c.status].className}`}>
                          {STATUS_LABELS[c.status].label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        <span className="inline-flex items-center gap-1"><Gauge size={12} />{c.maxPerRun}/vez</span>
                      </td>
                      <td className="px-5 py-3 text-emerald-600 font-semibold">{c.stats.sent}</td>
                      <td className="px-5 py-3 text-red-500 font-semibold">{c.stats.failed}</td>
                      <td className="px-5 py-3 text-gray-400">{c.stats.skipped}</td>
                      <td className="px-5 py-3 text-gray-500">{new Date(c.createdAt).toLocaleDateString("pt-BR")}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
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
                          {(c.status === "DRAFT" || c.status === "PAUSED" || c.status === "ACTIVE") && (
                            confirmArchiveId === c.id ? (
                              <span className="flex items-center gap-1.5 text-xs">
                                <span className="text-gray-500">Definitivo?</span>
                                <button
                                  onClick={() => archive(c.id)}
                                  disabled={busyId === c.id}
                                  className="font-semibold text-red-600 hover:text-red-700"
                                >
                                  Sim
                                </button>
                                <button
                                  onClick={() => setConfirmArchiveId(null)}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  Não
                                </button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setConfirmArchiveId(c.id)}
                                className="flex items-center gap-1.5 text-gray-400 hover:text-red-600 font-semibold text-xs"
                                title="Desativar definitivamente"
                              >
                                <Archive size={13} />
                              </button>
                            )
                          )}
                        </div>
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
                  placeholder="Ex: Inauguração"
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
                  placeholder="Oi {{nome}}! Hoje é a inauguração da nossa pizzaria — vem conferir!"
                  rows={4}
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Imagem (opcional)</label>
                <p className="text-xs text-gray-400 mb-1.5">Anexa uma foto à mensagem — sem imagem, envia só o texto.</p>
                <ImageUploaderPreview
                  value={form.imageUrl ?? undefined}
                  onChange={(url) => setForm({ ...form, imageUrl: url })}
                  previewHeightClassName="h-32"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Intervalo mínimo (dias)</label>
                  <input
                    type="number"
                    min={1}
                    value={form.minIntervalDays}
                    onChange={(e) => setForm({ ...form, minIntervalDays: Number(e.target.value) || 15 })}
                    className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Disparos por vez</label>
                  <input
                    type="number"
                    min={MAX_PER_RUN_MIN}
                    max={MAX_PER_RUN_MAX}
                    value={form.maxPerRun}
                    onChange={(e) => {
                      const v = Number(e.target.value) || MAX_PER_RUN_MIN;
                      setForm({ ...form, maxPerRun: Math.min(MAX_PER_RUN_MAX, Math.max(MAX_PER_RUN_MIN, v)) });
                    }}
                    className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400 -mt-2">
                Nenhum cliente recebe 2 campanhas dentro do intervalo mínimo. "Disparos por vez" limita quantos saem a cada clique em Ativar/Retomar
                (mín. {MAX_PER_RUN_MIN}, máx. {MAX_PER_RUN_MAX}) — se sobrar gente elegível, a campanha volta pra "Pausada" e o próximo lote sai no próximo "Retomar".
              </p>
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

      {/* Modal — Adicionar Contatos */}
      {showContactsModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Adicionar Contatos</h2>
              <button onClick={() => setShowContactsModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-3">
              Cole um contato por linha, no formato <code className="font-mono bg-gray-100 px-1 py-0.5 rounded text-xs">Nome, Telefone</code> (nome é opcional — só o telefone também funciona).
              Ao adicionar, esses números ficam marcados com opt-in e passam a ser elegíveis pras campanhas.
            </p>
            <textarea
              value={contactsText}
              onChange={(e) => setContactsText(e.target.value)}
              placeholder={"João Silva, 67999998888\nMaria Souza, 67988887777\n67977776666"}
              rows={8}
              className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary resize-none font-mono"
            />
            <p className="text-xs text-gray-400 mt-1.5">
              {parseContactsText(contactsText).length} contato(s) detectado(s) nesta lista.
            </p>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowContactsModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={saveContacts}
                disabled={savingContacts}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {savingContacts ? <Loader2 size={15} className="animate-spin" /> : null}
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
