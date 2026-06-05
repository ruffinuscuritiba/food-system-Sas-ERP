/**
 * Demo company visual themes.
 * Applied by ClientShell when companyId matches a demo ID.
 * All values are CSS custom properties injected on document.documentElement.
 */

export interface DemoTheme {
  /** Human-readable label */
  name: string;
  /** Sets --color-primary — drives buttons, active states, accents */
  primaryColor: string;
  /** Additional CSS variables for PDV and layout */
  cssVars: {
    "--pdv-bg": string;
    "--pdv-header-bg": string;
    "--pdv-sidebar-bg": string;
    "--pdv-card": string;
    "--pdv-card-hover": string;
    "--pdv-border": string;
    "--pdv-text-muted": string;
  };
}

export const DEMO_THEMES: Record<string, DemoTheme> = {
  /** BASIC — Pizzaria Bella Napoli — green / simple / friendly */
  "demo-basic-001": {
    name: "Bella Napoli",
    primaryColor: "#16a34a",
    cssVars: {
      "--pdv-bg":          "#022c22",
      "--pdv-header-bg":   "#022c22",
      "--pdv-sidebar-bg":  "#052e16",
      "--pdv-card":        "#064e3b",
      "--pdv-card-hover":  "#065f46",
      "--pdv-border":      "#166534",
      "--pdv-text-muted":  "#86efac",
    },
  },

  /** PRO — Pizzaria Don Corleone — navy / clean / premium */
  "demo-pro-001": {
    name: "Don Corleone",
    primaryColor: "#2563eb",
    cssVars: {
      "--pdv-bg":          "#0f172a",
      "--pdv-header-bg":   "#0f172a",
      "--pdv-sidebar-bg":  "#1e293b",
      "--pdv-card":        "#1e293b",
      "--pdv-card-hover":  "#263548",
      "--pdv-border":      "#334155",
      "--pdv-text-muted":  "#94a3b8",
    },
  },

  /** ENTERPRISE — Grupo Milano — black / electric / corporate */
  "demo-enterprise-001": {
    name: "Milano",
    primaryColor: "#7c3aed",
    cssVars: {
      "--pdv-bg":          "#000000",
      "--pdv-header-bg":   "#050505",
      "--pdv-sidebar-bg":  "#060606",
      "--pdv-card":        "#0a0a0a",
      "--pdv-card-hover":  "#111111",
      "--pdv-border":      "#1c1c1c",
      "--pdv-text-muted":  "#a1a1aa",
    },
  },
};

/** IDs that are demo companies — use to gate theme injection */
export const DEMO_IDS = new Set(Object.keys(DEMO_THEMES));

/** Apply a DemoTheme's CSS variables to document root. */
export function applyDemoTheme(companyId: string): void {
  const theme = DEMO_THEMES[companyId];
  if (!theme) return;
  const root = document.documentElement;
  root.style.setProperty("--color-primary", theme.primaryColor);
  for (const [key, value] of Object.entries(theme.cssVars)) {
    root.style.setProperty(key, value);
  }
}

/** Clear demo-specific CSS variables (called on logout / impersonation exit). */
export function clearDemoTheme(): void {
  const vars = [
    "--color-primary",
    "--pdv-bg", "--pdv-header-bg", "--pdv-sidebar-bg",
    "--pdv-card", "--pdv-card-hover", "--pdv-border", "--pdv-text-muted",
  ];
  const root = document.documentElement;
  vars.forEach((v) => root.style.removeProperty(v));
}
