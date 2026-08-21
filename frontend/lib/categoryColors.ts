/**
 * Paleta de cores pra abas de categoria — frente de caixa da Marmitaria
 * (estilo Consumer/Goomer, cada categoria com uma cor própria).
 */
export const CATEGORY_COLOR_PALETTE = [
  "#D85A30", // coral
  "#0F6E56", // teal
  "#854F0B", // amber
  "#534AB7", // purple
  "#993556", // pink
  "#185FA5", // blue
  "#3B6D11", // green
  "#5F5E5A", // gray
];

/** Cor determinística por posição — categoria sem cor salva ainda não fica cinza uniforme. */
export function getCategoryColor(category: { color?: string | null }, index: number): string {
  return category.color || CATEGORY_COLOR_PALETTE[index % CATEGORY_COLOR_PALETTE.length];
}
