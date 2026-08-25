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

// Segmentos onde "Prato do Dia" (checklist de acompanhamentos fixos + troca
// de proteína, ver ComplementsModal) faz sentido como botão dedicado no
// cadastro do produto — pedido explícito do usuário, escopo restrito a estes
// 3 (não é um recurso genérico pra qualquer segmento).
const DAILY_MENU_SEGMENTS = new Set(["MARMITARIA", "RESTAURANTE", "CHURRASCARIA"]);

export function segmentHasDailyMenu(businessSegment: string | null | undefined): boolean {
  if (!businessSegment) return false;
  return DAILY_MENU_SEGMENTS.has(businessSegment);
}

// Segmentos que usam a frente de caixa dedicada de varejo (/pdv-mercado +
// /mercado-controle — bipagem, produto por peso, multi-caixa) em vez do PDV
// clássico de comida. Mercado e Conveniência vendem o mesmo tipo de item
// (produto de prateleira com código de barras, sem preparo/receita), por
// isso compartilham 100% da mesma tela — "iguais" por pedido do usuário.
const MERCADO_STYLE_PDV_SEGMENTS = new Set(["MERCADO", "CONVENIENCIA"]);

export function isMercadoStylePdv(businessSegment: string | null | undefined): boolean {
  if (!businessSegment) return false;
  return MERCADO_STYLE_PDV_SEGMENTS.has(businessSegment);
}

// Segmentos que usam a frente de caixa dedicada de Padaria/Confeitaria/Açaí
// (/pdv-padaria — categorias em blocos coloridos, cliente rápido no topo do
// pedido, venda por peso/unidade). Pedido do usuário: aplicar o mesmo design
// de "Ponto do Pão POS" (mockup aprovado) a esses 3 nichos, que compartilham
// o mesmo padrão de venda de balcão (produto pronto, sem pedido composto tipo
// "monte sua marmita" nem construtor de pizza).
const PADARIA_STYLE_PDV_SEGMENTS = new Set(["PADARIA", "DOCERIA", "ACAI"]);

export function isPadariaStylePdv(businessSegment: string | null | undefined): boolean {
  if (!businessSegment) return false;
  return PADARIA_STYLE_PDV_SEGMENTS.has(businessSegment);
}

// Fonte única da rota de PDV por segmento — reaproveitada tanto pelo link
// "Frente de Caixa" da sidebar (ClientShell.tsx) quanto pelo redirect
// pós-login (login/page.tsx), pra nunca mais divergir uma da outra (foi
// exatamente essa divergência que fez Conveniência cair sempre no /pdv
// genérico após o login, mesmo com o link da sidebar já apontando certo).
const MARMITARIA_STYLE_PDV_SEGMENTS = new Set(["MARMITARIA", "RESTAURANTE", "CHURRASCARIA"]);

export function getPdvHref(businessSegment: string | null | undefined): string {
  if (isMercadoStylePdv(businessSegment)) return "/pdv-mercado";
  if (isPadariaStylePdv(businessSegment)) return "/pdv-padaria";
  if (businessSegment && MARMITARIA_STYLE_PDV_SEGMENTS.has(businessSegment)) return "/pdv-marmitaria-restaurante";
  return "/pdv";
}

// Identidade visual do PAINEL ADMIN INTEIRO (não só o PDV) pros 3 grupos de
// nicho que ganharam frente de caixa dedicada — pedido explícito do usuário
// (24/08/2026): "tem que acompanhar a estrutura em todas as páginas... não
// só do pdv mais de todo o sistema" — sair do PDV novo (tema próprio) e cair
// em /configuracoes com a cara genérica antiga quebrava a identidade visual.
// Cor extraída do elemento mais representativo de cada PDV dedicado (não
// uma cor secundária de botão de pagamento): laranja da Marmitaria/
// Restaurante (LARANJA em pdv-marmitaria-restaurante/page.tsx), azul do
// destaque de busca do Mercado (Dynamics 365 style), marrom do topbar da
// Padaria. `dark` reflete o modo real de cada PDV — Marmitaria e Mercado são
// escuros, Padaria é claro (cream) — forçar dark em todos teria destoado da
// própria referência que pediram pra seguir.
export const NICHE_THEME_BY_SEGMENT: Record<string, { color: string; dark: boolean }> = {
  MERCADO: { color: "#2563EB", dark: true },
  CONVENIENCIA: { color: "#2563EB", dark: true },
  PADARIA: { color: "#4B2F1F", dark: false },
  DOCERIA: { color: "#4B2F1F", dark: false },
  ACAI: { color: "#4B2F1F", dark: false },
  MARMITARIA: { color: "#F47B18", dark: true },
  RESTAURANTE: { color: "#F47B18", dark: true },
  CHURRASCARIA: { color: "#F47B18", dark: true },
};

export function getNicheAdminTheme(
  businessSegment: string | null | undefined,
): { color: string; dark: boolean } | null {
  if (!businessSegment) return null;
  return NICHE_THEME_BY_SEGMENT[businessSegment] ?? null;
}
