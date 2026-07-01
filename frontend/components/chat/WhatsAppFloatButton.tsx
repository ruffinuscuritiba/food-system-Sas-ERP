"use client";
import { useState, useEffect } from "react";

interface WhatsAppFloatButtonProps {
  phone?: string;
  companyName: string;
  /** Nome do atendente configurado pela loja em /whatsapp-ia (fallback "Atendente"). */
  assistantName?: string;
}

function WhatsAppIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M20.52 3.48A11.93 11.93 0 0012.06 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.14 1.6 5.94L0 24l6.32-1.65a11.86 11.86 0 005.72 1.46h.01c6.56 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.17-3.43-8.39zM12.06 21.6a9.7 9.7 0 01-4.94-1.35l-.35-.21-3.75.98 1-3.65-.23-.37a9.7 9.7 0 01-1.49-5.2c0-5.37 4.37-9.74 9.75-9.74 2.6 0 5.05 1.02 6.89 2.86a9.68 9.68 0 012.85 6.88c0 5.37-4.37 9.74-9.73 9.74zm5.34-7.3c-.29-.15-1.73-.85-2-.95-.27-.1-.46-.15-.66.15-.2.29-.75.95-.92 1.14-.17.2-.34.22-.63.07-.29-.15-1.22-.45-2.32-1.43-.86-.77-1.44-1.71-1.61-2-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.51.15-.17.2-.29.29-.48.1-.2.05-.37-.02-.51-.07-.15-.66-1.59-.9-2.18-.24-.57-.48-.5-.66-.51h-.56c-.2 0-.51.07-.78.37-.27.29-1.02 1-1.02 2.44s1.05 2.83 1.2 3.03c.15.2 2.06 3.14 4.99 4.4.7.3 1.24.48 1.67.62.7.22 1.34.19 1.84.12.56-.08 1.73-.71 1.97-1.39.24-.68.24-1.27.17-1.39-.07-.13-.26-.2-.55-.34z" />
    </svg>
  );
}

/** Botão flutuante que abre uma conversa real no WhatsApp em nova aba. */
export function WhatsAppFloatButton({ phone, companyName, assistantName = "Atendente" }: WhatsAppFloatButtonProps) {
  const [showGreeting, setShowGreeting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowGreeting(true), 2500);
    return () => clearTimeout(t);
  }, []);

  if (!phone) return null;

  const digits = phone.replace(/\D/g, "");
  const url = `https://wa.me/${digits}?text=${encodeURIComponent(
    `Oi! Vim pelo cardápio do ${companyName} e queria tirar uma dúvida.`
  )}`;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-end gap-3">
      {showGreeting && (
        <div className="hidden sm:flex items-center gap-2 bg-white rounded-2xl shadow-xl px-4 py-3 max-w-[220px]">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">{assistantName}</p>
            <p className="text-xs text-gray-500">Fala comigo no WhatsApp! 👋</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setShowGreeting(false); }}
            className="shrink-0 text-gray-300 hover:text-gray-500 text-xs"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-[#25D366] hover:bg-[#20BD5A] text-white w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-transform hover:scale-110"
        aria-label={`Falar com ${assistantName} no WhatsApp`}
      >
        <WhatsAppIcon className="w-7 h-7" />
      </a>
    </div>
  );
}
