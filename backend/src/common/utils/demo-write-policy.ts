/**
 * Política única de escrita pra usuários com role DEMO — usada por
 * `DemoGuard` (global) E `RolesGuard` (por endpoint), que antes bloqueavam
 * escrita de forma independente e sempre-negada. Pedido explícito do
 * usuário (22/08/2026): "a demo tem que ser a própria loja" — o prospect
 * decide contratar depois de USAR o sistema de verdade (abrir caixa, vender,
 * fechar mesa), não só olhar uma vitrine travada.
 *
 * Escopo liberado: só o ciclo de venda (Caixa/Pedidos/Mesas/Carrinho de
 * mesa) — o que o usuário descreveu como "estrutura, botões, funcionamento"
 * ao comparar os nichos (Padaria/Conveniência/Mercado) antes de fechar
 * negócio. Deliberadamente FORA do escopo (continuam somente-leitura pra
 * DEMO), porque contas demo são COMPARTILHADAS entre todos os visitantes
 * que testam o mesmo nicho ao mesmo tempo:
 *   - Catálogo (produtos/categorias/complementos/estoque) — um visitante
 *     apagando o cardápio quebraria a demo pro próximo.
 *   - Configurações/tema/usuários — mesmo motivo.
 *   - Qualquer coisa com efeito colateral EXTERNO real: pagamento
 *     (`/payments`), integrações com credencial de terceiro (`/integrations`,
 *     `/fiscal`), WhatsApp real (`/whatsapp-ai`, `/whatsapp-campaigns`,
 *     `/qr-campaigns`, `/abandoned-cart`) — um visitante malicioso poderia
 *     usar a conta demo grátis pra mandar spam de WhatsApp real ou gastar
 *     crédito de IA (`/ia`, `/smart-import`) da plataforma.
 *   - Qualquer coisa de plataforma (`/super-admin`, `/users`, `/company`
 *     fora de `/company/settings`, `/update-notices`, `/wallet`).
 *
 * `DemoDataResetService` (super-admin module) limpa Order/TableOrder/Cash
 * das contas demo a cada hora — sem isso, pedidos/caixas de um visitante
 * vazariam pro próximo.
 */
const ALLOWED_WRITE_PREFIXES = ['/cash', '/orders', '/table-orders', '/tables', '/table-cart'];

export function isDemoWriteAllowed(method: string, url: string): boolean {
  const m = (method ?? 'GET').toUpperCase();
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return true;

  // `req.url` inclui querystring e o prefixo global `/api` — normaliza pra
  // comparar só o path, sem depender de `startsWith` bater exatamente com
  // `/api/cash` vs `/cash` conforme o ambiente.
  const path = url.split('?')[0];
  return ALLOWED_WRITE_PREFIXES.some((prefix) => path.includes(prefix));
}
