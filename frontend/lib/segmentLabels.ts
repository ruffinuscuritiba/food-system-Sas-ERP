/**
 * Rótulo do módulo "Complementos" adaptado por segmento de negócio
 * (`Company.businessSegment`, ver segment-seed.service.ts no backend).
 * Mesma ideia da página /demo (terminologia por nicho) — só que aplicada
 * dentro do próprio produto, não só na página de marketing.
 */
export const COMPLEMENTS_LABEL_BY_SEGMENT: Record<string, string> = {
  HAMBURGUERIA: "Ponto da Carne e Combos",
  ACAI: "Montagem por Camadas / Peso",
  MARMITARIA: "Cardápio do Dia / Acompanhamentos Fixos",
  HOT_DOG: "Grade de Complementos",
  PASTELARIA: "Grade de Recheios",
  CHURRASCARIA: "Cortes e Acompanhamentos",
  LANCHONETE: "Adicionais e Combos",
  PADARIA: "Complementos e Peso",
  DOCERIA: "Recheios e Coberturas",
  CONVENIENCIA: "Combos e Promoções",
  MERCADO: "Combos e Promoções",
  RESTAURANTE: "Complementos",
};

export function getComplementsLabel(businessSegment: string | null | undefined): string {
  if (!businessSegment) return "Complementos";
  return COMPLEMENTS_LABEL_BY_SEGMENT[businessSegment] ?? "Complementos";
}

// Segmentos com catálogo curado (SEGMENT_DATA, backend segment-seed.service.ts)
// que claramente não vendem pizza — o item "Pizza / Bordas" da sidebar não
// fazia sentido pra eles (ex.: uma conveniência via bordas recheadas no menu,
// achado ao vivo testando /demo). RESTAURANTE fica de fora da lista porque é
// o default do schema e também o segmento das pizzarias reais (não existe um
// businessSegment "PIZZARIA" dedicado) — sem valor setado (null/undefined)
// também mantém visível, mesmo critério.
const NON_PIZZA_SEGMENTS = new Set([
  "HAMBURGUERIA", "ACAI", "MARMITARIA", "HOT_DOG", "PASTELARIA",
  "CHURRASCARIA", "LANCHONETE", "PADARIA", "DOCERIA", "CONVENIENCIA", "MERCADO",
]);

export function segmentSellsPizza(businessSegment: string | null | undefined): boolean {
  if (!businessSegment) return true;
  return !NON_PIZZA_SEGMENTS.has(businessSegment);
}
