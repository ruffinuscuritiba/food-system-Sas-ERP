/**
 * Fallback de imagem quando o produto não tem foto própria — antes fixo em
 * uma foto de pizza pra QUALQUER segmento (achado ao vivo: mercado mostrando
 * Coca-Cola/Leite/Queijo todos com a mesma foto de pizza). Agora varia pelo
 * businessSegment da empresa.
 */
const PLACEHOLDER_BY_SEGMENT: Record<string, string> = {
  MERCADO: "https://images.unsplash.com/photo-1601599963565-b7f49deb2d3f?w=400&q=80",
  CONVENIENCIA: "https://images.unsplash.com/photo-1601599963565-b7f49deb2d3f?w=400&q=80",
  HAMBURGUERIA: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80",
  ACAI: "https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400&q=80",
  PADARIA: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80",
  DOCERIA: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&q=80",
  PASTELARIA: "https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=400&q=80",
  CHURRASCARIA: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&q=80",
  MARMITARIA: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80",
  HOT_DOG: "https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=400&q=80",
  LANCHONETE: "https://images.unsplash.com/photo-1619740455993-9e612b1af08a?w=400&q=80",
  RESTAURANTE: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80",
};

export function getProductPlaceholderImage(businessSegment: string | null | undefined): string {
  if (!businessSegment) return PLACEHOLDER_BY_SEGMENT.RESTAURANTE;
  return PLACEHOLDER_BY_SEGMENT[businessSegment] ?? PLACEHOLDER_BY_SEGMENT.RESTAURANTE;
}
