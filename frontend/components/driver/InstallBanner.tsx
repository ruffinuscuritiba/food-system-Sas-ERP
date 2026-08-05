"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

const DISMISS_KEY = "driver_install_banner_dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Banner de instalação do app do entregador (PWA — manifest.json já
 * configurado, ver app/layout.tsx). Android: captura o evento nativo
 * beforeinstallprompt e oferece um botão "Instalar" que já dispara o
 * diálogo do Chrome — sem isso o navegador só mostra o prompt sozinho
 * às vezes (depende de heurística de engajamento). iOS Safari nunca
 * dispara esse evento — não tem instalação automatizável, só instrução
 * manual (Compartilhar → Adicionar à Tela de Início).
 */
export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    setDismissed(false);

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) {
      setShowIosHint(true);
      return;
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  }

  if (dismissed || (!deferredPrompt && !showIosHint)) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[60] bg-orange-500 text-white text-xs px-4 py-2.5 flex items-center gap-2 shadow-md">
      {showIosHint ? (
        <>
          <Share size={14} className="shrink-0" />
          <span className="flex-1">
            Instale este app: toque em <strong>Compartilhar</strong> e depois em{" "}
            <strong>Adicionar à Tela de Início</strong>.
          </span>
        </>
      ) : (
        <>
          <Download size={14} className="shrink-0" />
          <span className="flex-1">Instale o app do Entregador na tela inicial do seu celular.</span>
          <button
            onClick={install}
            className="shrink-0 bg-white text-orange-600 font-bold rounded-lg px-3 py-1"
          >
            Instalar
          </button>
        </>
      )}
      <button onClick={dismiss} className="shrink-0 text-white/80 hover:text-white">
        <X size={14} />
      </button>
    </div>
  );
}
