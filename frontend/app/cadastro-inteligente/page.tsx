"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import {
  Sparkles, Upload, FileText, Image as ImageIcon, Loader2,
  CheckCircle2, XCircle, Trash2, ChevronDown,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type TabType = "menu" | "invoice";
type Phase = "idle" | "uploading" | "processing" | "review" | "done" | "error";

interface SessionLog { level: string; message: string; createdAt: string }

interface MenuItem {
  itemId: string;
  name: string;
  description?: string;
  price?: number;
  category?: string;
  suggestedCategoryId?: string;
  categoryId?: string;
  confidence?: number;
  enabled: boolean;
}

interface InvoiceItem {
  itemId: string;
  name: string;
  quantity: number;
  unit?: string;
  unitCost: number;
  total?: number;
  confidence?: number;
  createProduct: boolean;
  enabled: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ConfidenceBadge({ v }: { v?: number }) {
  if (v == null) return null;
  const pct = Math.round(v * 100);
  const color = pct >= 90 ? "bg-green-100 text-green-700" : pct >= 70 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";
  return <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${color}`}>{pct}%</span>;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CadastroInteligentePage() {
  const [tab, setTab] = useState<TabType>("menu");
  const [phase, setPhase] = useState<Phase>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [doneMsg, setDoneMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.get("/categories").then(r => setCategories(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  // cleanup poll on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  function reset() {
    if (pollRef.current) clearInterval(pollRef.current);
    setPhase("idle");
    setSessionId(null);
    setLogs([]);
    setMenuItems([]);
    setInvoiceItems([]);
    setDoneMsg("");
    setPreview(null);
    setFileName(null);
  }

  // ── Drag & drop ───────────────────────────────────────────────────────────

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [tab]); // eslint-disable-line

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  async function handleFile(file: File) {
    setFileName(file.name);

    // preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }

    setPhase("uploading");
    const fd = new FormData();
    fd.append("file", file);

    try {
      const endpoint = tab === "menu" ? "/smart-import/menu" : "/smart-import/invoice";
      const { data } = await api.post(endpoint, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setSessionId(data.sessionId);
      setPhase("processing");
      startPolling(data.sessionId);
    } catch {
      toast.error("Erro ao enviar arquivo");
      setPhase("error");
    }
  }

  // ── Polling ───────────────────────────────────────────────────────────────

  function startPolling(sid: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => pollSession(sid), 2000);
  }

  async function pollSession(sid: string) {
    try {
      const { data } = await api.get(`/smart-import/session/${sid}`);
      setLogs(data.logs ?? []);

      if (data.status === "DONE") {
        if (pollRef.current) clearInterval(pollRef.current);
        buildReviewState(data);
        setPhase("review");
      } else if (data.status === "ERROR") {
        if (pollRef.current) clearInterval(pollRef.current);
        toast.error(data.errorMsg || "Erro no processamento");
        setPhase("error");
      }
    } catch {
      // keep polling
    }
  }

  function buildReviewState(data: any) {
    const items: any[] = data.items ?? [];
    if (tab === "menu") {
      setMenuItems(items.map((it: any) => ({
        itemId: it.id,
        name: it.data?.name ?? "",
        description: it.data?.description ?? "",
        price: it.data?.price ?? undefined,
        category: it.data?.category ?? "",
        suggestedCategoryId: it.data?.suggestedCategoryId ?? undefined,
        categoryId: it.data?.suggestedCategoryId ?? "",
        confidence: it.confidence ?? undefined,
        enabled: true,
      })));
    } else {
      setInvoiceItems(items.map((it: any) => ({
        itemId: it.id,
        name: it.data?.name ?? "",
        quantity: it.data?.quantity ?? 1,
        unit: it.data?.unit ?? "UN",
        unitCost: it.data?.unitCost ?? 0,
        total: it.data?.total ?? undefined,
        confidence: it.confidence ?? undefined,
        createProduct: false,
        enabled: true,
      })));
    }
  }

  // ── Confirm ───────────────────────────────────────────────────────────────

  async function confirmMenu() {
    const enabled = menuItems.filter(i => i.enabled);
    if (!enabled.length) { toast.error("Nenhum item selecionado"); return; }
    try {
      const { data } = await api.post(`/smart-import/confirm/menu/${sessionId}`, {
        items: enabled.map(i => ({
          itemId: i.itemId,
          name: i.name,
          description: i.description || undefined,
          price: i.price ? Number(i.price) : undefined,
          categoryId: i.categoryId || undefined,
        })),
      });
      setDoneMsg(`${data.created} produto(s) cadastrado(s) com sucesso!`);
      setPhase("done");
    } catch {
      toast.error("Erro ao confirmar itens");
    }
  }

  async function confirmInvoice() {
    const enabled = invoiceItems.filter(i => i.enabled);
    if (!enabled.length) { toast.error("Nenhum item selecionado"); return; }
    try {
      const { data } = await api.post(`/smart-import/confirm/invoice/${sessionId}`, {
        items: enabled.map(i => ({
          itemId: i.itemId,
          name: i.name,
          quantity: Number(i.quantity),
          unitCost: Number(i.unitCost),
          unit: i.unit,
          createProduct: i.createProduct,
        })),
      });
      setDoneMsg(`${data.created} entrada(s) de estoque registrada(s)!`);
      setPhase("done");
    } catch {
      toast.error("Erro ao confirmar itens");
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gradient-to-br from-orange-400 to-orange-600 p-2.5 rounded-xl shadow-md">
          <Sparkles size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-900">Cadastro Inteligente por Imagem</h1>
          <p className="text-sm text-gray-500">Envie uma foto do cardápio ou nota fiscal e a IA extrai os dados automaticamente.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["menu", "invoice"] as TabType[]).map(t => (
          <button
            key={t}
            onClick={() => { reset(); setTab(t); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
              tab === t ? "bg-orange-500 text-white shadow-md shadow-orange-200" : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
            }`}
          >
            {t === "menu" ? <><ImageIcon size={15} /> Cardápio por Imagem</> : <><FileText size={15} /> Nota Fiscal / Cupom</>}
          </button>
        ))}
      </div>

      {/* ── IDLE / UPLOADING ── */}
      {(phase === "idle" || phase === "uploading") && (
        <div
          className={`relative border-2 border-dashed rounded-2xl transition cursor-pointer
            ${dragOver ? "border-orange-400 bg-orange-50" : "border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50/40"}
          `}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => phase === "idle" && fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept={tab === "menu" ? "image/*" : "image/*,application/xml,text/xml,application/pdf"}
            onChange={onFileInput}
          />

          <div className="py-16 flex flex-col items-center gap-4">
            {phase === "uploading" ? (
              <>
                <Loader2 size={40} className="text-orange-500 animate-spin" />
                <p className="text-gray-500 font-medium">Enviando arquivo…</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center">
                  <Upload size={28} className="text-orange-400" />
                </div>
                <div className="text-center">
                  <p className="text-gray-700 font-semibold">Arraste o arquivo aqui ou clique para selecionar</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {tab === "menu"
                      ? "JPG, PNG, WEBP — foto do cardápio ou lista de preços"
                      : "JPG, PNG, XML (NF-e), PDF — nota fiscal ou cupom"}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── PROCESSING ── */}
      {phase === "processing" && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Loader2 size={20} className="text-orange-500 animate-spin" />
            <span className="font-semibold text-gray-700">Processando com IA…</span>
          </div>

          {preview && (
            <img src={preview} alt="preview" className="max-h-48 rounded-xl object-contain mb-4 border border-gray-100" />
          )}
          {!preview && fileName && (
            <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
              <FileText size={16} /> {fileName}
            </div>
          )}

          <div className="bg-gray-900 rounded-xl p-4 font-mono text-xs text-green-400 space-y-1 max-h-48 overflow-y-auto">
            {logs.length === 0 && <span className="text-gray-500">Aguardando logs…</span>}
            {logs.map((l, i) => (
              <div key={i} className={l.level === "ERROR" ? "text-red-400" : "text-green-400"}>
                <span className="text-gray-500 mr-2">[{l.level}]</span>{l.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── REVIEW ── */}
      {phase === "review" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-800">
              Revise e edite os itens extraídos
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({tab === "menu" ? menuItems.filter(i => i.enabled).length : invoiceItems.filter(i => i.enabled).length} selecionados)
              </span>
            </h2>
            <button onClick={reset} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1">
              <XCircle size={14} /> Reiniciar
            </button>
          </div>

          {tab === "menu" ? (
            <MenuReviewTable items={menuItems} setItems={setMenuItems} categories={categories} />
          ) : (
            <InvoiceReviewTable items={invoiceItems} setItems={setInvoiceItems} />
          )}

          <div className="flex justify-end">
            <button
              onClick={tab === "menu" ? confirmMenu : confirmInvoice}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 shadow-md shadow-orange-200 transition"
            >
              <CheckCircle2 size={18} />
              {tab === "menu" ? "Salvar produtos no cardápio" : "Registrar entradas de estoque"}
            </button>
          </div>
        </div>
      )}

      {/* ── DONE ── */}
      {phase === "done" && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-10 text-center">
          <CheckCircle2 size={48} className="text-green-500 mx-auto mb-3" />
          <h2 className="text-xl font-black text-green-700 mb-1">Pronto!</h2>
          <p className="text-green-600 mb-6">{doneMsg}</p>
          <button
            onClick={reset}
            className="bg-green-500 hover:bg-green-600 text-white font-bold px-6 py-2.5 rounded-xl transition"
          >
            Fazer nova importação
          </button>
        </div>
      )}

      {/* ── ERROR ── */}
      {phase === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
          <XCircle size={40} className="text-red-400 mx-auto mb-3" />
          <p className="text-red-600 font-semibold mb-4">Erro ao processar o arquivo.</p>
          <button onClick={reset} className="bg-red-500 hover:bg-red-600 text-white font-bold px-5 py-2 rounded-xl transition">
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}

// ── Menu Review Table ─────────────────────────────────────────────────────────

function MenuReviewTable({
  items, setItems, categories,
}: {
  items: MenuItem[];
  setItems: (v: MenuItem[]) => void;
  categories: { id: string; name: string }[];
}) {
  function update(idx: number, patch: Partial<MenuItem>) {
    setItems(items.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="w-8 px-3 py-3"></th>
            <th className="text-left px-3 py-3 font-semibold text-gray-600">Nome</th>
            <th className="text-left px-3 py-3 font-semibold text-gray-600 hidden md:table-cell">Descrição</th>
            <th className="text-left px-3 py-3 font-semibold text-gray-600">Preço</th>
            <th className="text-left px-3 py-3 font-semibold text-gray-600 hidden md:table-cell">Categoria</th>
            <th className="text-center px-3 py-3 font-semibold text-gray-600">Confiança</th>
            <th className="w-8 px-2 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.map((item, idx) => (
            <tr key={item.itemId} className={item.enabled ? "" : "opacity-40"}>
              <td className="px-3 py-2">
                <input type="checkbox" checked={item.enabled} onChange={e => update(idx, { enabled: e.target.checked })}
                  className="accent-orange-500 w-4 h-4" />
              </td>
              <td className="px-3 py-2">
                <input
                  value={item.name}
                  onChange={e => update(idx, { name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-orange-400"
                  placeholder="Nome do produto"
                />
              </td>
              <td className="px-3 py-2 hidden md:table-cell">
                <input
                  value={item.description ?? ""}
                  onChange={e => update(idx, { description: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-orange-400"
                  placeholder="Descrição"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="number"
                  value={item.price ?? ""}
                  onChange={e => update(idx, { price: e.target.value === "" ? undefined : Number(e.target.value) })}
                  className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-orange-400"
                  placeholder="0.00"
                  step="0.01"
                />
              </td>
              <td className="px-3 py-2 hidden md:table-cell">
                <div className="relative">
                  <select
                    value={item.categoryId ?? ""}
                    onChange={e => update(idx, { categoryId: e.target.value })}
                    className="w-full appearance-none border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-orange-400 pr-7"
                  >
                    <option value="">— sem categoria —</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </td>
              <td className="px-3 py-2 text-center">
                <ConfidenceBadge v={item.confidence} />
              </td>
              <td className="px-2 py-2">
                <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-400">
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Invoice Review Table ──────────────────────────────────────────────────────

function InvoiceReviewTable({
  items, setItems,
}: {
  items: InvoiceItem[];
  setItems: (v: InvoiceItem[]) => void;
}) {
  function update(idx: number, patch: Partial<InvoiceItem>) {
    setItems(items.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="w-8 px-3 py-3"></th>
            <th className="text-left px-3 py-3 font-semibold text-gray-600">Produto</th>
            <th className="text-left px-3 py-3 font-semibold text-gray-600">Qtd</th>
            <th className="text-left px-3 py-3 font-semibold text-gray-600">Un</th>
            <th className="text-left px-3 py-3 font-semibold text-gray-600">Custo unit.</th>
            <th className="text-center px-3 py-3 font-semibold text-gray-600 hidden md:table-cell">Criar produto?</th>
            <th className="text-center px-3 py-3 font-semibold text-gray-600">Conf.</th>
            <th className="w-8 px-2 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.map((item, idx) => (
            <tr key={item.itemId} className={item.enabled ? "" : "opacity-40"}>
              <td className="px-3 py-2">
                <input type="checkbox" checked={item.enabled} onChange={e => update(idx, { enabled: e.target.checked })}
                  className="accent-orange-500 w-4 h-4" />
              </td>
              <td className="px-3 py-2">
                <input
                  value={item.name}
                  onChange={e => update(idx, { name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-orange-400"
                  placeholder="Nome do produto"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="number"
                  value={item.quantity}
                  onChange={e => update(idx, { quantity: Number(e.target.value) })}
                  className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-orange-400"
                  step="0.001"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  value={item.unit ?? "UN"}
                  onChange={e => update(idx, { unit: e.target.value })}
                  className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-orange-400 uppercase"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="number"
                  value={item.unitCost}
                  onChange={e => update(idx, { unitCost: Number(e.target.value) })}
                  className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-orange-400"
                  step="0.01"
                />
              </td>
              <td className="px-3 py-2 text-center hidden md:table-cell">
                <input
                  type="checkbox"
                  checked={item.createProduct}
                  onChange={e => update(idx, { createProduct: e.target.checked })}
                  className="accent-orange-500 w-4 h-4"
                  title="Criar produto no catálogo se não existir"
                />
              </td>
              <td className="px-3 py-2 text-center">
                <ConfidenceBadge v={item.confidence} />
              </td>
              <td className="px-2 py-2">
                <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-400">
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
