"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Save, Loader2, Printer, Zap, CheckCircle2,
  AlignLeft, Tag, FileText, Layers, Pizza as PizzaIcon,
  Wifi, AlertCircle,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import toast from "react-hot-toast";

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
};

// ── Toggle reutilizável ───────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
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
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// ── Linha de configuração ─────────────────────────────────────────────────────

function SettingRow({
  icon,
  label,
  sublabel,
  checked,
  onChange,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-colors ${
      disabled
        ? "border-gray-100 dark:border-gray-800 opacity-40"
        : checked
          ? "border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20"
          : "border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/30"
    }`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
        checked && !disabled
          ? "bg-orange-100 dark:bg-orange-900/40 text-orange-600"
          : "bg-gray-100 dark:bg-gray-800 text-gray-400"
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

// ── Preview da bobina (cupom 80mm simulado) ───────────────────────────────────

function ReceiptPreview({ s }: { s: PrintingSettings }) {
  return (
    <div className="flex flex-col items-center select-none">
      {/* Rolo de papel — topo */}
      <div className="relative w-[260px]">
        <div className="h-4 bg-gradient-to-b from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-t-full border border-b-0 border-gray-300 dark:border-gray-600" />
        {/* Furo */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600 border border-gray-400 dark:border-gray-500" />
      </div>

      {/* Papel */}
      <div className="w-[260px] bg-white dark:bg-gray-50 shadow-2xl border-x border-gray-200 dark:border-gray-300 px-4 pb-0 text-gray-900 font-mono text-[10.5px] leading-relaxed">
        {/* Cabeçalho */}
        <div className="text-center border-b border-dashed border-gray-300 pb-2 pt-3 mb-2">
          <div className="font-bold text-[13px] tracking-wide">BELLA NAPOLI</div>
          {s.showCNPJ && (
            <div className="text-[9px] text-gray-500 mt-0.5">
              CNPJ: 12.345.678/0001-90
              <br />
              <span className="text-[9px]">Bella Napoli Ltda.</span>
            </div>
          )}
          <div className="text-[9px] text-gray-400 mt-0.5">
            Rua das Flores, 123 — Centro
          </div>
        </div>

        {/* Dados do pedido */}
        <div className="border-b border-dashed border-gray-300 pb-2 mb-2 text-[9.5px]">
          <div className="flex justify-between font-semibold">
            <span>PEDIDO #42</span>
            <span>DELIVERY</span>
          </div>
          <div className="text-gray-500">14/06/2026  19:32</div>
          <div className="text-gray-500 mt-0.5">Cliente: João da Silva</div>
          <div className="text-gray-500">Rua Ipê, 80 — Batel</div>
        </div>

        {/* Itens */}
        <div className="border-b border-dashed border-gray-300 pb-2 mb-2 space-y-2">
          {/* Categoria: Pizzas */}
          {s.showCategory && (
            <div className="text-[9px] text-center text-gray-400 tracking-widest">
              ─── PIZZAS ───
            </div>
          )}

          {/* Pizza */}
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
              <div className="ml-2 text-[9px] text-gray-500">
                Mussarela / Frango c/ Catupiry
              </div>
            )}
            {s.showDescription && (
              <div className="ml-2 text-[9px] text-gray-400 italic">
                Borda recheada, molho especial, 8 fatias
              </div>
            )}
            {/* Add-ons */}
            {s.addonGrouping ? (
              <div className="ml-2 text-[9px] text-gray-500">
                + Bordas: Catupiry, Cheddar (R$9,90)
              </div>
            ) : (
              <div className="ml-2 text-[9px] text-gray-500 space-y-0">
                <div>+ Borda Catupiry.........R$4,90</div>
                <div>+ Borda Cheddar.........R$5,00</div>
              </div>
            )}
          </div>

          {/* Categoria: Bebidas */}
          {s.showCategory && (
            <div className="text-[9px] text-center text-gray-400 tracking-widest">
              ─── BEBIDAS ───
            </div>
          )}

          <div>
            <div className="flex justify-between text-[10px] font-medium">
              <span>2x Coca-Cola 2L</span>
              <span>R$18,00</span>
            </div>
            {s.showDescription && (
              <div className="ml-2 text-[9px] text-gray-400 italic">
                Gelada, garrafa PET
              </div>
            )}
          </div>
        </div>

        {/* Totais */}
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
          <div className="text-center text-gray-500 text-[9px] mt-1">
            PAGAMENTO: PIX ✓ CONFIRMADO
          </div>
        </div>

        {/* Rodapé */}
        <div className="text-center text-[9px] text-gray-400 border-t border-dashed border-gray-300 pt-2 pb-3">
          Obrigado pela preferência!
          <br />
          <span className="text-[11px]">★★★★★</span>
          <br />
          foodsaas.com.br
        </div>
      </div>

      {/* Linha de corte */}
      <div className="w-[260px] flex items-center gap-0">
        <div className="flex-1 border-t-2 border-dashed border-gray-300 dark:border-gray-600" />
        <span className="text-xs text-gray-300 dark:text-gray-600 px-1 select-none">✂</span>
        <div className="flex-1 border-t-2 border-dashed border-gray-300 dark:border-gray-600" />
      </div>

      {/* Rebobinado */}
      <div className="w-[260px] h-3 bg-gradient-to-t from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-b-sm border border-t-0 border-gray-300 dark:border-gray-600" />

      <p className="text-[10px] text-gray-400 mt-3 text-center">
        Preview dinâmico — reage aos toggles ao lado
      </p>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function ImpressaoTab() {
  const { user } = useAuthStore();
  const [settings, setSettings] = useState<PrintingSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    if (!user?.companyId) return;
    api
      .get<{ printingSettings?: PrintingSettings | null }>("/company/settings")
      .then((res) => {
        if (res.data.printingSettings) {
          setSettings({ ...DEFAULT_SETTINGS, ...res.data.printingSettings });
        }
      })
      .catch(() => toast.error("Erro ao carregar configurações de impressão"))
      .finally(() => setLoading(false));
  }, [user?.companyId]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="animate-spin text-orange-500" size={28} />
      </div>
    );
  }

  return (
    <div className="flex flex-col xl:flex-row gap-6 max-w-5xl">
      {/* ── Coluna esquerda: Configurações ─────────────────────────────── */}
      <div className="flex-1 space-y-5 min-w-0">
        {/* Assistente de Impressão */}
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Wifi size={14} className="text-orange-500" />
              Assistente de Impressão
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              FoodSaaS Printer Agent — impressora na rede local
            </p>
          </div>

          <div className="p-4 space-y-2">
            <SettingRow
              icon={<Printer size={14} />}
              label="Ativar Assistente"
              sublabel="Conecta o sistema à impressora local via rede"
              checked={settings.useAssistant}
              onChange={(v) => patch("useAssistant", v)}
            />
            <SettingRow
              icon={<Zap size={14} />}
              label="Impressão Automática"
              sublabel="Imprime ao receber novo pedido"
              checked={settings.autoPrint}
              onChange={(v) => patch("autoPrint", v)}
              disabled={!settings.useAssistant}
            />
            <SettingRow
              icon={<CheckCircle2 size={14} />}
              label="Aceite Automático"
              sublabel="Confirma o pedido automaticamente ao imprimir"
              checked={settings.autoAccept}
              onChange={(v) => patch("autoAccept", v)}
              disabled={!settings.useAssistant}
            />

            {!settings.useAssistant && (
              <div className="flex items-start gap-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 px-3 py-2.5 mt-1">
                <AlertCircle size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-gray-400">
                  Ative o assistente para configurar impressão e aceite automáticos.
                  Impressoras cadastradas em{" "}
                  <a
                    href="/configuracoes?tab=impressao"
                    className="underline hover:text-gray-600 dark:hover:text-gray-300"
                    onClick={(e) => {
                      // Já estamos na aba — não navegar, só scroll
                      e.preventDefault();
                    }}
                  >
                    Gerenciar Impressoras
                  </a>
                  .
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
            <p className="text-xs text-gray-500 mt-0.5">
              O preview ao lado atualiza em tempo real
            </p>
          </div>

          <div className="p-4 space-y-2">
            <SettingRow
              icon={<FileText size={14} />}
              label="Mostrar CNPJ / Razão Social"
              sublabel="Imprime dados fiscais no cabeçalho"
              checked={settings.showCNPJ}
              onChange={(v) => patch("showCNPJ", v)}
            />
            <SettingRow
              icon={<Tag size={14} />}
              label="Mostrar Categoria"
              sublabel="Agrupa itens por seção (Pizzas, Bebidas…)"
              checked={settings.showCategory}
              onChange={(v) => patch("showCategory", v)}
            />
            <SettingRow
              icon={<AlignLeft size={14} />}
              label="Mostrar Descrição"
              sublabel="Exibe a descrição do produto na linha do item"
              checked={settings.showDescription}
              onChange={(v) => patch("showDescription", v)}
            />
            <SettingRow
              icon={<Layers size={14} />}
              label="Agrupar Adicionais"
              sublabel="Ex: '+ Bordas: Catupiry, Cheddar' (ativado) ou linha por linha (desativado)"
              checked={settings.addonGrouping}
              onChange={(v) => patch("addonGrouping", v)}
            />

            {/* Formato pizza — select visual */}
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
                {(
                  [
                    {
                      value: "compact",
                      label: "Compacto",
                      desc: "Mussarela / Frango",
                    },
                    {
                      value: "perFlavor",
                      label: "Por sabor",
                      desc: "1/2 Mussarela\n1/2 Frango",
                    },
                  ] as const
                ).map(({ value, label, desc }) => (
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
        <div className="flex justify-end pb-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-60 transition-colors"
          >
            {saving ? (
              <><Loader2 size={15} className="animate-spin" /> Salvando...</>
            ) : (
              <><Save size={15} /> Salvar impressão</>
            )}
          </button>
        </div>
      </div>

      {/* ── Coluna direita: Preview ─────────────────────────────────────── */}
      <div className="xl:w-[320px] flex-shrink-0">
        <div className="sticky top-6">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <Printer size={13} className="text-orange-500" />
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                Preview — Cupom 80mm
              </span>
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
