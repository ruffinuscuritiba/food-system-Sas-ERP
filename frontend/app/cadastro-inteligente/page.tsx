"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { AiTrialLock } from "@/components/AiTrialLock";
import { useNavKeyGuard } from "@/hooks/useNavKeyGuard";
import {
  Sparkles, Upload, FileText, Image as ImageIcon, Loader2,
  CheckCircle2, XCircle, X, Trash2, ChevronDown, RefreshCw, Zap,
  FileSpreadsheet, FileCode2, FileImage, Plus,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type TabType = "menu" | "invoice" | "pdf" | "xml" | "spreadsheet";
type Phase = "idle" | "uploading" | "processing" | "review" | "done" | "error";

interface SessionLog { level: string; message: string; createdAt: string }

// FIX 1 — sizes adicionado à interface
interface ProductSizeEntry {
  size: string;
  price: number;
}

interface MenuItem {
  itemId: string;
  name: string;
  description?: string;
  price?: number;
  sizes: ProductSizeEntry[];   // ← novo campo; [] quando produto simples
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
  ingredientId: string;
  rememberAlias: boolean;
  enabled: boolean;
}

// ── Tab config ────────────────────────────────────────────────────────────────

const TAB_CONFIG: {
  key: TabType;
  label: string;
  icon: React.ReactNode;
  formats: string;
  accept: string;
  hint: string;
  endpoint: "menu" | "invoice";
}[] = [
  {
    key: "menu",
    label: "Cardápio Imagem",
    icon: <FileImage size={18} />,
    formats: "JPG · PNG · WEBP",
    accept: "image/*",
    hint: "Foto do cardápio, lista de preços ou embalagem",
    endpoint: "menu",
  },
  {
    key: "pdf",
    label: "PDF Cardápio",
    icon: <FileText size={18} />,
    formats: "PDF",
    accept: "application/pdf,.pdf",
    hint: "Cardápio ou lista de preços em PDF",
    endpoint: "menu",
  },
  {
    key: "invoice",
    label: "Nota Fiscal",
    icon: <FileImage size={18} />,
    formats: "JPG · PNG · PDF",
    accept: "image/*,application/pdf,.pdf",
    hint: "Foto ou PDF de nota fiscal / cupom fiscal",
    endpoint: "invoice",
  },
  {
    key: "xml",
    label: "XML NF-e",
    icon: <FileCode2 size={18} />,
    formats: "XML",
    accept: "application/xml,text/xml,.xml",
    hint: "Arquivo XML de Nota Fiscal Eletrônica (NF-e)",
    endpoint: "invoice",
  },
  {
    key: "spreadsheet",
    label: "Planilha Excel",
    icon: <FileSpreadsheet size={18} />,
    formats: "XLSX · XLSM",
    accept: ".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12",
    hint: "Planilha de produtos ou lista de preços",
    endpoint: "menu",
  },
];

// ── Progress stages ───────────────────────────────────────────────────────────

const STAGES = [
  { id: "upload",      label: "Upload",               match: /enviando|arquivo recebido/i },
  { id: "analyzing",   label: "Analisando imagem",    match: /analisando|conectando/i },
  { id: "extracting",  label: "Extraindo produtos",   match: /extraindo|tentando|ia respondeu/i },
  { id: "organizing",  label: "Organizando dados",    match: /organizando|produto.*identificado/i },
  { id: "done",        label: "Finalizado",           match: /concluída|concluído/i },
];

function getStageIndex(logs: SessionLog[]): number {
  if (logs.length === 0) return 0;
  let maxIdx = 0;
  for (const log of logs) {
    for (let i = STAGES.length - 1; i >= 0; i--) {
      if (STAGES[i].match.test(log.message)) {
        if (i > maxIdx) maxIdx = i;
        break;
      }
    }
  }
  return maxIdx;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ConfidenceBadge({ v }: { v?: number }) {
  if (v == null) return null;
  const pct = Math.round(v * 100);
  const color = pct >= 90 ? "bg-green-100 text-green-700" : pct >= 70 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";
  return <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${color}`}>{pct}%</span>;
}

function ProgressBar({ logs }: { logs: SessionLog[] }) {
  const idx = getStageIndex(logs);
  const pct = Math.round(((idx + 1) / STAGES.length) * 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        {STAGES.map((s, i) => {
          const done = i < idx;
          const active = i === idx;
          return (
            <div key={s.id} className="flex items-center flex-1 min-w-0">
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-500 ${
                done    ? "bg-green-100 text-green-700" :
                active  ? "bg-primary/10 text-primary ring-1 ring-primary/30" :
                          "bg-gray-100 text-gray-400"
              }`}>
                {done
                  ? <CheckCircle2 size={11} />
                  : active
                    ? <Loader2 size={11} className="animate-spin" />
                    : <div className="w-1.5 h-1.5 rounded-full bg-current" />
                }
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < STAGES.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 transition-all duration-700 ${i < idx ? "bg-green-300" : "bg-gray-200"}`} />
              )}
            </div>
          );
        })}
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-orange-400 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 text-center font-medium">
        {STAGES[idx].label}…
      </p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CadastroInteligentePage() {
  useNavKeyGuard("smart-import");
  const { isAiLocked, isExpired, loading: subLoading } = useSubscription();

  const [tab, setTab]                       = useState<TabType>("menu");
  const [phase, setPhase]                   = useState<Phase>("idle");
  const [sessionId, setSessionId]           = useState<string | null>(null);
  const [logs, setLogs]                     = useState<SessionLog[]>([]);
  const [menuItems, setMenuItems]           = useState<MenuItem[]>([]);
  const [invoiceItems, setInvoiceItems]     = useState<InvoiceItem[]>([]);
  const [categories, setCategories]         = useState<{ id: string; name: string }[]>([]);
  const [ingredients, setIngredients]       = useState<{ id: string; name: string }[]>([]);
  const [aliases, setAliases]               = useState<{ alias: string; ingredientId: string }[]>([]);
  const [doneMsg, setDoneMsg]               = useState("");
  const [errorMsg, setErrorMsg]             = useState("");
  const [dragOver, setDragOver]             = useState(false);
  const [preview, setPreview]               = useState<string | null>(null);
  const [fileName, setFileName]             = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.get("/categories").then(r => setCategories(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    api.get("/ingredients").then(r => setIngredients(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    api.get("/ingredients/aliases").then(r => setAliases(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  function reset() {
    if (pollRef.current) clearInterval(pollRef.current);
    setPhase("idle");
    setSessionId(null);
    setLogs([]);
    setMenuItems([]);
    setInvoiceItems([]);
    setDoneMsg("");
    setErrorMsg("");
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
      const tc = TAB_CONFIG.find(t => t.key === tab)!;
      const endpoint = `/smart-import/${tc.endpoint}`;
      const { data } = await api.post(endpoint, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setSessionId(data.sessionId);
      setPhase("processing");
      startPolling(data.sessionId);
    } catch {
      setErrorMsg("Não foi possível enviar o arquivo. Verifique sua conexão e tente novamente.");
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
        setErrorMsg(data.errorMsg || "Não foi possível processar a imagem agora.");
        setPhase("error");
      }
    } catch {
      // keep polling — transient network issue
    }
  }

  // FIX 2 — buildReviewState lê e armazena sizes[]
  function buildReviewState(data: any) {
    const items: any[] = data.items ?? [];
    const tabConfig = TAB_CONFIG.find(t => t.key === tab);
    const isMenu = tabConfig?.endpoint === "menu";

    if (isMenu) {
      setMenuItems(items.map((it: any) => {
        // sizes pode vir de dois lugares dependendo do flatten do getSession():
        // - it.sizes (campo exposto diretamente pelo getSession corrigido)
        // - it.data?.sizes (fallback se o flatten não estiver presente)
        const rawSizes: any[] =
          Array.isArray(it.sizes)      ? it.sizes :
          Array.isArray(it.data?.sizes) ? it.data.sizes :
          [];

        const sizes: ProductSizeEntry[] = rawSizes
          .filter((s: any) => s && s.size)
          .map((s: any) => ({
            size: String(s.size),
            price: Number(s.price ?? 0),
          }))
          .filter((s) => s.price > 0);

        return {
          itemId: it.id,
          name: it.data?.name ?? it.name ?? "",
          description: it.data?.description ?? it.description ?? "",
          price: it.data?.price ?? it.price ?? undefined,
          sizes,                           // ← armazenado no estado
          category: it.data?.category ?? it.category ?? "",
          suggestedCategoryId: it.data?.suggestedCategoryId ?? it.suggestedCategoryId ?? undefined,
          categoryId: it.data?.suggestedCategoryId ?? it.suggestedCategoryId ?? "",
          confidence: it.confidence ?? it.data?.confidence ?? undefined,
          enabled: true,
        } satisfies MenuItem;
      }));
    } else {
      const DIACRITICS_RE = new RegExp("[\\u0300-\\u036f]", "g");
      const normalize = (s: string) =>
        s.normalize("NFD").replace(DIACRITICS_RE, "").toLowerCase().trim().replace(/\s+/g, " ");

      setInvoiceItems(items.map((it: any) => {
        const name = it.data?.name ?? it.name ?? "";
        const normalizedName = normalize(name);
        const exactMatch = ingredients.find((ing) => normalize(ing.name) === normalizedName);
        const aliasMatch = !exactMatch
          ? aliases.find((a) => normalize(a.alias) === normalizedName)
          : null;
        // Sem nenhum match: já vem marcado para criar como ingrediente novo —
        // sem isso, notas grandes (dezenas de itens) exigiam clicar item por
        // item em "Criar novo" ou tudo era descartado silenciosamente.
        const hasMatch = !!exactMatch || !!aliasMatch;
        return {
          itemId: it.id,
          name,
          quantity: it.data?.quantity ?? it.quantity ?? 1,
          unit: it.data?.unit ?? it.unit ?? "UN",
          unitCost: it.data?.unitCost ?? it.unitCost ?? 0,
          total: it.data?.total ?? it.total ?? undefined,
          confidence: it.confidence ?? it.data?.confidence ?? undefined,
          createProduct: !hasMatch,
          ingredientId: exactMatch?.id ?? aliasMatch?.ingredientId ?? "",
          rememberAlias: false,
          enabled: true,
        };
      }));
    }
  }

  // FIX 4 — confirmMenu envia sizes no payload
  async function confirmMenu() {
    const enabled = menuItems.filter(i => i.enabled);
    if (!enabled.length) { toast.error("Nenhum item selecionado"); return; }
    try {
      const { data } = await api.post(`/smart-import/confirm/menu/${sessionId}`, {
        items: enabled.map(i => ({
          itemId: i.itemId,
          name: i.name,
          description: i.description || undefined,
          // Se tem sizes, price é omitido — o backend usa o menor size como salePrice.
          // Se não tem sizes, price é enviado normalmente (produto simples).
          price: i.sizes.length === 0 && i.price ? Number(i.price) : undefined,
          categoryId: i.categoryId || undefined,
          sizes: i.sizes.length > 0 ? i.sizes : undefined,  // ← enviado quando presente
        })),
      });
      setDoneMsg(`${data.created} produto(s) cadastrado(s) com sucesso!`);
      setPhase("done");
    } catch {
      toast.error("Erro ao confirmar itens");
    }
  }

  async function confirmInvoice(force = false) {
    const enabled = invoiceItems.filter(i => i.enabled);
    if (!enabled.length) { toast.error("Nenhum item selecionado"); return; }
    try {
      const { data } = await api.post(`/smart-import/confirm/invoice/${sessionId}`, {
        force,
        items: enabled.map(i => ({
          itemId: i.itemId,
          name: i.name,
          quantity: Number(i.quantity),
          unitCost: Number(i.unitCost),
          unit: i.unit,
          createProduct: i.createProduct,
          ingredientId: i.ingredientId || undefined,
          rememberAlias: i.rememberAlias,
        })),
      });

      if (data.duplicate) {
        const dateLabel = data.existingDate ? new Date(data.existingDate).toLocaleDateString("pt-BR") : "";
        const proceed = window.confirm(
          `A nota fiscal nº ${data.docNumber} já foi lançada${dateLabel ? ` em ${dateLabel}` : ""}. Confirmar mesmo assim pode duplicar o estoque. Deseja continuar?`,
        );
        if (proceed) await confirmInvoice(true);
        return;
      }

      setDoneMsg(`${data.created} entrada(s) de estoque registrada(s)!`);
      const skipped: { name: string }[] = data.skipped ?? [];
      if (skipped.length > 0) {
        toast.error(
          `${skipped.length} item(ns) sem ingrediente selecionado e foram ignorados: ${skipped.slice(0, 3).map(s => s.name).join(", ")}${skipped.length > 3 ? "…" : ""}. Escolha um ingrediente ou marque "Criar novo" e confirme de novo.`,
          { duration: 10000 },
        );
      }
      setPhase("done");
    } catch {
      toast.error("Erro ao confirmar itens");
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!subLoading && isAiLocked) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto">
        <AiTrialLock variant={isExpired ? "expired" : "trial"} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gradient-to-br from-orange-400 to-orange-600 p-2.5 rounded-xl shadow-md shadow-orange-200">
          <Sparkles size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-900">Cadastro Inteligente por Imagem</h1>
          <p className="text-sm text-gray-500">Envie uma foto do cardápio ou nota fiscal e a IA extrai os dados automaticamente.</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full">
          <Zap size={11} />
          Gemini Flash
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
        {TAB_CONFIG.map(tc => (
          <button
            key={tc.key}
            onClick={() => { reset(); setTab(tc.key); }}
            className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-xs font-semibold transition border ${
              tab === tc.key
                ? "bg-primary text-white shadow-md shadow-primary/20 border-primary"
                : "bg-white text-gray-500 hover:bg-gray-50 border-gray-200 hover:border-gray-300"
            }`}
          >
            <span className={tab === tc.key ? "text-white" : "text-gray-400"}>{tc.icon}</span>
            <span className="leading-tight text-center">{tc.label}</span>
            <span className={`text-[10px] font-medium ${tab === tc.key ? "text-white/70" : "text-gray-400"}`}>{tc.formats}</span>
          </button>
        ))}
      </div>

      {/* ── IDLE / UPLOADING ── */}
      {(phase === "idle" || phase === "uploading") && (
        <div
          className={`relative border-2 border-dashed rounded-2xl transition cursor-pointer
            ${dragOver ? "border-primary bg-primary/5" : "border-gray-200 bg-white hover:border-orange-300"}
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
            accept={TAB_CONFIG.find(t => t.key === tab)?.accept ?? "image/*"}
            onChange={onFileInput}
          />
          <div className="py-16 flex flex-col items-center gap-4">
            {phase === "uploading" ? (
              <>
                <Loader2 size={40} className="text-primary animate-spin" />
                <p className="text-gray-500 font-medium">Enviando arquivo…</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center">
                  <Upload size={28} className="text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-gray-700 font-semibold">Arraste o arquivo aqui ou clique para selecionar</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {TAB_CONFIG.find(t => t.key === tab)?.hint}
                  </p>
                  <p className="text-[11px] text-gray-300 mt-1 font-medium tracking-wide">
                    {TAB_CONFIG.find(t => t.key === tab)?.formats}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── PROCESSING ── */}
      {phase === "processing" && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-5">
          {preview && (
            <div className="relative">
              <img src={preview} alt="preview" className="max-h-44 rounded-xl object-contain border border-gray-100 w-full" />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
            </div>
          )}
          {!preview && fileName && (
            <div className="flex items-center gap-2.5 bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-600">
              <FileText size={16} className="text-primary shrink-0" />
              <span className="truncate font-medium">{fileName}</span>
            </div>
          )}
          <ProgressBar logs={logs} />
          <div className="space-y-2 pt-1">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 animate-pulse">
                <div className="w-10 h-10 rounded-lg bg-gray-200 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-gray-200 rounded w-2/3" style={{ width: `${50 + i * 12}%` }} />
                  <div className="h-2.5 bg-gray-100 rounded w-1/3" />
                </div>
                <div className="w-12 h-6 rounded-lg bg-gray-200" />
              </div>
            ))}
          </div>
          <details className="group">
            <summary className="text-xs text-gray-400 cursor-pointer select-none hover:text-gray-600 transition flex items-center gap-1.5">
              <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
              Ver log detalhado
            </summary>
            <div className="mt-2 bg-gray-900 rounded-xl p-4 font-mono text-xs text-green-400 space-y-0.5 max-h-40 overflow-y-auto">
              {logs.length === 0 && <span className="text-gray-500">Aguardando…</span>}
              {logs.map((l, i) => (
                <div key={i} className={l.level === "ERROR" ? "text-red-400" : "text-green-400"}>
                  <span className="text-gray-500 mr-2">[{l.level}]</span>{l.message}
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* ── REVIEW ── */}
      {phase === "review" && (() => {
        const isMenuTab = TAB_CONFIG.find(t => t.key === tab)?.endpoint === "menu";
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800">
                Revise e edite os itens extraídos
                <span className="ml-2 text-sm font-normal text-gray-400">
                  ({isMenuTab ? menuItems.filter(i => i.enabled).length : invoiceItems.filter(i => i.enabled).length} selecionados)
                </span>
              </h2>
              <div className="flex items-center gap-3">
                {!isMenuTab && invoiceItems.some(i => !i.ingredientId && !i.createProduct) && (
                  <button
                    onClick={() => setInvoiceItems(invoiceItems.map(i =>
                      !i.ingredientId ? { ...i, createProduct: true } : i
                    ))}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Marcar sem match como "Criar novo"
                  </button>
                )}
                <button onClick={reset} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1">
                  <XCircle size={14} /> Reiniciar
                </button>
              </div>
            </div>

            {isMenuTab ? (
              <MenuReviewTable items={menuItems} setItems={setMenuItems} categories={categories} />
            ) : (
              <InvoiceReviewTable items={invoiceItems} setItems={setInvoiceItems} ingredients={ingredients} />
            )}

            <div className="flex justify-end">
              <button
                onClick={() => (isMenuTab ? confirmMenu() : confirmInvoice())}
                className="bg-primary hover:bg-primary/90 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 shadow-md shadow-primary/20 transition"
              >
                <CheckCircle2 size={18} />
                {isMenuTab ? "Salvar produtos no cardápio" : "Registrar entradas de estoque"}
              </button>
            </div>
          </div>
        );
      })()}

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
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center space-y-4">
          <XCircle size={40} className="text-red-400 mx-auto" />
          <div>
            <p className="text-red-700 font-semibold text-sm">
              {errorMsg || "Não foi possível processar a imagem agora."}
            </p>
            <p className="text-red-400 text-xs mt-1">
              Tente novamente ou use uma imagem com melhor resolução.
            </p>
          </div>
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold px-5 py-2 rounded-xl transition"
          >
            <RefreshCw size={15} /> Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}

// ── Menu Review Table ─────────────────────────────────────────────────────────

// FIX 3 — exibe e permite edição de sizes[]
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

  function updateSize(itemIdx: number, sizeIdx: number, patch: Partial<ProductSizeEntry>) {
    const sizes = items[itemIdx].sizes.map((s, i) => i === sizeIdx ? { ...s, ...patch } : s);
    update(itemIdx, { sizes });
  }

  function addSize(itemIdx: number) {
    const sizes = [...items[itemIdx].sizes, { size: "", price: 0 }];
    update(itemIdx, { sizes });
  }

  function removeSize(itemIdx: number, sizeIdx: number) {
    const sizes = items[itemIdx].sizes.filter((_, i) => i !== sizeIdx);
    update(itemIdx, { sizes });
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="w-8 px-3 py-3"></th>
            <th className="text-left px-3 py-3 font-semibold text-gray-600">Nome</th>
            <th className="text-left px-3 py-3 font-semibold text-gray-600 hidden md:table-cell">Descrição</th>
            {/* FIX 3a — coluna Preço / Tamanhos (condicional por linha) */}
            <th className="text-left px-3 py-3 font-semibold text-gray-600">Preço / Tamanhos</th>
            <th className="text-left px-3 py-3 font-semibold text-gray-600 hidden md:table-cell">Categoria</th>
            <th className="text-center px-3 py-3 font-semibold text-gray-600">Conf.</th>
            <th className="w-8 px-2 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.map((item, idx) => (
            <tr key={item.itemId} className={item.enabled ? "" : "opacity-40"}>
              <td className="px-3 py-2 align-top pt-3">
                <input type="checkbox" checked={item.enabled} onChange={e => update(idx, { enabled: e.target.checked })}
                  className="accent-orange-500 w-4 h-4" />
              </td>
              <td className="px-3 py-2 align-top pt-3">
                <input value={item.name} onChange={e => update(idx, { name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-primary"
                  placeholder="Nome do produto" />
              </td>
              <td className="px-3 py-2 hidden md:table-cell align-top pt-3">
                <input value={item.description ?? ""} onChange={e => update(idx, { description: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-primary"
                  placeholder="Descrição" />
              </td>

              {/* FIX 3b — célula de preço: simples OU lista de tamanhos editável */}
              <td className="px-3 py-2 align-top pt-3">
                {item.sizes.length === 0 ? (
                  /* Produto simples — comportamento original */
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={item.price ?? ""}
                      onChange={e => update(idx, { price: e.target.value === "" ? undefined : Number(e.target.value) })}
                      className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-primary"
                      placeholder="0.00"
                      step="0.01"
                    />
                    {/* Botão para converter para produto com tamanhos */}
                    <button
                      type="button"
                      title="Adicionar tamanhos"
                      onClick={() => update(idx, { sizes: [{ size: "", price: item.price ?? 0 }], price: undefined })}
                      className="text-gray-300 hover:text-primary transition"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                ) : (
                  /* Produto com variantes — lista editável de tamanho + preço */
                  <div className="space-y-1.5">
                    {item.sizes.map((s, sIdx) => (
                      <div key={sIdx} className="flex items-center gap-1.5">
                        {/* Label do tamanho (ex: MÉDIA, GRANDE) */}
                        <input
                          value={s.size}
                          onChange={e => updateSize(idx, sIdx, { size: e.target.value })}
                          className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-primary uppercase"
                          placeholder="Ex: G"
                        />
                        {/* Preço do tamanho */}
                        <input
                          type="number"
                          value={s.price}
                          onChange={e => updateSize(idx, sIdx, { price: Number(e.target.value) })}
                          className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-primary"
                          placeholder="0.00"
                          step="0.01"
                        />
                        <button
                          type="button"
                          onClick={() => removeSize(idx, sIdx)}
                          className="text-gray-300 hover:text-red-400 transition"
                        >
                          <XCircle size={13} />
                        </button>
                      </div>
                    ))}
                    {/* Adicionar mais um tamanho */}
                    <button
                      type="button"
                      onClick={() => addSize(idx)}
                      className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-primary transition mt-0.5"
                    >
                      <Plus size={11} /> tamanho
                    </button>
                  </div>
                )}
              </td>

              <td className="px-3 py-2 hidden md:table-cell align-top pt-3">
                <div className="relative">
                  <select value={item.categoryId ?? ""} onChange={e => update(idx, { categoryId: e.target.value })}
                    className="w-full appearance-none border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-primary pr-7">
                    <option value="">— sem categoria —</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </td>
              <td className="px-3 py-2 text-center align-top pt-3">
                <ConfidenceBadge v={item.confidence} />
              </td>
              <td className="px-2 py-2 align-top pt-3">
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
  items, setItems, ingredients,
}: {
  items: InvoiceItem[];
  setItems: (v: InvoiceItem[]) => void;
  ingredients: { id: string; name: string }[];
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
            <th className="text-left px-3 py-3 font-semibold text-gray-600">Produto (da nota)</th>
            <th className="text-left px-3 py-3 font-semibold text-gray-600">Qtd</th>
            <th className="text-left px-3 py-3 font-semibold text-gray-600">Un</th>
            <th className="text-left px-3 py-3 font-semibold text-gray-600">Custo unit.</th>
            <th className="text-left px-3 py-3 font-semibold text-gray-600">Ingrediente</th>
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
                <input value={item.name} onChange={e => update(idx, { name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-primary"
                  placeholder="Nome do produto" />
              </td>
              <td className="px-3 py-2">
                <input type="number" value={item.quantity} onChange={e => update(idx, { quantity: Number(e.target.value) })}
                  className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-primary" step="0.001" />
              </td>
              <td className="px-3 py-2">
                <input value={item.unit ?? "UN"} onChange={e => update(idx, { unit: e.target.value })}
                  className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-primary uppercase" />
              </td>
              <td className="px-3 py-2">
                <input type="number" value={item.unitCost} onChange={e => update(idx, { unitCost: Number(e.target.value) })}
                  className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-primary" step="0.01" />
              </td>
              <td className="px-3 py-2 min-w-[180px]">
                {item.createProduct ? (
                  <div className="flex items-center gap-1.5">
                    <span className="flex-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg px-2 py-1.5 truncate" title={item.name}>
                      + Criar novo: {item.name}
                    </span>
                    <button type="button" onClick={() => update(idx, { createProduct: false })}
                      className="text-gray-400 hover:text-gray-600 text-xs shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div>
                    <select
                      value={item.ingredientId}
                      onChange={e => {
                        if (e.target.value === "__new__") {
                          update(idx, { createProduct: true, ingredientId: "", rememberAlias: false });
                        } else {
                          update(idx, { ingredientId: e.target.value, createProduct: false });
                        }
                      }}
                      className={`w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-primary ${item.ingredientId ? "border-gray-200" : "border-amber-300 bg-amber-50"}`}
                    >
                      <option value="">Selecione um ingrediente...</option>
                      {ingredients.map(ing => (
                        <option key={ing.id} value={ing.id}>{ing.name}</option>
                      ))}
                      <option value="__new__">+ Criar novo ingrediente</option>
                    </select>
                    {(() => {
                      const selected = ingredients.find(ing => ing.id === item.ingredientId);
                      if (!selected) return null;
                      const normalize = (s: string) =>
                        s.normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "").toLowerCase().trim().replace(/\s+/g, " ");
                      if (normalize(selected.name) === normalize(item.name)) return null;
                      return (
                        <label className="flex items-center gap-1.5 mt-1 text-xs text-gray-500 cursor-pointer">
                          <input type="checkbox" checked={item.rememberAlias}
                            onChange={e => update(idx, { rememberAlias: e.target.checked })}
                            className="accent-orange-500 w-3.5 h-3.5" />
                          Lembrar &quot;{item.name}&quot; como {selected.name} da próxima vez
                        </label>
                      );
                    })()}
                  </div>
                )}
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
