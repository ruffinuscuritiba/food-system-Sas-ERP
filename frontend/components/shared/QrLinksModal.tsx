"use client";

import { useState, useRef, useCallback } from "react";
import { X, Copy, Check, Download, Link2, ExternalLink } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

interface Props {
  companyId: string;
  companyName?: string;
  isOpen: boolean;
  onClose: () => void;
}

const SOCIAL_LINKS = [
  {
    id: "instagram",
    label: "Instagram",
    source: "Instagram",
    emoji: "📸",
    borderColor: "#E1306C",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    source: "Whatsapp",
    emoji: "💬",
    borderColor: "#25D366",
  },
  {
    id: "facebook",
    label: "Facebook",
    source: "Facebook",
    emoji: "👥",
    borderColor: "#1877F2",
  },
  {
    id: "google",
    label: "Google",
    source: "Google",
    emoji: "🔍",
    borderColor: "#4285F4",
  },
];

export function QrLinksModal({ companyId, companyName, isOpen, onClose }: Props) {
  const [tab, setTab] = useState<"qr" | "links">("qr");
  const [copied, setCopied] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://foodsaas.app";
  const menuUrl = `${origin}/menu/${companyId}`;

  const getUtmUrl = (source: string) =>
    `${menuUrl}?utm_source=${encodeURIComponent(source)}&utm_medium=social&utm_campaign=cardapio`;

  const copyToClipboard = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    }
  }, []);

  const downloadQR = useCallback(() => {
    const canvas = document.getElementById("qr-canvas-el") as HTMLCanvasElement | null;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `qrcode-menu${companyName ? `-${companyName.toLowerCase().replace(/\s+/g, "-")}` : ""}.png`;
    a.click();
  }, [companyName]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center">
              <Link2 size={14} className="text-orange-500" />
            </div>
            <h2 className="font-bold text-gray-900 text-sm">QR Code e Links</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setTab("qr")}
            className={`flex-1 py-3 text-sm font-semibold transition border-b-2 ${
              tab === "qr"
                ? "text-orange-500 border-orange-500"
                : "text-gray-400 border-transparent hover:text-gray-600"
            }`}
          >
            QR Code
          </button>
          <button
            onClick={() => setTab("links")}
            className={`flex-1 py-3 text-sm font-semibold transition border-b-2 ${
              tab === "links"
                ? "text-orange-500 border-orange-500"
                : "text-gray-400 border-transparent hover:text-gray-600"
            }`}
          >
            Links
          </button>
        </div>

        {/* QR Code tab */}
        {tab === "qr" && (
          <div className="p-5 flex flex-col items-center gap-4">
            <div className="p-4 bg-white border-2 border-gray-100 rounded-2xl shadow-sm">
              <QRCodeCanvas
                id="qr-canvas-el"
                value={menuUrl}
                size={200}
                level="H"
                includeMargin={false}
              />
            </div>

            <div className="flex flex-col items-center gap-1 w-full">
              <p className="text-[11px] text-gray-400 text-center break-all leading-relaxed">
                {menuUrl}
              </p>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => copyToClipboard(menuUrl, "direct")}
                  className="flex items-center gap-1.5 text-xs text-orange-500 font-medium hover:underline"
                >
                  {copied === "direct" ? (
                    <><Check size={12} /> Copiado!</>
                  ) : (
                    <><Copy size={12} /> Copiar link</>
                  )}
                </button>
                <span className="text-gray-300">·</span>
                <a
                  href={menuUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600"
                >
                  <ExternalLink size={12} />
                  Abrir
                </a>
              </div>
            </div>

            <button
              onClick={downloadQR}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-orange-500 text-orange-500 font-semibold text-sm hover:bg-orange-50 transition"
            >
              <Download size={16} />
              Baixar QRCode
            </button>
          </div>
        )}

        {/* Links tab */}
        {tab === "links" && (
          <div className="p-5 flex flex-col gap-3 max-h-[420px] overflow-y-auto">
            <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
              <Link2 size={11} />
              Links com rastreamento por rede social (UTM)
            </p>

            {SOCIAL_LINKS.map((s) => {
              const url = getUtmUrl(s.source);
              const isCopied = copied === s.id;
              return (
                <div
                  key={s.id}
                  className="border border-gray-100 rounded-xl p-3.5 flex flex-col gap-2"
                  style={{ borderLeftWidth: 3, borderLeftColor: s.borderColor }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none">{s.emoji}</span>
                    <span className="font-semibold text-sm text-gray-800">{s.label}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 break-all leading-relaxed">
                    {url}
                  </p>
                  <button
                    onClick={() => copyToClipboard(url, s.id)}
                    className={`self-center px-5 py-1.5 rounded-lg border text-xs font-bold transition flex items-center gap-1.5 ${
                      isCopied
                        ? "border-green-500 text-green-600 bg-green-50"
                        : "border-orange-500 text-orange-500 hover:bg-orange-50"
                    }`}
                  >
                    {isCopied ? (
                      <><Check size={12} /> Copiado!</>
                    ) : (
                      <><Copy size={12} /> Copiar</>
                    )}
                  </button>
                </div>
              );
            })}

            {/* Personalizado */}
            <div className="border border-gray-100 rounded-xl p-3.5 flex flex-col gap-2 border-l-[3px] border-l-gray-400">
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">🔗</span>
                <span className="font-semibold text-sm text-gray-800">Personalizado</span>
              </div>
              <input
                type="text"
                placeholder="Nome para rastreio"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customName.trim())
                    copyToClipboard(getUtmUrl(customName.trim()), "custom");
                }}
                className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
              {customName.trim() && (
                <p className="text-[10px] text-gray-400 break-all">
                  {getUtmUrl(customName.trim())}
                </p>
              )}
              <button
                disabled={!customName.trim()}
                onClick={() =>
                  customName.trim() &&
                  copyToClipboard(getUtmUrl(customName.trim()), "custom")
                }
                className={`self-center px-5 py-1.5 rounded-lg border text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 ${
                  copied === "custom"
                    ? "border-green-500 text-green-600 bg-green-50"
                    : "border-orange-500 text-orange-500 hover:bg-orange-50"
                }`}
              >
                {copied === "custom" ? (
                  <><Check size={12} /> Copiado!</>
                ) : (
                  <><Copy size={12} /> Copiar</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 pb-4 pt-1">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
