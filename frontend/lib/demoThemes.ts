/**
 * Demo company visual themes — applied globally across the entire ERP.
 * ClientShell injects these as CSS custom properties on document.documentElement
 * whenever companyId matches a DEMO_ID. Real companies are never affected.
 *
 * Variable contract
 * ─────────────────
 *  --color-primary      action colour (buttons, highlights, active nav)
 *  --app-bg             main page / outer background
 *  --app-surface        cards, panels, form wrappers
 *  --app-sidebar        left navigation background
 *  --app-sidebar-hover  nav item hover state
 *  --app-border-ui      sidebar / layout dividers
 *  --app-text-muted     secondary text
 *
 *  --pdv-bg             PDV main background  (= --app-bg for demo)
 *  --pdv-header-bg      PDV top bar
 *  --pdv-sidebar-bg     PDV category column  (= --app-sidebar for demo)
 *  --pdv-card           PDV product card bg  (= --app-surface for demo)
 *  --pdv-card-hover     PDV inactive category button
 *  --pdv-border         PDV subtle borders
 *  --pdv-text-muted     PDV secondary text
 */

export interface DemoTheme {
  name: string;
  primaryColor: string;
  cssVars: Record<string, string>;
}

export const DEMO_THEMES: Record<string, DemoTheme> = {
  // ── BASIC — Pizzaria Bella Napoli — unified green ─────────────────────────
  "demo-basic-001": {
    name: "Bella Napoli",
    primaryColor: "#16a34a",
    cssVars: {
      // global ERP
      "--app-bg":            "#065f46",
      "--app-surface":       "#065f46",
      "--app-sidebar":       "#065f46",
      "--app-sidebar-hover": "#047857",
      "--app-border-ui":     "#16a34a50",
      "--app-text-muted":    "#86efac",
      // PDV (mirrors global for full unity)
      "--pdv-bg":            "#065f46",
      "--pdv-header-bg":     "#065f46",
      "--pdv-sidebar-bg":    "#065f46",
      "--pdv-card":          "#065f46",
      "--pdv-card-hover":    "#047857",
      "--pdv-border":        "#16a34a50",
      "--pdv-text-muted":    "#86efac",
    },
  },

  // ── PRO — Pizzaria Don Corleone — unified navy blue ───────────────────────
  "demo-pro-001": {
    name: "Don Corleone",
    primaryColor: "#2563eb",
    cssVars: {
      "--app-bg":            "#1e3a5f",
      "--app-surface":       "#1e3a5f",
      "--app-sidebar":       "#1e3a5f",
      "--app-sidebar-hover": "#1e4080",
      "--app-border-ui":     "#2563eb50",
      "--app-text-muted":    "#93c5fd",
      "--pdv-bg":            "#1e3a5f",
      "--pdv-header-bg":     "#1e3a5f",
      "--pdv-sidebar-bg":    "#1e3a5f",
      "--pdv-card":          "#1e3a5f",
      "--pdv-card-hover":    "#1e4080",
      "--pdv-border":        "#2563eb50",
      "--pdv-text-muted":    "#93c5fd",
    },
  },

  // ── ENTERPRISE — Grupo Milano — pure black ────────────────────────────────
  "demo-enterprise-001": {
    name: "Milano",
    primaryColor: "#7c3aed",
    cssVars: {
      "--app-bg":            "#000000",
      "--app-surface":       "#000000",
      "--app-sidebar":       "#000000",
      "--app-sidebar-hover": "#0a0a0a",
      "--app-border-ui":     "#7c3aed50",
      "--app-text-muted":    "#a1a1aa",
      "--pdv-bg":            "#000000",
      "--pdv-header-bg":     "#000000",
      "--pdv-sidebar-bg":    "#000000",
      "--pdv-card":          "#000000",
      "--pdv-card-hover":    "#0a0a0a",
      "--pdv-border":        "#7c3aed50",
      "--pdv-text-muted":    "#a1a1aa",
    },
  },
};

export const DEMO_IDS = new Set(Object.keys(DEMO_THEMES));

const ALL_VARS = [
  "--color-primary",
  "--app-bg", "--app-surface", "--app-sidebar", "--app-sidebar-hover",
  "--app-border-ui", "--app-text-muted",
  "--pdv-bg", "--pdv-header-bg", "--pdv-sidebar-bg",
  "--pdv-card", "--pdv-card-hover", "--pdv-border", "--pdv-text-muted",
];

export function applyDemoTheme(companyId: string): void {
  const theme = DEMO_THEMES[companyId];
  if (!theme) return;
  const root = document.documentElement;
  root.style.setProperty("--color-primary", theme.primaryColor);
  for (const [key, value] of Object.entries(theme.cssVars)) {
    root.style.setProperty(key, value);
  }
  // Paint body so page backgrounds outside React tree also follow the theme
  document.body.style.backgroundColor = theme.cssVars["--app-bg"] ?? "";
  // Mark <html> so CSS selectors (html[data-demo]) can apply global overrides
  root.setAttribute("data-demo", "active");
}

export function clearDemoTheme(): void {
  const root = document.documentElement;
  ALL_VARS.forEach((v) => root.style.removeProperty(v));
  document.body.style.backgroundColor = "";
  root.removeAttribute("data-demo");
}
