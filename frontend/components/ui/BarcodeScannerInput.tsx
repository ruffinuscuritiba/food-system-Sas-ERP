"use client";
/**
 * BarcodeScannerInput — suporte a leitores USB/pistola/teclado.
 *
 * Leitores de código de barras simulam digitação rápida + Enter.
 * Este componente captura sequências rápidas (< 80ms entre teclas) + Enter
 * e as interpreta como leituras de scanner.
 *
 * Props:
 *   onScan(code)  → chamado com o código lido (string pura)
 *   autoFocus     → manter foco automático (ideal no PDV)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Scan, X, CheckCircle, AlertTriangle } from "lucide-react";

interface Props {
  onScan: (code: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Feedback externo: "success" | "error" | null */
  feedback?: "success" | "error" | null;
  feedbackMessage?: string;
}

const SCANNER_MAX_DELAY = 80; // ms — leitores digitam mais rápido que humanos

export function BarcodeScannerInput({
  onScan,
  autoFocus = true,
  placeholder = "Bipe o código ou digite e pressione Enter",
  disabled = false,
  className = "",
  feedback,
  feedbackMessage,
}: Props) {
  const [value, setValue] = useState("");
  const [isScanner, setIsScanner] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastKeyTime = useRef<number>(0);
  const scanBuffer = useRef<string>("");

  // Keep focus when autoFocus is on
  useEffect(() => {
    if (!autoFocus) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const refocus = () => { if (document.activeElement !== el) el.focus(); };
    const id = setInterval(refocus, 500);
    return () => clearInterval(id);
  }, [autoFocus]);

  const handleSubmit = useCallback(
    (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;
      onScan(trimmed);
      setValue("");
      scanBuffer.current = "";
    },
    [onScan]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const now = Date.now();
      const elapsed = now - lastKeyTime.current;
      lastKeyTime.current = now;

      // Detect scanner speed
      if (elapsed < SCANNER_MAX_DELAY && value.length > 0) {
        setIsScanner(true);
      } else if (elapsed > 200) {
        setIsScanner(false);
      }

      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit(value);
      }
      if (e.key === "Escape") {
        setValue("");
        scanBuffer.current = "";
        setIsScanner(false);
      }
    },
    [value, handleSubmit]
  );

  const borderColor = feedback === "success"
    ? "border-green-400 ring-2 ring-green-100"
    : feedback === "error"
    ? "border-red-400 ring-2 ring-red-100"
    : "border-gray-200 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100";

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className={`flex items-center gap-2 border rounded-xl px-3 py-2.5 bg-white transition-all ${borderColor}`}>
        {/* Scanner icon — pulses when scanner is active */}
        <Scan
          size={18}
          className={`shrink-0 transition-colors ${
            isScanner ? "text-green-500 animate-pulse" : "text-gray-400"
          }`}
        />

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400 font-mono"
        />

        {value && (
          <button
            type="button"
            onClick={() => { setValue(""); inputRef.current?.focus(); }}
            className="shrink-0 text-gray-300 hover:text-gray-500 transition"
          >
            <X size={14} />
          </button>
        )}

        {feedback === "success" && <CheckCircle size={16} className="text-green-500 shrink-0" />}
        {feedback === "error" && <AlertTriangle size={16} className="text-red-400 shrink-0" />}
      </div>

      {feedbackMessage && (
        <p className={`text-xs font-medium px-1 ${
          feedback === "success" ? "text-green-600" : "text-red-500"
        }`}>
          {feedbackMessage}
        </p>
      )}
    </div>
  );
}
