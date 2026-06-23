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
      "--app-sidebar":        "#020d07",
      "--app-sidebar-hover":  "#051609",
      "--app-sidebar-active": "#10b981",
      "--app-sidebar-text":   "#ecfdf5",
      "--app-border-ui":      "rgba(22,163,74,0.22)",
      // PDV dark theme — green-tinted dark environment
      "--pdv-bg":             "#020d07",
      "--pdv-header-bg":      "#031008",
      "--pdv-sidebar-bg":     "#020d07",
      "--pdv-card":           "#051609",
      "--pdv-card-hover":     "#071c0c",
      "--pdv-border":         "rgba(22,163,74,0.22)",
      "--pdv-text-muted":     "#86efac",
    },
  },

  // ── PRO — Pizzaria Don Corleone — blue sidebar ────────────────────────────
  "demo-pro-001": {
    name: "Don Corleone",
    primaryColor: "#2563eb",
    cssVars: {
      "--app-sidebar":        "#020614",
      "--app-sidebar-hover":  "#050d22",
      "--app-sidebar-active": "#3b82f6",
      "--app-sidebar-text":   "#eff6ff",
      "--app-border-ui":      "rgba(37,99,235,0.22)",
      // PDV dark theme — blue-tinted dark environment
      "--pdv-bg":             "#020614",
      "--pdv-header-bg":      "#030a1c",
      "--pdv-sidebar-bg":     "#020614",
      "--pdv-card":           "#050d22",
      "--pdv-card-hover":     "#07112b",
      "--pdv-border":         "rgba(37,99,235,0.22)",
      "--pdv-text-muted":     "#93c5fd",
    },
  },

  // ── ENTERPRISE — Grupo Milano — black sidebar ─────────────────────────────
  "demo-enterprise-001": {
    name: "Milano",
    primaryColor: "#7c3aed",
    cssVars: {
      "--app-sidebar":        "#030712",
      "--app-sidebar-hover":  "#070d18",
      "--app-sidebar-active": "#7c3aed",
      "--app-sidebar-text":   "#f3f4f6",
      "--app-border-ui":      "rgba(124,58,237,0.22)",
      // PDV dark theme — neutral bg, plan-coloured accents (borders/highlights)
      "--pdv-bg":             "#030712",
      "--pdv-header-bg":      "#050a14",
      "--pdv-sidebar-bg":     "#030712",
      "--pdv-card":           "#070d18",
      "--pdv-card-hover":     "#09111d",
      "--pdv-border":         "rgba(124,58,237,0.22)",
      "--pdv-text-muted":     "#c4b5fd",
    },
  },
  // ── DELIVERY — Marmita Express — orange sidebar ───────────────────────────
  "demo-delivery-001": {
    name: "Marmita Express",
    primaryColor: "#ea580c",
    cssVars: {
      "--app-sidebar":        "#0d0500",
      "--app-sidebar-hover":  "#1a0800",
      "--app-sidebar-active": "#ea580c",
      "--app-sidebar-text":   "#fff7ed",
      "--app-border-ui":      "rgba(234,88,12,0.22)",
      "--pdv-bg":             "#0d0500",
      "--pdv-header-bg":      "#130700",
      "--pdv-sidebar-bg":     "#0d0500",
      "--pdv-card":           "#1a0800",
      "--pdv-card-hover":     "#200a00",
      "--pdv-border":         "rgba(234,88,12,0.22)",
      "--pdv-text-muted":     "#fdba74",
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
  plan: "BASIC" | "PRO" | "ENTERPRISE" | "DELIVERY";
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
  {
    id: "demo-delivery-001",
    plan: "DELIVERY",
    label: "FoodSaaS Delivery",
    tagline: "Focado em marmitarias e dark kitchens com entrega própria.",
    email: "demo-delivery@foodsaas.demo",
    password: "DemoDelivery@123",
    primaryColor: "#ea580c",
    features: ["PDV", "Cardápio Online", "Rastreamento de Entregadores", "Zonas de Entrega", "App do Entregador"],
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
