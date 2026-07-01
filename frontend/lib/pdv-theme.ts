export type PdvFont    = "Inter" | "Poppins" | "Nunito" | "system-ui";
export type PdvSpacing = "compact" | "medium" | "spacious";

export type PdvThemeConfig = {
  sidebarBg:     string;
  categoriesBg:  string;
  productsBg:    string;
  cartBg:        string;
  headerBg:      string;
  cardBg:        string;
  primary:       string;
  accent:        string;
  border:        string;
  hoverBg:       string;
  radius:        number;
  font:          PdvFont;
  spacing:       PdvSpacing;
  shadows:       boolean;
  animations:    boolean;
  glassmorphism: boolean;
  compactMode:   boolean;
  darkProducts:  boolean;
};

export const PDV_THEME_KEY = "pdv-admin-theme-v1";

export const PDV_THEME_DEFAULT: PdvThemeConfig = {
  sidebarBg:     "#0F1120",
  categoriesBg:  "#0D0F22",
  productsBg:    "#F5F3EF",
  cartBg:        "#0F1120",
  headerBg:      "#0B0D1A",
  cardBg:        "#FFFFFF",
  primary:       "#2563EB",
  accent:        "#F97316",
  border:        "rgba(255,255,255,0.07)",
  hoverBg:       "rgba(255,255,255,0.08)",
  radius:        16,
  font:          "Inter",
  spacing:       "medium",
  shadows:       true,
  animations:    true,
  glassmorphism: false,
  compactMode:   false,
  darkProducts:  false,
};

export type PdvPreset = {
  name:        string;
  description: string;
  emoji:       string;
  config:      Partial<PdvThemeConfig>;
};

export const PDV_THEME_PRESETS: PdvPreset[] = [
  {
    name:        "Goomer Dark",
    description: "Padrão operacional premium — fundo claro + nav escuro",
    emoji:       "🎯",
    config: {
      sidebarBg:    "#0A0E1A",
      categoriesBg: "#0C1020",
      productsBg:   "#F5F3EF",
      cartBg:       "#0A0E1A",
      headerBg:     "#070B15",
      cardBg:       "#FFFFFF",
      primary:      "#2563EB",
      accent:       "#F97316",
      border:       "rgba(255,255,255,0.07)",
      shadows:      true,
      animations:   true,
      glassmorphism: false,
      darkProducts: false,
    },
  },
  {
    name:        "Orange Premium",
    description: "Energia e foco com laranja premium — tom quente",
    emoji:       "🔥",
    config: {
      sidebarBg:    "#180D00",
      categoriesBg: "#120900",
      productsBg:   "#FFF8F2",
      cartBg:       "#180D00",
      headerBg:     "#100600",
      cardBg:       "#FFFFFF",
      primary:      "#EA580C",
      accent:       "#F59E0B",
      border:       "rgba(255,255,255,0.08)",
      shadows:      true,
      animations:   true,
      glassmorphism: false,
      darkProducts: false,
    },
  },
  {
    name:        "Black Glass",
    description: "Total black com glassmorphism cinematográfico",
    emoji:       "🌑",
    config: {
      sidebarBg:    "#000000",
      categoriesBg: "#050508",
      productsBg:   "#08080C",
      cartBg:       "#000000",
      headerBg:     "#000000",
      cardBg:       "rgba(255,255,255,0.05)",
      primary:      "#818CF8",
      accent:       "#06B6D4",
      border:       "rgba(255,255,255,0.09)",
      hoverBg:      "rgba(255,255,255,0.06)",
      shadows:      true,
      animations:   true,
      glassmorphism: true,
      darkProducts: true,
    },
  },
  {
    name:        "Verde Natureza",
    description: "Frescor orgânico — ideal para marmitarias e naturais",
    emoji:       "🌿",
    config: {
      sidebarBg:    "#03170d",
      categoriesBg: "#03170d",
      productsBg:   "#03170d",
      cartBg:       "#03170d",
      headerBg:     "#03170d",
      cardBg:       "rgba(22,163,74,0.09)",
      primary:      "#16a34a",
      accent:       "#22c55e",
      border:       "rgba(34,197,94,0.15)",
      hoverBg:      "rgba(22,163,74,0.12)",
      shadows:      true,
      animations:   true,
      glassmorphism: false,
      darkProducts:  true,
    },
  },
  {
    name:        "Minimal Clean",
    description: "Elegante e discreto — ideal para ambientes sofisticados",
    emoji:       "🤍",
    config: {
      sidebarBg:    "#111827",
      categoriesBg: "#0F172A",
      productsBg:   "#F8FAFC",
      cartBg:       "#111827",
      headerBg:     "#0F172A",
      cardBg:       "#FFFFFF",
      primary:      "#0EA5E9",
      accent:       "#10B981",
      border:       "rgba(255,255,255,0.06)",
      shadows:      true,
      animations:   true,
      glassmorphism: false,
      darkProducts: false,
    },
  },
  {
    name:        "Tradicional Branco",
    description: "Interface clara e limpa — máxima legibilidade para o dia a dia",
    emoji:       "☀️",
    config: {
      sidebarBg:    "#FFFFFF",
      categoriesBg: "#F1F5F9",
      productsBg:   "#F8FAFC",
      cartBg:       "#FFFFFF",
      headerBg:     "#FFFFFF",
      cardBg:       "#FFFFFF",
      primary:      "#DC2626",
      accent:       "#F97316",
      border:       "rgba(0,0,0,0.08)",
      hoverBg:      "rgba(0,0,0,0.04)",
      shadows:      true,
      animations:   true,
      glassmorphism: false,
      darkProducts: false,
    },
  },
];

export function loadPdvTheme(): PdvThemeConfig {
  if (typeof window === "undefined") return PDV_THEME_DEFAULT;
  try {
    const s = localStorage.getItem(PDV_THEME_KEY);
    if (s) return { ...PDV_THEME_DEFAULT, ...JSON.parse(s) };
  } catch {}
  return PDV_THEME_DEFAULT;
}

export function savePdvTheme(t: PdvThemeConfig): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(PDV_THEME_KEY, JSON.stringify(t)); } catch {}
}

export function broadcastPdvTheme(t: PdvThemeConfig): void {
  if (typeof BroadcastChannel === "undefined") return;
  try {
    const bc = new BroadcastChannel("pdv-theme");
    bc.postMessage(t);
    bc.close();
  } catch {}
}

/** Injeta as cores do tema PDV como CSS variables no <html> (lidas pelo /pdv). */
export function applyPdvVars(t: PdvThemeConfig): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--pdv-bg",          t.productsBg);
  root.style.setProperty("--pdv-sidebar-bg",  t.sidebarBg);
  root.style.setProperty("--pdv-categories-bg", t.categoriesBg);
  root.style.setProperty("--pdv-card",        t.cardBg);
  root.style.setProperty("--pdv-card-hover",  t.hoverBg || t.cardBg);
  root.style.setProperty("--pdv-border",      t.border);
  root.style.setProperty("--pdv-header",      t.headerBg || t.sidebarBg);
  // Profundidade opcional (flat design, sem skeuomorfismo): quando o preset
  // liga `shadows`, cards ganham elevação sutil; caso contrário, plano.
  root.style.setProperty(
    "--pdv-shadow",
    t.shadows ? "0 2px 10px rgba(0,0,0,0.25)" : "none"
  );
  root.style.setProperty(
    "--pdv-shadow-hover",
    t.shadows ? "0 10px 28px rgba(0,0,0,0.4)" : "none"
  );
  if (t.primary) root.style.setProperty("--color-primary", t.primary);
}
