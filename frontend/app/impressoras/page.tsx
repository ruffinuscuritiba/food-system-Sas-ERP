"use client";

import React, { useEffect, useState, useCallback } from "react";
import api from "@/services/api";
import toast from "react-hot-toast";
import {
  Printer, Plus, Trash2, RefreshCw, Wifi, WifiOff,
  CheckCircle, Clock, XCircle, AlertCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ConnectionType = "BROWSER" | "NETWORK" | "USB";
type PaperWidth     = "MM_58" | "MM_80";
type PrinterRole    = "KITCHEN" | "BAR" | "COUNTER" | "DELIVERY";
type JobStatus      = "PENDING" | "SENT" | "PRINTED" | "FAILED";

interface PrinterRecord {
  id:             string;
  name:           string;
  brand?:         string;
  connectionType: ConnectionType;
  address?:       string;
  paperWidth:     PaperWidth;
  isOnline:       boolean;
  isActive:       boolean;
  lastSeenAt?:    string;
  profiles:       ProfileRecord[];
  _count:         { jobs: number };
}

interface ProfileRecord {
  id:        string;
  printerId: string;
  role:      PrinterRole;
  isActive:  boolean;
  printer?:  { name: string; connectionType: ConnectionType; isOnline: boolean };
}

interface JobRecord {
  id:         string;
  printerId:  string;
  orderId?:   string;
  template:   string;
  status:     JobStatus;
  attempts:   number;
  printedAt?: string;
  failReason?: string;
  createdAt:  string;
  printer?:   { name: string };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CONNECTION_LABELS: Record<ConnectionType, string> = {
  BROWSER: "Navegador (window.print)",
  NETWORK: "Rede (IP:Porta)",
  USB:     "USB",
};

const ROLE_LABELS: Record<PrinterRole, string> = {
  KITCHEN:  "Cozinha",
  BAR:      "Bar / Bebidas",
  COUNTER:  "Caixa / Balcão",
  DELIVERY: "Etiqueta Delivery",
};

const STATUS_ICON: Record<JobStatus, React.ReactElement> = {
  PENDING: <Clock    size={14} className="text-yellow-500" />,
  SENT:    <RefreshCw size={14} className="text-blue-500 animate-spin" />,
  PRINTED: <CheckCircle size={14} className="text-green-500" />,
  FAILED:  <XCircle  size={14} className="text-red-500" />,
};

const TABS = ["Impressoras", "Perfis", "Fila", "Histórico"] as const;
type Tab = typeof TABS[number];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImpressorasPage() {
  const [tab, setTab]         = useState<Tab>("Impressoras");
  const [printers, setPrinters] = useState<PrinterRecord[]>([]);
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [jobs, setJobs]         = useState<JobRecord[]>([]);
  const [loading, setLoading]   = useState(false);

  // new printer form
  const [form, setForm] = useState({
    name: "", brand: "", connectionType: "BROWSER" as ConnectionType,
    address: "", paperWidth: "MM_80" as PaperWidth,
  });
  const [showForm, setShowForm] = useState(false);

  // new profile form
  const [profileForm, setProfileForm] = useState({ printerId: "", role: "KITCHEN" as PrinterRole });
  const [showProfileForm, setShowProfileForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, pr, j] = await Promise.all([
        api.get("/printers"),
        api.get("/printers/profiles"),
        api.get("/printers/jobs"),
      ]);
      setPrinters(p.data);
      setProfiles(pr.data);
      setJobs(j.data);
    } catch { toast.error("Erro ao carregar dados"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── PRINTER CRUD ────────────────────────────────────────────────────────────

  async function createPrinter() {
    if (!form.name.trim()) return toast.error("Informe o nome da impressora");
    try {
      await api.post("/printers", {
        name:           form.name.trim(),
        brand:          form.brand.trim() || undefined,
        connectionType: form.connectionType,
        address:        form.address.trim() || undefined,
        paperWidth:     form.paperWidth,
      });
      toast.success("Impressora adicionada");
      setShowForm(false);
      setForm({ name: "", brand: "", connectionType: "BROWSER", address: "", paperWidth: "MM_80" });
      load();
    } catch { toast.error("Erro ao adicionar impressora"); }
  }

  async function deletePrinter(id: string) {
    if (!confirm("Remover esta impressora?")) return;
    try {
      await api.delete(`/printers/${id}`);
      toast.success("Impressora removida");
      load();
    } catch { toast.error("Erro ao remover"); }
  }

  async function toggleActive(printer: PrinterRecord) {
    try {
      await api.patch(`/printers/${printer.id}`, { isActive: !printer.isActive });
      load();
    } catch { toast.error("Erro ao atualizar"); }
  }

  // ── PROFILE CRUD ────────────────────────────────────────────────────────────

  async function createProfile() {
    if (!profileForm.printerId) return toast.error("Selecione uma impressora");
    try {
      await api.post("/printers/profiles", profileForm);
      toast.success("Perfil criado");
      setShowProfileForm(false);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Erro ao criar perfil");
    }
  }

  async function deleteProfile(id: string) {
    try {
      await api.delete(`/printers/profiles/${id}`);
      load();
    } catch { toast.error("Erro ao remover perfil"); }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  const pendingJobs    = jobs.filter(j => j.status === "PENDING" || j.status === "SENT");
  const completedJobs  = jobs.filter(j => j.status === "PRINTED" || j.status === "FAILED");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Printer size={24} className="text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Impressoras</h1>
            <p className="text-sm text-gray-500">Gerencie impressoras, perfis por setor e fila de impressão</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t}
            {t === "Fila" && pendingJobs.length > 0 && (
              <span className="ml-1.5 bg-yellow-100 text-yellow-700 text-xs px-1.5 py-0.5 rounded-full">
                {pendingJobs.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: Impressoras ─────────────────────────────────────────────── */}
      {tab === "Impressoras" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
            >
              <Plus size={16} /> Nova Impressora
            </button>
          </div>

          {showForm && (
            <div className="border rounded-xl p-4 bg-gray-50 space-y-3">
              <h3 className="font-semibold text-sm">Nova Impressora</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Nome *</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="Ex: Epson TM-T20"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Marca</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="Epson, Bematech, Elgin..."
                    value={form.brand}
                    onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Tipo de conexão</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.connectionType}
                    onChange={e => setForm(f => ({ ...f, connectionType: e.target.value as ConnectionType }))}
                  >
                    {(Object.keys(CONNECTION_LABELS) as ConnectionType[]).map(k => (
                      <option key={k} value={k}>{CONNECTION_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Papel</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.paperWidth}
                    onChange={e => setForm(f => ({ ...f, paperWidth: e.target.value as PaperWidth }))}
                  >
                    <option value="MM_80">80mm</option>
                    <option value="MM_58">58mm</option>
                  </select>
                </div>
                {form.connectionType === "NETWORK" && (
                  <div className="sm:col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">Endereço IP:Porta</label>
                    <input
                      className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                      placeholder="192.168.1.100:9100"
                      value={form.address}
                      onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    />
                  </div>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded-lg">Cancelar</button>
                <button onClick={createPrinter} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Adicionar
                </button>
              </div>
            </div>
          )}

          {printers.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Printer size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhuma impressora cadastrada</p>
              <p className="text-xs mt-1">Clique em "Nova Impressora" para começar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {printers.map(p => (
                <div key={p.id} className="border rounded-xl p-4 bg-white flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg ${p.isOnline ? "bg-green-50" : "bg-gray-100"}`}>
                      {p.isOnline
                        ? <Wifi size={18} className="text-green-600" />
                        : <WifiOff size={18} className="text-gray-400" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{p.name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {CONNECTION_LABELS[p.connectionType]}
                        {p.address && ` · ${p.address}`}
                        {p.brand && ` · ${p.brand}`}
                        {" · "}{p.paperWidth === "MM_80" ? "80mm" : "58mm"}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {p.profiles.length} perfil(s) · {p._count.jobs} job(s)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => toggleActive(p)}
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        p.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {p.isActive ? "Ativa" : "Inativa"}
                    </button>
                    <button onClick={() => deletePrinter(p.id)} className="text-red-400 hover:text-red-600 p-1">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Perfis ──────────────────────────────────────────────────── */}
      {tab === "Perfis" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
            <AlertCircle size={14} className="inline mr-1.5" />
            Perfis definem qual impressora recebe cada tipo de ticket.
            Uma impressora pode ter múltiplos perfis (ex: Cozinha + Caixa).
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setShowProfileForm(v => !v)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
            >
              <Plus size={16} /> Novo Perfil
            </button>
          </div>

          {showProfileForm && (
            <div className="border rounded-xl p-4 bg-gray-50 space-y-3">
              <h3 className="font-semibold text-sm">Novo Perfil</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Impressora *</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={profileForm.printerId}
                    onChange={e => setProfileForm(f => ({ ...f, printerId: e.target.value }))}
                  >
                    <option value="">— selecione —</option>
                    {printers.filter(p => p.isActive).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Setor *</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={profileForm.role}
                    onChange={e => setProfileForm(f => ({ ...f, role: e.target.value as PrinterRole }))}
                  >
                    {(Object.keys(ROLE_LABELS) as PrinterRole[]).map(k => (
                      <option key={k} value={k}>{ROLE_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowProfileForm(false)} className="px-4 py-2 text-sm border rounded-lg">Cancelar</button>
                <button onClick={createProfile} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Criar Perfil
                </button>
              </div>
            </div>
          )}

          {profiles.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">Nenhum perfil configurado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {profiles.map(pr => (
                <div key={pr.id} className="border rounded-xl p-3 bg-white flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mr-2">
                      {ROLE_LABELS[pr.role]}
                    </span>
                    <span className="text-sm text-gray-700">{pr.printer?.name ?? pr.printerId}</span>
                    {!pr.isActive && <span className="ml-2 text-xs text-gray-400">(inativo)</span>}
                  </div>
                  <button onClick={() => deleteProfile(pr.id)} className="text-red-400 hover:text-red-600 p-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Fila ────────────────────────────────────────────────────── */}
      {tab === "Fila" && (
        <div className="space-y-3">
          {pendingJobs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <CheckCircle size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">Fila vazia</p>
            </div>
          ) : (
            pendingJobs.map(j => (
              <JobRow key={j.id} job={j} />
            ))
          )}
        </div>
      )}

      {/* ── TAB: Histórico ───────────────────────────────────────────────── */}
      {tab === "Histórico" && (
        <div className="space-y-3">
          {completedJobs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">Sem histórico ainda</p>
            </div>
          ) : (
            completedJobs.map(j => (
              <JobRow key={j.id} job={j} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function JobRow({ job }: { job: JobRecord }) {
  const ts = new Date(job.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  return (
    <div className="border rounded-xl p-3 bg-white flex items-start gap-3">
      <div className="mt-0.5">{STATUS_ICON[job.status]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          {job.template}
          <span className="text-gray-400 font-normal ml-2 text-xs">{job.printer?.name}</span>
        </p>
        {job.orderId && <p className="text-xs text-gray-500">Pedido #{job.orderId.slice(-6).toUpperCase()}</p>}
        {job.failReason && <p className="text-xs text-red-500 mt-0.5">{job.failReason}</p>}
        <p className="text-xs text-gray-400 mt-0.5">{ts} · {job.attempts} tentativa(s)</p>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
        job.status === "PRINTED" ? "bg-green-100 text-green-700" :
        job.status === "FAILED"  ? "bg-red-100 text-red-600" :
        job.status === "SENT"    ? "bg-blue-100 text-blue-700" :
        "bg-yellow-100 text-yellow-700"
      }`}>
        {job.status}
      </span>
    </div>
  );
}
