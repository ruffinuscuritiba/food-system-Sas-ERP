"use client";
/**
 * CurrencyInputBR — máscara monetária pt-BR profissional.
 *
 * Comportamento:
 *   digitar 5700 → exibe "57,00"
 *   digitar 3490 → exibe "34,90"
 *
 * State interno sempre em centavos (inteiro).
 * onChange recebe o valor numérico puro (e.g. 34.90).
 */

import { useCallback, useRef, useState } from "react";

interface Props {
  value: number | string;          // valor em reais (34.90)
  onChange: (val: number) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  autoFocus?: boolean;
}

function reaisToCents(v: number | string): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CurrencyInputBR({
  value,
  onChange,
  placeholder = "0,00",
  disabled = false,
  className = "",
  id,
  autoFocus,
}: Props) {
  const [cents, setCents] = useState(() => reaisToCents(value));
  const ref = useRef<HTMLInputElement>(null);

  // Keep in sync when parent resets the value to 0 / different value
  const displayValue = cents === 0 ? "" : centsToBRL(cents);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        e.preventDefault();
        const next = Math.floor(cents / 10);
        setCents(next);
        onChange(next / 100);
      } else if (e.key === "Delete") {
        e.preventDefault();
        setCents(0);
        onChange(0);
      }
      // Allow Tab, Arrows, etc.
    },
    [cents, onChange]
  );

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Extract only digits from whatever was typed
      const raw = e.target.value.replace(/\D/g, "");
      if (!raw) { setCents(0); onChange(0); return; }

      // Treat digits as cents: "57" → 57 cents, "5700" → 5700 cents
      const next = Math.min(parseInt(raw, 10), 99_999_99); // max R$ 99.999,99
      setCents(next);
      onChange(next / 100);
    },
    [onChange]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text").replace(/\D/g, "");
      if (!text) return;
      const next = Math.min(parseInt(text, 10), 99_999_99);
      setCents(next);
      onChange(next / 100);
    },
    [onChange]
  );

  return (
    <input
      ref={ref}
      id={id}
      type="text"
      inputMode="numeric"
      autoFocus={autoFocus}
      disabled={disabled}
      value={displayValue}
      placeholder={placeholder}
      onChange={handleInput}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onFocus={(e) => {
        // Place caret at end
        const len = e.target.value.length;
        e.target.setSelectionRange(len, len);
      }}
      className={className}
    />
  );
}
