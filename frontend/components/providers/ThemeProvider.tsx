"use client";

/**
 * White Label Theme Engine — ThemeProvider global
 *
 * Carrega o tema da empresa autenticada (ou companyId vindo via prop p/ cardápio
 * público) e aplica variáveis CSS no `<html>` para que QUALQUER componente que
 * use `var(--color-primary)`, `var(--font-family)`, etc., herde automaticamente.
 *
 * Visual atual é preservado quando o backend retorna defaults (mesmas cores).
 */

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiBaseUrl } from "@/services/env";

export interface CompanyTheme {
  primaryColor:    string;
  secondaryColor:  string;
  accentColor:     string;
  backgroundColor: string;
  textColor:       string;
  logoUrl?:        string | null;
  bannerUrl?:      string | null;
  faviconUrl?:     string | null;
  fontFamily:      string;
  borderRadius:    number;
  pdvStyle:        "dark" | "light" | "neutral";
  darkMode:        boolean;
}

const DEFAULT_THEME: CompanyTheme = {
  primaryColor:    "#f97316",
  secondaryColor:  "#0f172a",
  accentColor:     "#f97316",
  backgroundColor: "#ffffff",
  textColor:       "#111827",
  logoUrl:         null,
  bannerUrl:       null,
  faviconUrl:      null,
  fontFamily:      "Inter",
  borderRadius:    16,
  pdvStyle:        "dark",
  darkMode:        false,
};

const ThemeContext = createContext<{
  theme: CompanyTheme;
  loading: boolean;
  reload: () => void;
}>({ theme: DEFAULT_THEME, loading: false, reload: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Aplica o tema às variáveis CSS do <html>. Componentes consomem via
 * `var(--color-primary)` no Tailwind ou inline-style.
 */
function applyTheme(t: CompanyTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement.style;
  root.setProperty("--color-primary",    t.primaryColor);
  root.setProperty("--color-secondary",  t.secondaryColor);
  root.setProperty("--color-accent",     t.accentColor);
  root.setProperty("--color-background", t.backgroundColor);
  root.setProperty("--color-text",       t.textColor);
  root.setProperty("--font-family",      `'${t.fontFamily}', system-ui, sans-serif`);
  root.setProperty("--radius",           `${t.borderRadius}px`);
  // Favicon dinâmico
  if (t.faviconUrl) {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = t.faviconUrl;
  }
  // dark mode hint para Tailwind (se a classe `dark` for usada)
  if (t.darkMode) document.documentElement.classList.add("dark");
  else document.documentElement.classList.remove("dark");
}

interface Props {
  children: ReactNode;
  /** companyId opcional — para cardápio digital público que não tem auth */
  companyId?: string;
}

export function ThemeProvider({ children, companyId }: Props) {
  const [theme, setTheme] = useState<CompanyTheme>(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      // companyId vem da prop (público) ou do user em localStorage (admin)
      let cid = companyId;
      if (!cid && typeof window !== "undefined") {
        try { cid = JSON.parse(localStorage.getItem("user") || "{}").companyId; }
        catch { /* ignore */ }
      }
      if (!cid) { applyTheme(DEFAULT_THEME); setLoading(false); return; }

      const res = await fetch(`${apiBaseUrl}/themes/${cid}`);
      if (!res.ok) { applyTheme(DEFAULT_THEME); return; }
      const data = await res.json();
      const merged: CompanyTheme = {
        ...DEFAULT_THEME,
        ...data,
        // Coerce nullable numbers/strings
        borderRadius: Number(data.borderRadius ?? DEFAULT_THEME.borderRadius),
        pdvStyle:     (data.pdvStyle as CompanyTheme["pdvStyle"]) ?? "dark",
      };
      setTheme(merged);
      applyTheme(merged);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [companyId]);

  return (
    <ThemeContext.Provider value={{ theme, loading, reload: load }}>
      {children}
    </ThemeContext.Provider>
  );
}
