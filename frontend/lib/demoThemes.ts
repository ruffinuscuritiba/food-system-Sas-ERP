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
  // ── BASIC — Pizzaria Bella Napoli — verde-esmeralda médio ─────────────────
  "demo-basic-001": {
    name: "Bella Napoli",
    primaryColor: "#1A6B45",
    cssVars: {
      ...MARBLE,
      "--color-primary":      "#1A6B45",
      "--app-sidebar-active": "#1A6B45",
    },
  },

  // ── PRO — Pizzaria Don Corleone — azul-safira médio ──────────────────────
  "demo-pro-001": {
    name: "Don Corleone",
    primaryColor: "#1A4FA8",
    cssVars: {
      ...MARBLE,
      "--color-primary":      "#1A4FA8",
      "--app-sidebar-active": "#1A4FA8",
    },
  },

  // ── ENTERPRISE — Grupo Milano — índigo sóbrio ────────────────────────────
  "demo-enterprise-001": {
    name: "Milano",
    primaryColor: "#4C2D9C",
    cssVars: {
      ...MARBLE,
      "--color-primary":      "#4C2D9C",
      "--app-sidebar-active": "#4C2D9C",
    },
  },

  // ── DELIVERY — Marmita Express — verde-teal fresco ───────────────────────
  "demo-delivery-001": {
    name: "Marmita Express",
    primaryColor: "#0F7A62",
    cssVars: {
      ...MARBLE,
      "--color-primary":      "#0F7A62",
      "--app-sidebar-active": "#0F7A62",
    },
  },

  // ── CONVENIÊNCIA — Adega & Conveniência Point — vinho/adega ──────────────
  "demo-conveniencia-001": {
    name: "Adega & Conveniência Point",
    primaryColor: "#9F1239",
    cssVars: { ...MARBLE, "--color-primary": "#9F1239", "--app-sidebar-active": "#9F1239" },
  },
  "demo-hamburgueria-001": {
    name: "Grelha & Cia Hamburgueria",
    primaryColor: "#B91C1C",
    cssVars: { ...MARBLE, "--color-primary": "#B91C1C", "--app-sidebar-active": "#B91C1C" },
  },
  "demo-lanchonete-001": {
    name: "Ponto do Lanche",
    primaryColor: "#B45309",
    cssVars: { ...MARBLE, "--color-primary": "#B45309", "--app-sidebar-active": "#B45309" },
  },
  "demo-churrascaria-001": {
    name: "Espeto & Brasa Churrascaria",
    primaryColor: "#7C2D12",
    cssVars: { ...MARBLE, "--color-primary": "#7C2D12", "--app-sidebar-active": "#7C2D12" },
  },
  "demo-hotdog-001": {
    name: "Dog House Lanches",
    primaryColor: "#A16207",
    cssVars: { ...MARBLE, "--color-primary": "#A16207", "--app-sidebar-active": "#A16207" },
  },
  "demo-padaria-001": {
    name: "Padaria Trigo Dourado",
    primaryColor: "#92400E",
    cssVars: { ...MARBLE, "--color-primary": "#92400E", "--app-sidebar-active": "#92400E" },
  },
  "demo-confeitaria-001": {
    name: "Doce Encanto Confeitaria",
    primaryColor: "#BE185D",
    cssVars: { ...MARBLE, "--color-primary": "#BE185D", "--app-sidebar-active": "#BE185D" },
  },
  "demo-pastelaria-001": {
    name: "Pastelaria Sabor & Cia",
    primaryColor: "#CA8A04",
    cssVars: { ...MARBLE, "--color-primary": "#CA8A04", "--app-sidebar-active": "#CA8A04" },
  },
  "demo-acai-001": {
    name: "Açaí Tropical Point",
    primaryColor: "#6D28D9",
    cssVars: { ...MARBLE, "--color-primary": "#6D28D9", "--app-sidebar-active": "#6D28D9" },
  },
  "demo-mercado-001": {
    name: "Mercadinho Bom Preço",
    primaryColor: "#1D4ED8",
    cssVars: { ...MARBLE, "--color-primary": "#1D4ED8", "--app-sidebar-active": "#1D4ED8" },
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
  // "BASIC"|"PRO"|"ENTERPRISE"|"DELIVERY" pilotam os 4 cards de plano da
  // wizard; os demais valores (CONVENIENCIA, HAMBURGUERIA, ...) só existem
  // pra serem alvo de NICHE_DEMO_OVERRIDE e nunca aparecem como card próprio.
  plan: string;
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
    primaryColor: "#1A6B45",
    features: ["PDV", "Pedidos", "Cozinha", "Mesas", "Cardápio Online"],
  },
  {
    id: "demo-pro-001",
    plan: "PRO",
    label: "FoodSaaS Pro",
    tagline: "Ideal para operações em crescimento.",
    email: "demo-pro@foodsaas.demo",
    password: "DemoPro@123",
    primaryColor: "#1A4FA8",
    features: ["Tudo do Basic", "Cupons", "Relatórios", "Controle avançado", "Gestão ampliada"],
  },
  {
    id: "demo-enterprise-001",
    plan: "ENTERPRISE",
    label: "FoodSaaS Enterprise",
    tagline: "Solução premium para grandes operações.",
    email: "demo-enterprise@foodsaas.demo",
    password: "DemoEnterprise@123",
    primaryColor: "#4C2D9C",
    features: ["Tudo do Pro", "Multiunidades", "Recursos avançados", "Dashboards completos", "Operação corporativa"],
  },
  {
    id: "demo-delivery-001",
    plan: "DELIVERY",
    label: "FoodSaaS Delivery",
    tagline: "Focado em marmitarias e dark kitchens com entrega própria.",
    email: "demo-delivery@foodsaas.demo",
    password: "DemoDelivery@123",
    primaryColor: "#0F7A62",
    features: ["PDV", "Cardápio Online", "Rastreamento de Entregadores", "Zonas de Entrega", "App do Entregador"],
  },
  {
    id: "demo-conveniencia-001",
    plan: "CONVENIENCIA",
    label: "FoodSaaS Conveniência",
    tagline: "Focado em conveniências, adegas e minimercados com leitor de código de barras.",
    email: "demo-conveniencia@foodsaas.demo",
    password: "DemoConveniencia@123",
    primaryColor: "#9F1239",
    features: ["PDV com código de barras", "Controle de Estoque", "Cardápio Online", "Controle de Caixa"],
  },
  {
    id: "demo-hamburgueria-001", plan: "HAMBURGUERIA", label: "FoodSaaS Hamburgueria",
    tagline: "Focado em hamburguerias com modificadores de ingrediente e combos.",
    email: "demo-hamburgueria@foodsaas.demo", password: "DemoHamburgueria@123", primaryColor: "#B91C1C",
    features: ["PDV com modificadores", "KDS na Chapa", "Cardápio Online", "Controle de Caixa"],
  },
  {
    id: "demo-lanchonete-001", plan: "LANCHONETE", label: "FoodSaaS Lanchonete",
    tagline: "Focado em lanchonetes com frente de caixa ágil.",
    email: "demo-lanchonete@foodsaas.demo", password: "DemoLanchonete@123", primaryColor: "#B45309",
    features: ["PDV Ágil", "Cardápio Online", "Controle de Estoque", "Controle de Caixa"],
  },
  {
    id: "demo-churrascaria-001", plan: "CHURRASCARIA", label: "FoodSaaS Churrascaria",
    tagline: "Focado em churrascarias com comanda por mesa.",
    email: "demo-churrascaria@foodsaas.demo", password: "DemoChurrascaria@123", primaryColor: "#7C2D12",
    features: ["Mesas e Comandas", "KDS na Churrasqueira", "Cardápio Online", "Controle de Caixa"],
  },
  {
    id: "demo-hotdog-001", plan: "HOTDOG", label: "FoodSaaS Hot Dog",
    tagline: "Focado em hot dogs e lanches rápidos de balcão.",
    email: "demo-hotdog@foodsaas.demo", password: "DemoHotdog@123", primaryColor: "#A16207",
    features: ["KDS na Chapa", "Modificadores de Ingrediente", "Cardápio Online", "Controle de Caixa"],
  },
  {
    id: "demo-padaria-001", plan: "PADARIA", label: "FoodSaaS Padaria",
    tagline: "Focado em padarias com venda por unidade, kg ou dúzia.",
    email: "demo-padaria@foodsaas.demo", password: "DemoPadaria@123", primaryColor: "#92400E",
    features: ["PDV Ágil", "Encomendas", "Cardápio Online", "Controle de Caixa"],
  },
  {
    id: "demo-confeitaria-001", plan: "CONFEITARIA", label: "FoodSaaS Confeitaria",
    tagline: "Focado em confeitarias com pedidos personalizados e agenda de retirada.",
    email: "demo-confeitaria@foodsaas.demo", password: "DemoConfeitaria@123", primaryColor: "#BE185D",
    features: ["Pedidos Personalizados", "Agenda de Retirada", "Cardápio Online", "Controle de Caixa"],
  },
  {
    id: "demo-pastelaria-001", plan: "PASTELARIA", label: "FoodSaaS Pastelaria",
    tagline: "Focado em pastelarias com grade de recheios sem erro de comanda.",
    email: "demo-pastelaria@foodsaas.demo", password: "DemoPastelaria@123", primaryColor: "#CA8A04",
    features: ["PDV Tátil", "Impressão Setorizada", "Cardápio Online", "Controle de Caixa"],
  },
  {
    id: "demo-acai-001", plan: "ACAI", label: "FoodSaaS Açaí",
    tagline: "Focado em açaiterias com montagem rápida por tamanho e adicionais.",
    email: "demo-acai@foodsaas.demo", password: "DemoAcai@123", primaryColor: "#6D28D9",
    features: ["PDV de Montagem Rápida", "Cardápio Online", "Controle de Estoque", "Controle de Caixa"],
  },
  {
    id: "demo-mercado-001", plan: "MERCADO", label: "FoodSaaS Mercado",
    tagline: "Focado em mercados e mercearias com leitor de código de barras.",
    email: "demo-mercado@foodsaas.demo", password: "DemoMercado@123", primaryColor: "#1D4ED8",
    features: ["PDV com EAN", "Controle de Estoque", "Cardápio Online", "Controle de Caixa"],
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
