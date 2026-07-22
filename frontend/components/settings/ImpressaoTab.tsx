"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import toast from "react-hot-toast";
import {
  Save, Loader2, Printer, Zap, CheckCircle2,
  AlignLeft, Tag, FileText, Layers, Pizza as PizzaIcon,
  Wifi, WifiOff, Receipt, Banknote, CreditCard,
  Download, Copy, CheckCheck, RefreshCw, ChevronDown, Plus, Trash2,
  Tablet,
} from "lucide-react";

// ── OS Detection (agente local) ─────────────────────────────────────────────

function detectOS(): "windows" | "linux" | "mac" {
  if (typeof navigator === "undefined") return "windows";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win"))   return "windows";
  if (ua.includes("mac"))   return "mac";
  return "linux";
}

const DOWNLOADS = {
  windows: { label: "Windows (.exe)",    file: "FoodSaaS-Printer-Agent-win.exe" },
  linux:   { label: "Linux (x64)",       file: "FoodSaaS-Printer-Agent-linux" },
  mac:     { label: "macOS (universal)", file: "FoodSaaS-Printer-Agent-mac" },
};
const RELEASE_BASE = process.env.NEXT_PUBLIC_AGENT_RELEASE_URL ?? "#";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface PrintingSettings {
  useAssistant:     boolean;
  autoPrint:        boolean;
  autoAccept:       boolean;
  showCNPJ:         boolean;
  showCategory:     boolean;
  showDescription:  boolean;
  pizzaItemFormat:  "compact" | "perFlavor";
  addonGrouping:    boolean;
  printMode:         "ALL" | "SELECTED";
  printPaymentTypes: string[];
}

const DEFAULT_SETTINGS: PrintingSettings = {
  useAssistant:    false,
  autoPrint:       false,
  autoAccept:      false,
  showCNPJ:        true,
  showCategory:    true,
  showDescription: false,
  pizzaItemFormat: "compact",
  addonGrouping:   true,
  printMode:         "ALL",
  printPaymentTypes: ["PIX", "CREDIT_CARD", "DEBIT_CARD", "TRANSFER"],
};

export const PAYMENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "CASH",        label: "Dinheiro" },
  { value: "PIX",         label: "PIX" },
  { value: "CREDIT_CARD", label: "Cartão de Crédito" },
  { value: "DEBIT_CARD",  label: "Cartão de Débito" },
  { value: "TRANSFER",    label: "Transferência" },
];

interface PrinterRecord {
  id:             string;
  name:           string;
  brand?:         string;
  connectionType: "BROWSER" | "NETWORK" | "USB";
  address?:       string;
  paperWidth:     "MM_58" | "MM_80";
  isOnline:       boolean;
  isActive:       boolean;
}

// ── UI helpers reutilizáveis ─────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      aria-checked={checked}
      role="switch"
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
      } ${checked ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function SettingRow({ icon, label, sublabel, checked, onChange, disabled }: {
  icon: React.ReactNode; label: string; sublabel?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-colors ${
      disabled ? "border-gray-100 dark:border-gray-800 opacity-40"
        : checked ? "border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20"
        : "border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/30"
    }`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
        checked && !disabled ? "bg-orange-100 dark:bg-orange-900/40 text-orange-600" : "bg-gray-100 dark:bg-gray-800 text-gray-400"
      }`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
        {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function AgentStatusPill({ online, loading }: { online: boolean; loading: boolean }) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
        <RefreshCw size={12} className="animate-spin" /> Verificando...
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
      online ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
    }`}>
      {online ? <Wifi size={12} /> : <WifiOff size={12} />}
      {online ? "Assistente Aberto" : "Assistente Fechado"}
    </span>
  );
}

// ── Preview da bobina (cupom 80mm simulado) ───────────────────────────────────

function ReceiptPreview({ s }: { s: PrintingSettings }) {
  return (
    <div className="flex flex-col items-center select-none">
      <div className="relative w-[260px]">
        <div className="h-4 bg-gradient-to-b from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-t-full border border-b-0 border-gray-300 dark:border-gray-600" />
        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600 border border-gray-400 dark:border-gray-500" />
      </div>

      <div className="w-[260px] bg-white dark:bg-gray-50 shadow-2xl border-x border-gray-200 dark:border-gray-300 px-4 pb-0 text-gray-900 font-mono text-[10.5px] leading-relaxed">
        <div className="text-center border-b border-dashed border-gray-300 pb-2 pt-3 mb-2">
          <div className="font-bold text-[13px] tracking-wide">BELLA NAPOLI</div>
          {s.showCNPJ && (
            <div className="text-[9px] text-gray-500 mt-0.5">
              CNPJ: 12.345.678/0001-90
              <br />
              <span className="text-[9px]">Bella Napoli Ltda.</span>
            </div>
          )}
          <div className="text-[9px] text-gray-400 mt-0.5">Rua das Flores, 123 — Centro</div>
        </div>

        <div className="border-b border-dashed border-gray-300 pb-2 mb-2 text-[9.5px]">
          <div className="flex justify-between font-semibold">
            <span>PEDIDO #42</span>
            <span>DELIVERY</span>
          </div>
          <div className="text-gray-500">14/06/2026  19:32</div>
          <div className="text-gray-500 mt-0.5">Cliente: João da Silva</div>
          <div className="text-gray-500">Rua Ipê, 80 — Batel</div>
        </div>

        <div className="border-b border-dashed border-gray-300 pb-2 mb-2 space-y-2">
          {s.showCategory && <div className="text-[9px] text-center text-gray-400 tracking-widest">─── PIZZAS ───</div>}

          <div>
            <div className="flex justify-between text-[10px] font-medium">
              <span>1x Pizza Grande</span>
              <span>R$59,90</span>
            </div>
            {s.pizzaItemFormat === "perFlavor" ? (
              <div className="ml-2 text-[9px] text-gray-500">
                <div>1/2 Mussarela</div>
                <div>1/2 Frango c/ Catupiry</div>
              </div>
            ) : (
              <div className="ml-2 text-[9px] text-gray-500">Mussarela / Frango c/ Catupiry</div>
            )}
            {s.showDescription && (
              <div className="ml-2 text-[9px] text-gray-400 italic">Borda recheada, molho especial, 8 fatias</div>
            )}
            {s.addonGrouping ? (
              <div className="ml-2 text-[9px] text-gray-500">+ Bordas: Catupiry, Cheddar (R$9,90)</div>
            ) : (
              <div className="ml-2 text-[9px] text-gray-500 space-y-0">
                <div>+ Borda Catupiry.........R$4,90</div>
                <div>+ Borda Cheddar.........R$5,00</div>
              </div>
            )}
          </div>

          {s.showCategory && <div className="text-[9px] text-center text-gray-400 tracking-widest">─── BEBIDAS ───</div>}

          <div>
            <div className="flex justify-between text-[10px] font-medium">
              <span>2x Coca-Cola 2L</span>
              <span>R$18,00</span>
            </div>
            {s.showDescription && <div className="ml-2 text-[9px] text-gray-400 italic">Gelada, garrafa PET</div>}
          </div>
        </div>

        <div className="text-[9.5px] space-y-0.5 mb-2">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>R$77,90</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Taxa de entrega</span>
            <span>R$5,00</span>
          </div>
          <div className="flex justify-between font-bold text-[11px] border-t border-gray-200 pt-1 mt-1">
            <span>TOTAL</span>
            <span>R$82,90</span>
          </div>
          <div className="text-center text-gray-500 text-[9px] mt-1">PAGAMENTO: PIX ✓ CONFIRMADO</div>
        </div>

        <div className="text-center text-[9px] text-gray-400 border-t border-dashed border-gray-300 pt-2 pb-3">
          Obrigado pela preferência!
          <br />
          <span className="text-[11px]">★★★★★</span>
          <br />
          foodsaas.com.br
        </div>
      </div>

      <div className="w-[260px] flex items-center gap-0">
        <div className="flex-1 border-t-2 border-dashed border-gray-300 dark:border-gray-600" />
        <span className="text-xs text-gray-300 dark:text-gray-600 px-1 select-none">✂</span>
        <div className="flex-1 border-t-2 border-dashed border-gray-300 dark:border-gray-600" />
      </div>
      <div className="w-[260px] h-3 bg-gradient-to-t from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-b-sm border border-t-0 border-gray-300 dark:border-gray-600" />
      <p className="text-[10px] text-gray-400 mt-3 text-center">Preview dinâmico — reage aos toggles ao lado</p>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function ImpressaoTab() {
  const { user } = useAuthStore();
  const [settings, setSettings] = useState<PrintingSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  // Assistente local (download/token/status)
  const [os, setOs] = useState<"windows" | "linux" | "mac">("windows");
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState("");
  const [agentOnline, setAgentOnline] = useState(false);
  const [agentLoading, setAgentLoading] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);

  // Impressoras cadastradas (lista simplificada — CRUD completo continua em /impressoras)
  const [printers, setPrinters] = useState<PrinterRecord[]>([]);
  const [printersLoading, setPrintersLoading] = useState(true);
  const [showPrinterForm, setShowPrinterForm] = useState(false);
  const [printerForm, setPrinterForm] = useState({ name: "", connectionType: "BROWSER" as PrinterRecord["connectionType"], address: "" });

  // Totens (tablets fixos na mesa)
  const [totensSummary, setTotensSummary] = useState<{ total: number; online: number } | null>(null);

  useEffect(() => {
    setOs(detectOS());
    setToken(localStorage.getItem("token") ?? "");
  }, []);

  useEffect(() => {
    if (!user?.companyId) return;
    api
      .get<{ printingSettings?: PrintingSettings | null }>("/company/settings")
      .then((res) => {
        if (res.data.printingSettings) setSettings({ ...DEFAULT_SETTINGS, ...res.data.printingSettings });
      })
      .catch(() => toast.error("Erro ao carregar configurações de impressão"))
      .finally(() => setLoading(false));
  }, [user?.companyId]);

  const checkAgentStatus = useCallback(async () => {
    try {
      const res = await api.get<{ online: boolean }>("/printers/agent/status");
      setAgentOnline(!!res.data.online);
    } catch {
      setAgentOnline(false);
    } finally {
      setAgentLoading(false);
    }
  }, []);

  const loadPrinters = useCallback(async () => {
    try {
      const res = await api.get<PrinterRecord[]>("/printers");
      setPrinters(res.data);
    } catch {
      /* silencioso — widget de conveniência */
    } finally {
      setPrintersLoading(false);
    }
  }, []);

  const checkTotens = useCallback(async () => {
    try {
      const res = await api.get("/totem/status");
      setTotensSummary(res.data?.summary ?? null);
    } catch {
      /* silencioso */
    }
  }, []);

  useEffect(() => {
    checkAgentStatus();
    loadPrinters();
    checkTotens();
    const id = setInterval(() => { checkAgentStatus(); loadPrinters(); checkTotens(); }, 30_000);
    return () => clearInterval(id);
  }, [checkAgentStatus, loadPrinters, checkTotens]);

  const patch = useCallback(<K extends keyof PrintingSettings>(key: K, value: PrintingSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch("/company/settings", { printingSettings: settings });
      toast.success("Configurações de impressão salvas!");
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  function copyToken() {
    if (!token) return;
    navigator.clipboard.writeText(token).then(() => {
      setCopied(true);
      toast.success("Chave copiada!");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function createPrinter() {
    if (!printerForm.name.trim()) return toast.error("Informe o nome da impressora");
    try {
      await api.post("/printers", {
        name: printerForm.name.trim(),
        connectionType: printerForm.connectionType,
        address: printerForm.address.trim() || undefined,
        paperWidth: "MM_80",
      });
      toast.success("Impressora adicionada");
      setShowPrinterForm(false);
      setPrinterForm({ name: "", connectionType: "BROWSER", address: "" });
      loadPrinters();
    } catch {
      toast.error("Erro ao adicionar impressora");
    }
  }

  async function togglePrinterActive(p: PrinterRecord) {
    try {
      await api.patch(`/printers/${p.id}`, { isActive: !p.isActive });
      loadPrinters();
    } catch {
      toast.error("Erro ao atualizar");
    }
  }

  async function deletePrinter(id: string) {
    if (!confirm("Remover esta impressora?")) return;
    try {
      await api.delete(`/printers/${id}`);
      toast.success("Impressora removida");
      loadPrinters();
    } catch {
      toast.error("Erro ao remover");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="animate-spin text-orange-500" size={28} />
      </div>
    );
  }

  const primaryDownload = DOWNLOADS[os];

  return (
    <div className="flex flex-col xl:flex-row gap-6 max-w-5xl">
      {/* ── Coluna esquerda: Configurações ─────────────────────────────── */}
      <div className="flex-1 space-y-5 min-w-0">

        {/* Assistente de Impressão — status + toggles + download */}
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Wifi size={14} className="text-orange-500" />
                Assistente de Impressão
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Envia os pedidos direto para a impressora térmica, sem precisar de navegador aberto
              </p>
            </div>
            <AgentStatusPill online={agentOnline} loading={agentLoading} />
          </div>

          <div className="p-4 space-y-2">
            <SettingRow
              icon={<Printer size={14} />}
              label="Usar o Assistente para impressão"
              sublabel="Deixa o sistema enviar os pedidos direto para sua impressora"
              checked={settings.useAssistant}
              onChange={(v) => patch("useAssistant", v)}
            />
            <SettingRow
              icon={<Zap size={14} />}
              label="Impressão automática de pedidos"
              sublabel="Imprime cada novo pedido assim que ele entra, sem clicar"
              checked={settings.autoPrint}
              onChange={(v) => patch("autoPrint", v)}
              disabled={!settings.useAssistant}
            />
            <SettingRow
              icon={<CheckCircle2 size={14} />}
              label="Aceitar pedidos automaticamente"
              sublabel="Confirma os pedidos sozinho, ideal em horários de pico"
              checked={settings.autoAccept}
              onChange={(v) => patch("autoAccept", v)}
              disabled={!settings.useAssistant}
            />

            {!agentOnline && (
              <div className="rounded-xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 px-4 py-3.5 mt-2">
                <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 mb-2">
                  Assistente ainda não instalado neste computador
                </p>
                <a
                  href={`${RELEASE_BASE}/${primaryDownload.file}`}
                  download
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition"
                >
                  <Download size={14} />
                  Baixar para {primaryDownload.label}
                </a>
                <button
                  type="button"
                  onClick={() => setGuideOpen((v) => !v)}
                  className="ml-3 inline-flex items-center gap-1 text-xs font-semibold text-orange-700 dark:text-orange-400 hover:underline"
                >
                  Como instalar? <ChevronDown size={12} className={`transition-transform ${guideOpen ? "rotate-180" : ""}`} />
                </button>
              </div>
            )}

            {guideOpen && (
              <div className="space-y-3 pt-2">
                <div className="bg-gray-950 rounded-xl p-4 border border-gray-800">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Chave de ativação da loja</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[11px] text-green-400 font-mono break-all leading-relaxed">
                      {token ? `${token.slice(0, 40)}…` : "Faça login para ver a chave"}
                    </code>
                    <button
                      onClick={copyToken}
                      disabled={!token}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold transition active:scale-95 disabled:opacity-40"
                    >
                      {copied ? <CheckCheck size={12} /> : <Copy size={12} />}
                      {copied ? "Copiado!" : "Copiar"}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  1. Baixe e execute o programa — não precisa instalar.<br />
                  2. Na primeira vez, ele vai pedir a chave acima — cole e pressione ENTER.<br />
                  3. Pronto — deixe a janela aberta em segundo plano. O status acima fica verde quando conectado.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Impressoras cadastradas */}
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Printer size={14} className="text-orange-500" />
              Impressoras
            </h2>
            <button
              onClick={() => setShowPrinterForm((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition"
            >
              <Plus size={13} /> Nova Impressora
            </button>
          </div>

          <div className="p-4 space-y-3">
            {showPrinterForm && (
              <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 p-3 space-y-2">
                <input
                  className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 rounded-lg px-3 py-2 text-sm"
                  placeholder="Nome (ex: Impressora do Balcão)"
                  value={printerForm.name}
                  onChange={(e) => setPrinterForm((f) => ({ ...f, name: e.target.value }))}
                />
                <select
                  className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 rounded-lg px-3 py-2 text-sm"
                  value={printerForm.connectionType}
                  onChange={(e) => setPrinterForm((f) => ({ ...f, connectionType: e.target.value as PrinterRecord["connectionType"] }))}
                >
                  <option value="BROWSER">Navegador (padrão)</option>
                  <option value="NETWORK">Rede (IP:Porta)</option>
                  <option value="USB">USB (via Assistente)</option>
                </select>
                {printerForm.connectionType === "NETWORK" && (
                  <input
                    className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 rounded-lg px-3 py-2 text-sm font-mono"
                    placeholder="192.168.1.100:9100"
                    value={printerForm.address}
                    onChange={(e) => setPrinterForm((f) => ({ ...f, address: e.target.value }))}
                  />
                )}
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowPrinterForm(false)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700">Cancelar</button>
                  <button onClick={createPrinter} className="px-3 py-1.5 text-xs rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold">Adicionar</button>
                </div>
              </div>
            )}

            {printersLoading ? (
              <div className="flex items-center gap-2 text-gray-400 text-xs px-2 py-3">
                <RefreshCw size={12} className="animate-spin" /> Carregando...
              </div>
            ) : printers.length === 0 ? (
              <p className="text-xs text-gray-400 px-2 py-3">Nenhuma impressora cadastrada ainda.</p>
            ) : (
              <div className="space-y-1.5">
                {printers.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-gray-50/50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {p.isOnline ? <Wifi size={14} className="text-green-500 shrink-0" /> : <WifiOff size={14} className="text-gray-400 shrink-0" />}
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => togglePrinterActive(p)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${p.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                      >
                        {p.isActive ? "Ativa" : "Inativa"}
                      </button>
                      <button onClick={() => deletePrinter(p.id)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <a href="/impressoras" className="inline-block text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline pt-1">
              Configurações avançadas — perfis por setor, fila e histórico
            </a>
          </div>
        </section>

        {/* Regra do Cupom do Cliente por forma de pagamento */}
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Receipt size={14} className="text-orange-500" />
              Cupom do Cliente
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Escolha para quais formas de pagamento o comprovante do cliente é impresso automaticamente
            </p>
          </div>

          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => patch("printMode", "ALL")}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border-2 transition ${
                  settings.printMode === "ALL"
                    ? "border-orange-400 bg-orange-50 dark:bg-orange-950/30 text-orange-600"
                    : "border-gray-200 dark:border-gray-700 text-gray-500"
                }`}
              >
                Sempre imprimir
              </button>
              <button
                type="button"
                onClick={() => patch("printMode", "SELECTED")}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border-2 transition ${
                  settings.printMode === "SELECTED"
                    ? "border-orange-400 bg-orange-50 dark:bg-orange-950/30 text-orange-600"
                    : "border-gray-200 dark:border-gray-700 text-gray-500"
                }`}
              >
                Só formas selecionadas
              </button>
            </div>

            {settings.printMode === "SELECTED" && (
              <div className="space-y-1.5 pt-1">
                {PAYMENT_TYPE_OPTIONS.map((opt) => {
                  const active = settings.printPaymentTypes.includes(opt.value);
                  return (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition ${
                        active
                          ? "border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20"
                          : "border-gray-100 dark:border-gray-800"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...settings.printPaymentTypes, opt.value]
                            : settings.printPaymentTypes.filter((v) => v !== opt.value);
                          patch("printPaymentTypes", next);
                        }}
                        className="accent-orange-500"
                      />
                      {opt.value === "CASH" ? <Banknote size={13} className="text-gray-400" /> : <CreditCard size={13} className="text-gray-400" />}
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{opt.label}</span>
                    </label>
                  );
                })}
                <p className="text-[11px] text-gray-400 pt-1">
                  Ex: desmarque "Dinheiro" pra não gastar papel com pedidos pagos em espécie — a cozinha continua imprimindo normalmente.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Layout da Notinha */}
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <AlignLeft size={14} className="text-orange-500" />
              Layout da Notinha
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">O preview ao lado atualiza em tempo real</p>
          </div>

          <div className="p-4 space-y-2">
            <SettingRow icon={<FileText size={14} />} label="Mostrar CNPJ / Razão Social" sublabel="Imprime dados fiscais no cabeçalho" checked={settings.showCNPJ} onChange={(v) => patch("showCNPJ", v)} />
            <SettingRow icon={<Tag size={14} />} label="Mostrar Categoria" sublabel="Agrupa itens por seção (Pizzas, Bebidas…)" checked={settings.showCategory} onChange={(v) => patch("showCategory", v)} />
            <SettingRow icon={<AlignLeft size={14} />} label="Mostrar Descrição" sublabel="Exibe a descrição do produto na linha do item" checked={settings.showDescription} onChange={(v) => patch("showDescription", v)} />
            <SettingRow icon={<Layers size={14} />} label="Agrupar Adicionais" sublabel="Ex: '+ Bordas: Catupiry, Cheddar' (ativado) ou linha por linha (desativado)" checked={settings.addonGrouping} onChange={(v) => patch("addonGrouping", v)} />

            <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/30 px-4 py-3.5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                  <PizzaIcon size={14} className="text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Formato de Pizza</p>
                  <p className="text-xs text-gray-400">Como os sabores aparecem no cupom</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: "compact", label: "Compacto", desc: "Mussarela / Frango" },
                  { value: "perFlavor", label: "Por sabor", desc: "1/2 Mussarela\n1/2 Frango" },
                ] as const).map(({ value, label, desc }) => (
                  <button
                    key={value}
                    onClick={() => patch("pizzaItemFormat", value)}
                    className={`text-left px-3 py-2.5 rounded-lg border transition-colors ${
                      settings.pizzaItemFormat === value
                        ? "border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300"
                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                    }`}
                  >
                    <p className="text-xs font-semibold">{label}</p>
                    <p className="text-[10px] mt-0.5 whitespace-pre-line opacity-70">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Botão salvar */}
        <div className="flex justify-end pb-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-60 transition-colors"
          >
            {saving ? (<><Loader2 size={15} className="animate-spin" /> Salvando...</>) : (<><Save size={15} /> Salvar impressão</>)}
          </button>
        </div>

        {/* Totens conectados — discreto, no rodapé */}
        {totensSummary && totensSummary.total > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-400 pb-4">
            <Tablet size={13} />
            {totensSummary.online} de {totensSummary.total} totem(s) online
          </div>
        )}
      </div>

      {/* ── Coluna direita: Preview ─────────────────────────────────────── */}
      <div className="xl:w-[320px] flex-shrink-0">
        <div className="sticky top-6">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <Printer size={13} className="text-orange-500" />
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Preview — Cupom 80mm</span>
            </div>
            <div className="overflow-x-auto">
              <ReceiptPreview s={settings} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
