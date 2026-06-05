/**
 * Demo company visual themes — sidebar only.
 * ClientShell injects these as CSS custom properties on document.documentElement
 * whenever companyId matches a DEMO_ID. Real companies are never affected.
 * Pages, cards, containers and body keep the system default colours.
 *
 * Sidebar variable contract
 * ─────────────────────────
 *  --color-primary         action colour (buttons, primary highlights)
 *  --app-sidebar           sidebar background  (darkest tone)
 *  --app-sidebar-hover     nav item hover bg   (slightly lighter)
 *  --app-sidebar-active    nav item active bg  (most prominent)
 *  --app-sidebar-text      nav item text colour
 *  --app-border-ui         sidebar dividers
 *
 * PDV variables (dark-mode PDV only, does not affect other pages)
 *  --pdv-bg / --pdv-header-bg / --pdv-sidebar-bg
 *  --pdv-card / --pdv-card-hover / --pdv-border / --pdv-text-muted
 */

export interface DemoTheme {
  name: string;
  primaryColor: string;
  cssVars: Record<string, string>;
}

export const DEMO_THEMES: Record<string, DemoTheme> = {
  // ── BASIC — Pizzaria Bella Napoli — green sidebar ─────────────────────────
  "demo-basic-001": {
    name: "Bella Napoli",
    primaryColor: "#16a34a",
    cssVars: {
      "--app-sidebar":        "#065f46",
      "--app-sidebar-hover":  "#047857",
      "--app-sidebar-active": "#10b981",
      "--app-sidebar-text":   "#ecfdf5",
      "--app-border-ui":      "rgba(22,163,74,0.30)",
      // PDV dark theme (self-contained, does not affect non-PDV pages)
      "--pdv-bg":             "#030712",
      "--pdv-header-bg":      "#050816",
      "--pdv-sidebar-bg":     "#050816",
      "--pdv-card":           "#0b0f1b",
      "--pdv-card-hover":     "#0c101d",
      "--pdv-border":         "rgba(22,163,74,0.25)",
      "--pdv-text-muted":     "#86efac",
    },
  },

  // ── PRO — Pizzaria Don Corleone — blue sidebar ────────────────────────────
  "demo-pro-001": {
    name: "Don Corleone",
    primaryColor: "#2563eb",
    cssVars: {
      "--app-sidebar":        "#1e3a5f",
      "--app-sidebar-hover":  "#2563eb",
      "--app-sidebar-active": "#3b82f6",
      "--app-sidebar-text":   "#eff6ff",
      "--app-border-ui":      "rgba(37,99,235,0.30)",
      // PDV dark theme
      "--pdv-bg":             "#030712",
      "--pdv-header-bg":      "#050816",
      "--pdv-sidebar-bg":     "#050816",
      "--pdv-card":           "#0b0f1b",
      "--pdv-card-hover":     "#0c101d",
      "--pdv-border":         "rgba(37,99,235,0.25)",
      "--pdv-text-muted":     "#93c5fd",
    },
  },

  // ── ENTERPRISE — Grupo Milano — black sidebar ─────────────────────────────
  "demo-enterprise-001": {
    name: "Milano",
    primaryColor: "#7c3aed",
    cssVars: {
      "--app-sidebar":        "#000000",
      "--app-sidebar-hover":  "#111111",
      "--app-sidebar-active": "#1f1f1f",
      "--app-sidebar-text":   "#f3f4f6",
      "--app-border-ui":      "rgba(124,58,237,0.30)",
      // PDV dark theme
      "--pdv-bg":             "#030712",
      "--pdv-header-bg":      "#050816",
      "--pdv-sidebar-bg":     "#050816",
      "--pdv-card":           "#0b0f1b",
      "--pdv-card-hover":     "#0c101d",
      "--pdv-border":         "rgba(124,58,237,0.25)",
      "--pdv-text-muted":     "#a1a1aa",
    },
  },
};

export const DEMO_IDS = new Set(Object.keys(DEMO_THEMES));

/**
 * Credenciais dos restaurantes de demonstração comercial.
 * Mantidas em sincronia com `backend/src/modules/super-admin/super-admin.service.ts`
 * (método `initDemoCompanies` / endpoint `/super-admin/demo/init`).
 *
 * Reutilize daqui em vez de hardcodar IDs/emails em páginas públicas.
 */
export interface DemoAccount {
  id: string;
  plan: "BASIC" | "PRO" | "ENTERPRISE";
  label: string;
  tagline: string;
  email: string;
  password: string;
  primaryColor: string;
  features: string[];
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: "demo-basic-001",
    plan: "BASIC",
    label: "FoodSaaS Basic",
    tagline: "Ideal para pizzarias e restaurantes pequenos.",
    email: "demo-basic@foodsaas.demo",
    password: "DemoBasic@123",
    primaryColor: "#16a34a",
    features: ["PDV", "Pedidos", "Cozinha", "Mesas", "Cardápio Online"],
  },
  {
    id: "demo-pro-001",
    plan: "PRO",
    label: "FoodSaaS Pro",
    tagline: "Ideal para operações em crescimento.",
    email: "demo-pro@foodsaas.demo",
    password: "DemoPro@123",
    primaryColor: "#2563eb",
    features: ["Tudo do Basic", "Cupons", "Relatórios", "Controle avançado", "Gestão ampliada"],
  },
  {
    id: "demo-enterprise-001",
    plan: "ENTERPRISE",
    label: "FoodSaaS Enterprise",
    tagline: "Solução premium para grandes operações.",
    email: "demo-enterprise@foodsaas.demo",
    password: "DemoEnterprise@123",
    primaryColor: "#7c3aed",
    features: ["Tudo do Pro", "Multiunidades", "Recursos avançados", "Dashboards completos", "Operação corporativa"],
  },
];

const ALL_VARS = [
  "--color-primary",
  "--app-sidebar", "--app-sidebar-hover", "--app-sidebar-active", "--app-sidebar-text",
  "--app-border-ui",
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
  // Mark <html> so CSS selectors (html[data-demo]) can apply sidebar-scoped overrides
  root.setAttribute("data-demo", "active");
}

export function clearDemoTheme(): void {
  const root = document.documentElement;
  ALL_VARS.forEach((v) => root.style.removeProperty(v));
  root.removeAttribute("data-demo");
}
