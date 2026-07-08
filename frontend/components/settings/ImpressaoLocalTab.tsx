"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api";
import {
  Download, Copy, CheckCheck, Wifi, WifiOff, Terminal,
  Monitor, Server, Printer, RefreshCw, ExternalLink, Tablet,
} from "lucide-react";
import toast from "react-hot-toast";

// ── OS Detection ──────────────────────────────────────────────────────────────

function detectOS(): "windows" | "linux" | "mac" {
  if (typeof navigator === "undefined") return "windows";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win"))   return "windows";
  if (ua.includes("mac"))   return "mac";
  return "linux";
}

// ── Download links (update to real GitHub Release URLs after pkg build) ────────
const DOWNLOADS = {
  windows: { label: "Windows (.exe)",    file: "FoodSaaS-Printer-Agent-win.exe",   icon: Monitor },
  linux:   { label: "Linux (x64)",       file: "FoodSaaS-Printer-Agent-linux",     icon: Terminal },
  mac:     { label: "macOS (universal)", file: "FoodSaaS-Printer-Agent-mac",       icon: Server },
};

// Troque pelo link real após rodar `npm run build:all` e publicar no GitHub Releases
const RELEASE_BASE = process.env.NEXT_PUBLIC_AGENT_RELEASE_URL ?? "#";

// ── Status pill ───────────────────────────────────────────────────────────────

function AgentStatusPill({ online, lastSeen, loading }: {
  online: boolean; lastSeen: string | null; loading: boolean;
}) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-500">
        <RefreshCw size={12} className="animate-spin" /> Verificando...
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
      online ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
    }`}>
      {online ? <Wifi size={12} /> : <WifiOff size={12} />}
      {online ? "Agente Online" : "Agente Offline"}
      {lastSeen && !online && (
        <span className="opacity-60 font-normal">
          · último ping {new Date(lastSeen).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ImpressaoLocalTab() {
  const [os, setOs] = useState<"windows" | "linux" | "mac">("windows");
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<{ online: boolean; lastSeen: string | null }>({
    online: false, lastSeen: null,
  });
  const [statusLoading, setStatusLoading] = useState(true);
  const [totens, setTotens] = useState<{ deviceId: string; tableNumber: string | null; online: boolean; lastSeen: string }[]>([]);
  const [totensSummary, setTotensSummary] = useState<{ total: number; online: number } | null>(null);
  const [totensLoading, setTotensLoading] = useState(true);

  const checkTotens = useCallback(async () => {
    try {
      const res = await api.get("/totem/status");
      setTotens(res.data?.items ?? []);
      setTotensSummary(res.data?.summary ?? null);
    } catch {
      // silencioso — widget de conveniência
    } finally {
      setTotensLoading(false);
    }
  }, []);

  useEffect(() => {
    checkTotens();
    const id = setInterval(checkTotens, 30_000);
    return () => clearInterval(id);
  }, [checkTotens]);

  useEffect(() => {
    setOs(detectOS());
    // Token = JWT do usuário (o agente usa este token para autenticar)
    const t = localStorage.getItem("token") ?? "";
    setToken(t);
  }, []);

  const checkStatus = useCallback(async () => {
    try {
      const res = await api.get<{ online: boolean; lastSeen: string | null }>(
        "/printers/agent/status"
      );
      setStatus(res.data);
    } catch {
      setStatus({ online: false, lastSeen: null });
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const id = setInterval(checkStatus, 30_000);
    return () => clearInterval(id);
  }, [checkStatus]);

  function copyToken() {
    if (!token) return;
    navigator.clipboard.writeText(token).then(() => {
      setCopied(true);
      toast.success("Token copiado!");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const primary   = DOWNLOADS[os];
  const secondary = Object.entries(DOWNLOADS).filter(([k]) => k !== os);

  return (
    <div className="max-w-2xl space-y-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Printer size={18} className="text-orange-500" />
            <h2 className="text-lg font-bold text-gray-900">Agente de Impressão Local</h2>
          </div>
          <p className="text-sm text-gray-500">
            Pequeno app que roda na máquina do restaurante e envia cupons diretamente para a impressora térmica, sem precisar de browser aberto.
          </p>
        </div>
        <AgentStatusPill
          online={status.online}
          lastSeen={status.lastSeen}
          loading={statusLoading}
        />
      </div>

      {/* ── Token box ── */}
      <div className="bg-gray-950 rounded-2xl p-5 border border-gray-800">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Chave de Ativação da Loja
        </p>
        <div className="flex items-center gap-3">
          <code className="flex-1 text-xs text-green-400 font-mono break-all leading-relaxed">
            {token ? `${token.slice(0, 48)}…` : "Faça login para ver o token"}
          </code>
          <button
            onClick={copyToken}
            disabled={!token}
            className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition active:scale-95 disabled:opacity-40"
          >
            {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
            {copied ? "Copiado!" : "Copiar"}
          </button>
        </div>
        <p className="mt-3 text-[11px] text-gray-500 leading-relaxed">
          Cole este token no arquivo <code className="text-gray-300">.env</code> do agente como{" "}
          <code className="text-orange-400">PRINTER_AUTH_TOKEN</code>. O token renova ao fazer login novamente.
        </p>
      </div>

      {/* ── Download buttons ── */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
          Download — Sistema detectado: <span className="text-orange-500 capitalize">{os}</span>
        </p>

        {/* Primary (OS match) */}
        <a
          href={`${RELEASE_BASE}/${primary.file}`}
          download
          className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white transition group mb-3"
        >
          <Download size={20} className="group-hover:translate-y-0.5 transition-transform" />
          <div className="flex-1">
            <p className="font-bold">{primary.label}</p>
            <p className="text-xs text-orange-200">Clique para baixar</p>
          </div>
          <ExternalLink size={14} className="opacity-60" />
        </a>

        {/* Secondary (other OS) */}
        <div className="flex flex-col sm:flex-row gap-2">
          {secondary.map(([key, dl]) => {
            const Icon = dl.icon;
            return (
              <a
                key={key}
                href={`${RELEASE_BASE}/${dl.file}`}
                download
                className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-500 transition text-sm"
              >
                <Icon size={15} />
                <span>{dl.label}</span>
              </a>
            );
          })}
        </div>
      </div>

      {/* ── 3-step guide ── */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">
          Guia Rápido — 3 Passos
        </p>
        <div className="space-y-3">
          {[
            {
              num: "1",
              title: "Baixar e extrair",
              body: "Baixe o executável acima e coloque em qualquer pasta. No Windows, não precisa instalar — só executar.",
              code: null,
            },
            {
              num: "2",
              title: "Criar arquivo .env com a chave",
              body: "Na mesma pasta do executável, crie um arquivo chamado .env com o conteúdo abaixo:",
              code: `PRINTER_AUTH_TOKEN=cole_o_token_aqui\nAPI_URL=${process.env.NEXT_PUBLIC_API_URL ?? "https://api.seudominio.com/api"}\nNETWORK_HOST=192.168.1.100   # IP da impressora TCP (ou deixe vazio para USB)`,
            },
            {
              num: "3",
              title: "Executar e deixar em segundo plano",
              body: "Dê dois cliques no .exe (Windows) ou execute no terminal. O agente ficará rodando e o status acima ficará Verde.",
              code: `# Linux / macOS — execute em background:\nnohup ./FoodSaaS-Printer-Agent-linux &`,
            },
          ].map((step) => (
            <div key={step.num} className="flex gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100">
              <div className="w-7 h-7 shrink-0 rounded-full bg-orange-100 text-orange-600 text-xs font-black flex items-center justify-center mt-0.5">
                {step.num}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm mb-1">{step.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed mb-2">{step.body}</p>
                {step.code && (
                  <pre className="text-[11px] bg-gray-900 text-green-300 rounded-xl px-4 py-3 overflow-x-auto leading-relaxed font-mono">
                    {step.code}
                  </pre>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Totens conectados (tablets fixos na mesa em ?totem=1) ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
            <Tablet size={13} /> Totens Conectados
          </p>
          {totensSummary && (
            <span className="text-xs text-gray-400">
              {totensSummary.online} online de {totensSummary.total}
            </span>
          )}
        </div>
        {totensLoading ? (
          <div className="flex items-center gap-2 text-gray-400 text-xs px-4 py-3">
            <RefreshCw size={12} className="animate-spin" /> Verificando...
          </div>
        ) : totens.length === 0 ? (
          <p className="text-xs text-gray-400 px-4 py-3 bg-gray-50 rounded-xl">
            Nenhum totem conectado ainda. Acesse o cardápio com <code className="text-gray-600">?totem=1&amp;table=X</code> em um tablet pra ele aparecer aqui.
          </p>
        ) : (
          <div className="space-y-1.5">
            {totens.map((t) => (
              <div key={t.deviceId} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-100 text-sm">
                <span className="font-medium text-gray-700">
                  {t.tableNumber ? `Mesa ${t.tableNumber}` : t.deviceId.slice(0, 8)}
                </span>
                <span className={`inline-flex items-center gap-1 text-xs font-semibold ${t.online ? "text-green-600" : "text-red-500"}`}>
                  {t.online ? <Wifi size={11} /> : <WifiOff size={11} />}
                  {t.online ? "Online" : `Offline · ${new Date(t.lastSeen).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Manual refresh ── */}
      <div className="flex justify-end">
        <button
          onClick={checkStatus}
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition"
        >
          <RefreshCw size={12} />
          Atualizar status agora
        </button>
      </div>
    </div>
  );
}
