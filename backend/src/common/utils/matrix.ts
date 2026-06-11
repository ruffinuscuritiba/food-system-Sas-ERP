/**
 * Matrix / R_FoodSaaS — loja mestre da plataforma.
 *
 * Para esta empresa TODOS os módulos são permanentemente ativos.
 * Configurável via env var MATRIX_COMPANY_ID (fallback = ID de prod).
 */
export const MATRIX_COMPANY_ID =
  process.env.MATRIX_COMPANY_ID ?? 'cmq7d3dxs0006gw5pabsljy87';

export function isMatrixCompany(companyId: string): boolean {
  return companyId === MATRIX_COMPANY_ID;
}
