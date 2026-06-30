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

// Mármore base — compartilhado por todos os demos (padrão claro, sem dark)
const MARBLE: Record<string, string> = {
  "--app-sidebar":        "#FFFFFF",
  "--app-sidebar-hover":  "#F0EEE9",
  "--app-border-ui":      "#E2E0DC",
  "--app-sidebar-text":   "#374151",
  "--pdv-bg":             "#F7F6F3",
  "--pdv-header-bg":      "#FFFFFF",
  "--pdv-sidebar-bg":     "#FFFFFF",
  "--pdv-card":           "#FAFAF8",
  "--pdv-card-hover":     "#EEECEA",
  "--pdv-border":         "#E2E0DC",
  "--pdv-text-muted":     "#6B7280",
};

export const DEMO_THEMES: Record<string, DemoTheme> = {
  // ── BASIC — Pizzaria Bella Napoli — verde floresta sóbrio ─────────────────
  "demo-basic-001": {
    name: "Bella Napoli",
    primaryColor: "#1F5C38",
    cssVars: {
      ...MARBLE,
      "--color-primary":      "#1F5C38",
      "--app-sidebar-active": "#1F5C38",
    },
  },

  // ── PRO — Pizzaria Don Corleone — azul naval sóbrio ──────────────────────
  "demo-pro-001": {
    name: "Don Corleone",
    primaryColor: "#1A3A6B",
    cssVars: {
      ...MARBLE,
      "--color-primary":      "#1A3A6B",
      "--app-sidebar-active": "#1A3A6B",
    },
  },

  // ── ENTERPRISE — Grupo Milano — roxo profundo sóbrio ─────────────────────
  "demo-enterprise-001": {
    name: "Milano",
    primaryColor: "#3D1A70",
    cssVars: {
      ...MARBLE,
      "--color-primary":      "#3D1A70",
      "--app-sidebar-active": "#3D1A70",
    },
  },

  // ── DELIVERY — Marmita Express — terracota sóbrio ────────────────────────
  "demo-delivery-001": {
    name: "Marmita Express",
    primaryColor: "#7C3D12",
    cssVars: {
      ...MARBLE,
      "--color-primary":      "#7C3D12",
      "--app-sidebar-active": "#7C3D12",
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
    primaryColor: "#1F5C38",
    features: ["PDV", "Pedidos", "Cozinha", "Mesas", "Cardápio Online"],
  },
  {
    id: "demo-pro-001",
    plan: "PRO",
    label: "FoodSaaS Pro",
    tagline: "Ideal para operações em crescimento.",
    email: "demo-pro@foodsaas.demo",
    password: "DemoPro@123",
    primaryColor: "#1A3A6B",
    features: ["Tudo do Basic", "Cupons", "Relatórios", "Controle avançado", "Gestão ampliada"],
  },
  {
    id: "demo-enterprise-001",
    plan: "ENTERPRISE",
    label: "FoodSaaS Enterprise",
    tagline: "Solução premium para grandes operações.",
    email: "demo-enterprise@foodsaas.demo",
    password: "DemoEnterprise@123",
    primaryColor: "#3D1A70",
    features: ["Tudo do Pro", "Multiunidades", "Recursos avançados", "Dashboards completos", "Operação corporativa"],
  },
  {
    id: "demo-delivery-001",
    plan: "DELIVERY",
    label: "FoodSaaS Delivery",
    tagline: "Focado em marmitarias e dark kitchens com entrega própria.",
    email: "demo-delivery@foodsaas.demo",
    password: "DemoDelivery@123",
    primaryColor: "#7C3D12",
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
