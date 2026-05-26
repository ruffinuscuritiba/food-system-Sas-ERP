export const T = {
  bgPrimary:    "#0A0A0C",
  bgSecondary:  "#111114",
  bgTertiary:   "#18181C",
  bgCard:       "#1D1D22",
  bgElevated:   "#232328",
  border:       "#2A2A30",
  borderSoft:   "#1F1F24",
  textPrimary:  "#FFFFFF",
  textSecond:   "#B8B8C0",
  textTertiary: "#6D6D78",
  accent:       "#2563FF",
  accentHover:  "#3D75FF",
  accentDim:    "#1E4FD9",
  danger:       "#FF4757",
  success:      "#2ED573",
  orange:       "#F97316",
  shadowSm:     "0 2px 8px rgba(0,0,0,0.3)",
  shadowMd:     "0 8px 24px rgba(0,0,0,0.4)",
  shadowLg:     "0 16px 48px rgba(0,0,0,0.5)",
  shadowAccent: "0 8px 24px rgba(37, 99, 255, 0.35)",
} as const;

export const FONT = "'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

export function fmt(n: number) {
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}
