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
};

export const PDV_THEME_KEY = "pdv-admin-theme-v1";

export const PDV_THEME_DEFAULT: PdvThemeConfig = {
  sidebarBg:     "#0F1120",
  categoriesBg:  "#0D0F22",
  productsBg:    "#15172A",
  cartBg:        "#0F1120",
  headerBg:      "#0B0D1A",
  cardBg:        "#1E2138",
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
};

export const PDV_THEME_PRESETS: { name: string; config: Partial<PdvThemeConfig> }[] = [
  { name: "Dark Blue",   config: {} },
  { name: "Purple Night", config: {
    sidebarBg: "#110A24", categoriesBg: "#0E0820", productsBg: "#170F2E",
    cartBg: "#110A24",    headerBg: "#0B0618",     cardBg: "#251640",
    primary: "#7C3AED",   accent: "#EC4899",
  }},
  { name: "Dark Green",  config: {
    sidebarBg: "#0A1A0F", categoriesBg: "#081510", productsBg: "#0E1F14",
    cartBg: "#0A1A0F",    headerBg: "#071210",     cardBg: "#152E1D",
    primary: "#059669",   accent: "#F59E0B",
  }},
  { name: "Midnight",    config: {
    sidebarBg: "#000000", categoriesBg: "#050505", productsBg: "#0A0A0A",
    cartBg: "#000000",    headerBg: "#000000",     cardBg: "#0F0F0F",
    primary: "#3B82F6",   accent: "#F97316",
  }},
  { name: "Crimson",     config: {
    sidebarBg: "#1A0A0A", categoriesBg: "#150808", productsBg: "#1F0E0E",
    cartBg: "#1A0A0A",    headerBg: "#120606",     cardBg: "#2E1515",
    primary: "#DC2626",   accent: "#F97316",
  }},
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
