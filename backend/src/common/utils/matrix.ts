/**
 * Matrix / R_FoodSaaS — loja mestre da plataforma.
 *
 * Para esta empresa TODOS os módulos são permanentemente ativos.
 * Configurável via env var MATRIX_COMPANY_ID (fallback = ID de prod).
 *
 * Esta é a loja real "Ruffinu's Pizzaria", usada internamente para dogfooding
 * do sistema — NÃO é a identidade de vendas da Kely (ver PLATFORM_SELLER_COMPANY_ID).
 */
export const MATRIX_COMPANY_ID =
  process.env.MATRIX_COMPANY_ID ?? 'cmq7d3dxs0006gw5pabsljy87';

export function isMatrixCompany(companyId: string): boolean {
  return companyId === MATRIX_COMPANY_ID;
}

/**
 * Identidade "vendedora do SaaS" — empresa cuja conexão de WhatsApp a Kely usa
 * para vender o R_FoodSaaS (modo R_FOOD_SAAS em detectAmbiente) e cujos dados
 * alimentam a tela "Minha Loja" do Super Admin. Deliberadamente SEPARADA de
 * MATRIX_COMPANY_ID: essa é uma loja de marca/identidade (ex: Mestra Gestão
 * Digital), não a loja real usada para bypass de módulos.
 * Configurável via env var PLATFORM_SELLER_COMPANY_ID.
 */
export const PLATFORM_SELLER_COMPANY_ID =
  process.env.PLATFORM_SELLER_COMPANY_ID ?? 'cmrf983h6000auqph3fmrrp21';
