"use client";

import { useEffect, useState } from "react";
import {
  FileCheck2, ShieldAlert, KeyRound, Upload, CheckCircle2,
  Loader2, AlertTriangle, ToggleLeft, ToggleRight, ExternalLink,
} from "lucide-react";
import { api } from "@/services/api";
import toast from "react-hot-toast";

interface FiscalConfig {
  provider: string;
  environment: string;
  hasApiKey: boolean;
  apiKeyLast4: string | null;
  hasCert: boolean;
  isActive: boolean;
  termsAcceptedAt: string | null;
}

export default function FiscalTab() {
  const [config, setConfig] = useState<FiscalConfig | null>(null);
  const [termsText, setTermsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);

  const [environment, setEnvironment] = useState("HOMOLOGACAO");
  const [apiKey, setApiKey] = useState("");
  const [certPassword, setCertPassword] = useState("");
  const [certFileBase64, setCertFileBase64] = useState<string | null>(null);
  const [certFileName, setCertFileName] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [configRes, termsRes] = await Promise.all([
        api.get("/fiscal/config"),
        api.get("/fiscal/terms"),
      ]);
      setConfig(configRes.data);
      setEnvironment(configRes.data?.environment ?? "HOMOLOGACAO");
      setTermsText(termsRes.data?.text ?? "");
    } catch {
      toast.error("Erro ao carregar configuração fiscal");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function acceptTerms() {
    if (!termsChecked) return;
    setSaving(true);
    try {
      await api.post("/fiscal/accept-terms");
      toast.success("Termos aceitos. Agora cadastre a credencial do provedor.");
      setShowTermsModal(false);
      await load();
    } catch {
      toast.error("Erro ao registrar aceite dos termos");
    } finally {
      setSaving(false);
    }
  }

  function handleCertFile(file: File | null) {
    if (!file) { setCertFileBase64(null); setCertFileName(null); return; }
    const reader = new FileReader();
    reader.onload = () => setCertFileBase64(reader.result as string);
    reader.readAsDataURL(file);
    setCertFileName(file.name);
  }

  async function saveCredentials() {
    setSaving(true);
    try {
      await api.put("/fiscal/config", {
        provider: "FOCUS_NFE",
        environment,
        ...(apiKey ? { apiKey } : {}),
        ...(certFileBase64 ? { certFileBase64 } : {}),
        ...(certPassword ? { certPassword } : {}),
      });
      toast.success("Credenciais salvas com sucesso!");
      setApiKey(""); setCertPassword(""); setCertFileBase64(null); setCertFileName(null);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Erro ao salvar credenciais");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!config) return;
    setSaving(true);
    try {
      await api.post("/fiscal/active", { isActive: !config.isActive });
      toast.success(!config.isActive ? "Módulo Fiscal ativado" : "Módulo Fiscal desativado");
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Erro ao alterar status");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-orange-500" size={28} />
      </div>
    );
  }

  const termsAccepted = !!config?.termsAcceptedAt;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Explicação do modelo BYOK */}
      <div className="rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/20 p-5">
        <div className="flex items-start gap-3">
          <FileCheck2 size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
              Módulo Fiscal — integração com provedor de terceiros (NFC-e/NF-e)
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
              Você cadastra a credencial do seu próprio emissor fiscal (ex: Focus NFe). A plataforma
              apenas encaminha os dados — não emite, assina nem se responsabiliza pela nota fiscal.
              Toda configuração de impostos (CFOP/ICMS/NCM) é feita no painel do seu provedor.
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-500 mt-2">
              Dúvida sobre qual imposto/CFOP usar? Consulte seu contador — o sistema permite
              configurar o código que ele indicar, mas não realiza consultoria fiscal.
            </p>
          </div>
        </div>
      </div>

      {/* Status do aceite */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className={termsAccepted ? "text-green-500" : "text-amber-500"} />
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Termo de uso — integração de terceiros
            </span>
          </div>
          {termsAccepted ? (
            <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle2 size={13} /> Aceito em {new Date(config!.termsAcceptedAt!).toLocaleString("pt-BR")}
            </span>
          ) : (
            <button
              onClick={() => setShowTermsModal(true)}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition"
            >
              Ler e aceitar termos
            </button>
          )}
        </div>
      </div>

      {/* Credenciais — só habilitado após aceite */}
      <div className={`rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4 ${!termsAccepted ? "opacity-50 pointer-events-none" : ""}`}>
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Credenciamento do provedor</p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Provedor</label>
            <select
              value="FOCUS_NFE"
              disabled
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
            >
              <option value="FOCUS_NFE">Focus NFe</option>
            </select>
            <p className="text-[11px] text-gray-400 mt-1">eNotas e PlugNotas — em breve</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Ambiente</label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="HOMOLOGACAO">Homologação (testes)</option>
              <option value="PRODUCAO">Produção</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 flex items-center gap-1.5">
            <KeyRound size={12} /> API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={config?.hasApiKey ? `•••• configurada (final ${config.apiKeyLast4})` : "Cole aqui o token da Focus NFe"}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 flex items-center gap-1.5">
              <Upload size={12} /> Certificado digital (.pfx / .p12)
            </label>
            <input
              type="file"
              accept=".pfx,.p12"
              onChange={(e) => handleCertFile(e.target.files?.[0] ?? null)}
              className="w-full text-xs text-gray-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-600 hover:file:bg-orange-100"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              {certFileName ? `Selecionado: ${certFileName}` : config?.hasCert ? "Certificado já cadastrado" : "Nenhum certificado enviado"}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Senha do certificado</label>
            <input
              type="password"
              value={certPassword}
              onChange={(e) => setCertPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        <button
          onClick={saveCredentials}
          disabled={saving || !termsAccepted}
          className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold transition"
        >
          {saving ? "Salvando..." : "Salvar credenciais"}
        </button>
      </div>

      {/* Ativação */}
      <div className={`rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 flex items-center justify-between ${!termsAccepted ? "opacity-50 pointer-events-none" : ""}`}>
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Módulo Fiscal ativo</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {config?.isActive ? "Ativo — emissão disponível via API Key configurada" : "Inativo — cadastre a API Key para ativar"}
          </p>
        </div>
        <button onClick={toggleActive} disabled={saving || !config?.hasApiKey} className="disabled:opacity-40">
          {config?.isActive ? (
            <ToggleRight size={32} className="text-green-500" />
          ) : (
            <ToggleLeft size={32} className="text-gray-300 dark:text-gray-600" />
          )}
        </button>
      </div>

      {/* Modal de termos */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" /> Termo de Uso — Módulo Fiscal
              </h2>
            </div>
            <div className="px-6 py-4 overflow-y-auto text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {termsText}
              <a
                href="https://focusnfe.com.br"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-orange-500 hover:underline text-xs mt-4"
              >
                Conhecer a Focus NFe <ExternalLink size={12} />
              </a>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
              <label className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsChecked}
                  onChange={(e) => setTermsChecked(e.target.checked)}
                  className="mt-0.5"
                />
                Ao salvar, confirmo que possuo Certificado Digital válido e estou ciente que a
                FoodSaaS apenas intermedia o envio dos dados, sendo de minha inteira
                responsabilidade a tributação e a conformidade fiscal.
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowTermsModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  onClick={acceptTerms}
                  disabled={!termsChecked || saving}
                  className="flex-1 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold transition"
                >
                  {saving ? "Salvando..." : "Confirmar Aceite"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
