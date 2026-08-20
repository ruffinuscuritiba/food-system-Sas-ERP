# Mercado / Retail Core — Auditoria (sem código ainda)

> Escopo corrigido pelo usuário durante a sessão: **não é uma reescrita do FoodSaaS inteiro**
> em cima do modelo Oracle Retail/SULTS — é levar essa profundidade especificamente para o
> **módulo Mercado** (supermercado/mercadinho/mercearia/conveniência), reaproveitando o máximo
> possível do que já existe. Este documento segue a estrutura de 9 seções pedida no prompt
> original, mas todo o conteúdo já está filtrado pra esse escopo.

## 1. Arquitetura atual (o que já existe, verificado no código)

- **Backend**: NestJS 11 + Prisma 5.22 + PostgreSQL. Monolito modular por domínio
  (`src/modules/<nome>/`), prefixo `/api`. 78 models no `schema.prisma` (2975 linhas).
- **Multi-tenant**: `companyId` em toda tabela de negócio. **Uma `Company` = uma loja física**
  — não existe hierarquia Empresa → Filiais → Lojas → Terminais. Uma rede com 3 mercados hoje
  seria 3 `Company` **separadas e sem relação entre si** no banco (sem consolidado, sem
  transferência entre lojas).
- **Auth**: JWT (`companyId` + `role` no payload) + `TenantGuard`/`RolesGuard`/`ModuleGuard`.
  RBAC é **grosso** — 6 roles fixos (`SUPER_ADMIN/ADMIN/MANAGER/CASHIER/KITCHEN/DELIVERY`,
  + `WAITER` informal), sem permissões granulares (`sale.discount`, `cash.open` etc. não
  existem como conceito — é tudo "esse endpoint aceita esses roles").
- **Segmento Mercado já existe, mas é raso**: `businessSegment="MERCADO"` (seed de cadastro,
  `segment-seed.service.ts`), 1 conta demo (`demo-mercado-001`, "Mercadinho Bom Preço"), e
  `Category.categoryType` reconhece `"bebidas"` para acionar busca por EAN via Open Food Facts.
  Fora isso, uma loja de Mercado usa **exatamente** o mesmo fluxo de uma pizzaria.

## 2. Módulos existentes reaproveitáveis (o que NÃO precisa ser recriado)

| Necessidade do prompt | Já existe hoje | Nível de reuso |
|---|---|---|
| Cash Register Engine (abrir/fechar/sangria/suprimento/diferença) | `Cash` model + `CashService` — abertura, fechamento **às cegas** (item 151), sangria/suprimento, cupom de auditoria por forma de pagamento | **Direto, sem mudança** |
| Payment Engine desacoplado | `PaymentsService` (Mercado Pago) + `WalletService` (split/repasse) + `Order.paymentMethod` enum (CASH/PIX/CREDIT_CARD/DEBIT_CARD/TRANSFER) | **Reaproveitável**, só falta interface `PaymentProvider` formal se algum dia trocar de gateway |
| Auditoria | `AuditLog` model + `AuditService.log()`, já chamado em login/signup/ações sensíveis | **Parcial** — existe o mecanismo, mas nem toda ação sensível chama ele hoje (ex.: alteração de preço de produto não é auditada) |
| Devolução | Não existe um `Return` model dedicado — hoje só há cancelamento de `Order` (que já estorna estoque via `restoreIngredientTransactional`) | **Parcial** — dá pra adaptar em vez de criar do zero |
| Fidelidade/Cashback | `LoyaltyAccount` + `PointTransaction` + `Coupon` + `LoyaltyMilestoneConfig` (marco de pedidos, item 181) | **Direto** |
| Cliente 360 | `Customer` + `LoyaltyAccount` + histórico via `Order.customerPhone`/`OnlineOrder` (cruzado por telefone, `reports.service.ts getCustomerStats`, item 178) | **Direto** |
| PDV rápido (scanner + teclado) | `/pdv` já tem leitor de código de barras USB (`handleBarcodeSubmit`, item 124), busca por EAN/SKU exato | **Base pronta**, falta afinar pro fluxo 100%-teclado do prompt (seção 44) |
| Fiscal (NFC-e/NF-e) | `CompanyFiscalConfig` (BYOK, Focus NFe) — item 151, infraestrutura pronta mas **emissão não é automática a partir do pedido ainda** | **Parcial** |
| Integrações omnichannel | `IntegrationConfig`/`ProductCatalogMap` já suportam iFood e 99Food (item 183-185) | **Direto** |
| Relatórios/BI | `reports.service.ts` (receita unificada Order+OnlineOrder, item 178), `/bi` com Pareto de produtos, funil de conversão, clientes | **Direto** |

Conclusão da seção: **a fundação de PDV/caixa/pagamento/fidelidade/BI já é enterprise-grade
o bastante para um mercado de porte pequeno/médio**. O que falta é específico de varejo de
prateleira, não de infraestrutura geral.

## 3. Problemas encontrados (classificados)

### CRÍTICO — impede um mercado real de operar hoje
1. **Produto de varejo não tem estoque próprio.** Confirmado no código
   (`stock.service.ts`): todo consumo de estoque passa por `Ingredient` via `Recipe`/`RecipeItem`.
   Um `Product` (ex.: "Arroz Tio João 5kg") **não decrementa nada sozinho** — só funciona se o
   lojista criar manualmente um `Ingredient` espelho + uma `Recipe` de 1:1, um workaround que
   ninguém pediu pra fazer e que a UI não guia. Pra um mercado (centenas de SKUs), isso é
   inviável na prática.
2. **Sem preço por peso / balança.** `Product.weight` existe mas é um campo estático (peso
   do item, tipo "500g" fixo), não "preço por kg com peso variável capturado na balança". Não
   há suporte a EAN-13 de peso variável (prefixo 2, dígitos de peso/preço embutidos).
3. **Sem motor de promoção automática.** `Coupon` é só código digitado manualmente. Não existe
   "leve 3 pague 2", "2ª unidade com desconto", "preço progressivo por quantidade" calculado
   sozinho no carrinho — que é o pão-com-manteiga de supermercado.

### ALTO
4. RBAC é só role, sem granularidade (`cash.open` vs `cash.close` vs `sale.discount` não são
   permissões separadas — hoje é tudo "ADMIN/MANAGER pode, CASHIER não pode" no máximo).
5. Sem PLU (código curto interno pra produtos sem EAN, comum em hortifruti/padaria de mercado).
6. Sem NCM/CEST/origem tributária no cadastro de produto — necessário pra NFC-e de mercado de
   verdade (regime tributário de supermercado é mais rígido que o de restaurante).

### MÉDIO
7. Sem `Return`/devolução dedicada (hoje só cancelamento de pedido inteiro, não devolução
   parcial pós-venda de 1 item específico).
8. Sem lista de preços por canal/cliente (preço atacado vs varejo, por exemplo) — hoje é 1
   preço só por produto (`salePrice`/`ProductSize.price`).

### BAIXO (mencionado no prompt, mas fora de escopo real pro público do FoodSaaS)
9. Multi-loja/multi-terminal formal, offline-first com fila local, event bus, self-checkout,
   mobile POS, split payment tributário — ver seção 9 (Riscos) sobre por que eu **não**
   recomendo construir isso agora.

## 4. Arquitetura proposta (aditiva, não substitutiva)

Nenhum model existente muda de forma incompatível. Tudo é **adição**:

```
Product (existente)
  + isWeighted Boolean @default(false)
  + pricePerKg Decimal?
  + pluCode String?
  + ncm String?
  + cest String?
  + taxOrigin String?
  + stock Decimal? @default(0)      ← NOVO: estoque próprio do produto de varejo
  + minStock Decimal?

StockMovement (existente)
  + productId String?               ← hoje só aceita ingredientId; passa a aceitar produto
                                       de varejo direto, sem precisar de Recipe fake

Promotion (NOVO model, companyId-scoped)
  - type: PERCENTAGE | FIXED | BUY_X_PAY_Y | PROGRESSIVE_PRICE
  - scope: PRODUCT | CATEGORY | BRAND
  - rules (Json): {buyQty, payQty, tiers: [{qty, price}], ...}
  - startsAt / endsAt / active

Return (NOVO model, companyId-scoped)
  - orderId, items[], reason, authorizedBy, refundMethod, createdAt
```

O PDV (`/pdv`) ganha:
- lookup de produto que primeiro checa `pluCode`/`barcode`, depois cai no fluxo de peso se
  `isWeighted=true` (abre um input de "peso confirmado pela balança" — mesmo padrão dos campos
  numéricos já usados no builder de pizza);
- cálculo de `Promotion` aplicado automaticamente no carrinho (mesmo lugar onde hoje calcula
  `originalPrice`/desconto de cupom — é extensão do mesmo pipeline de precificação do
  `useCart`, não um motor novo do zero).

## 5. Banco de dados — o que é novo vs reaproveitado

**Reaproveitado sem alteração**: `Company`, `User`, `Category`, `Cash`, `Payment`,
`WalletTransaction`, `Customer`, `LoyaltyAccount`, `PointTransaction`, `Coupon`, `AuditLog`,
`Order`/`OrderItem` (venda de mercado é só mais um `Order`, canal PDV), `IntegrationConfig`.

**Estendido (migration idempotente, `ADD COLUMN IF NOT EXISTS`)**: `Product`, `StockMovement`.

**Novo**: `Promotion`, `Return`+`ReturnItem`. Só isso — não os 20+ models do prompt original
(`organizations/companies/stores/terminals/price_lists/inventory_movements/
stock_reservations/stock_transfers/sync_queue/events` etc.), porque a maioria já tem
equivalente direto no schema atual (ver seção 2) ou resolve um problema que o público real do
FoodSaaS (mercadinho/mercearia independente, não rede de hipermercado) não tem hoje.

## 6. Plano de migração — sem quebrar nada

Cada etapa é aditiva e testável isolada, seguindo o padrão que já é convenção do projeto
(migration idempotente + `--rolled-back` no Dockerfile + validação contra Postgres real
antes de deploy):

1. `Product.isWeighted/pricePerKg/pluCode/stock/minStock` + `StockMovement.productId` nullable.
2. `StockService` ganha `consumeProductStock()`/`restoreProductStock()` — espelha
   `consumeIngredientTransactional` mas grava direto no `Product.stock`, sem passar por
   `Recipe`. `OrdersService.updateStatus` passa a chamar isso quando o item vendido é um
   produto de varejo sem receita cadastrada (produto COM receita continua indo por
   `Ingredient`, preservando 100% o fluxo de restaurante — zero regressão).
3. PDV: lookup por PLU + fluxo de peso.
4. Model `Promotion` + motor de cálculo no carrinho do PDV e do cardápio digital.
5. Model `Return` + fluxo de devolução parcial (autorização por role, estorno de estoque e
   financeiro).
6. Campos fiscais (NCM/CEST/origem) no cadastro de produto — só cadastro, sem emissão
   automática ainda (a infra BYOK do item 151 continua sendo o próximo passo separado).

## 7. Roadmap (fases, na ordem certa)

| Fase | Entrega | Depende de |
|---|---|---|
| 1 | Estoque próprio de produto de varejo (o bloqueador real nº1) | — |
| 2 | PLU + fluxo de peso no PDV | Fase 1 |
| 3 | Motor de promoções (leve X pague Y, progressivo) | Fase 1 |
| 4 | Devolução parcial | Fase 1 |
| 5 | Campos fiscais NCM/CEST no cadastro | — (paralelo) |
| 6 | RBAC granular — só se um cliente real de mercado pedir (ver riscos) | — |

## 8. Riscos

- **Técnico**: nenhum dos itens acima quebra o fluxo de restaurante/pizzaria — são todos
  aditivos e condicionais (`isWeighted`, `productId` nullable em `StockMovement`). Risco real
  é só de escopo mal calibrado (ver abaixo).
- **Fiscal**: NCM/CEST de supermercado tem muito mais SKUs com regra tributária distinta
  (substituição tributária por produto, por estado) do que cardápio de restaurante — não dá
  pra generalizar; a infra BYOK (item 151) já assume que o cliente é responsável pela
  configuração fiscal, o que é a postura certa (a plataforma não deve virar consultoria
  fiscal, mesma decisão já tomada no item 151).
- **Financeiro/produto**: o prompt original pede offline-first com fila local, event bus,
  self-checkout, mobile POS e split payment tributário nacional — isso é trabalho de meses
  de um time inteiro, pensado pra rede de hipermercado com centenas de terminais. O público
  real do FoodSaaS hoje (ver `DEMO_ACCOUNTS`/segmentos já seedados) é comércio independente de
  pequeno/médio porte. Construir isso agora é over-engineering que atrasa entrega de valor
  real (estoque de produto funcionando) por meses, pra resolver um problema que nenhum cliente
  atual tem.
- **Segurança**: nada nesse plano expõe dado entre tenants — tudo segue o padrão
  `companyId` já auditado no resto do sistema.

## 9. Recomendação (a parte que o usuário pediu explicitamente: "se ver que dá pra fazer
algo melhor, me informe")

**Não recomendo seguir o prompt original ao pé da letra.** Ele foi escrito pensando em
Oracle Retail/SULTS — plataformas pra redes de varejo com múltiplas lojas físicas, milhares
de terminais, operação 100% offline-capaz e compliance fiscal de grande porte. O FoodSaaS
hoje é uma **SaaS multi-tenant onde 1 tenant = 1 loja independente** — pizzaria, hamburgueria,
marmitaria, mercadinho. Construir hierarquia Empresa→Filiais→Lojas→Terminais, event bus,
offline-first com fila local e self-checkout agora seria resolver o problema de um cliente
que **ainda não existe** na base, à custa de meses de trabalho que atrasam o que **realmente**
falta pro segmento Mercado funcionar de verdade: **um produto vendido no PDV precisa
decrementar o próprio estoque sem gambiarra de Ingredient/Recipe, e o caixa precisa saber
calcular "leve 3 pague 2" sozinho.** Essas duas coisas (Fases 1 e 3 acima) resolvem 80% da
dor real de quem tem um mercadinho, com uma fração do esforço do plano de 12 fases.

Se no futuro um cliente real do FoodSaaS for uma rede de 5+ lojas pedindo transferência entre
unidades e estoque centralizado, aí sim vale desenhar a hierarquia Empresa→Lojas — mas como
extensão do que existir então, não como fundação especulativa agora.

---

**Nenhum código foi escrito.** Aguardando autorização para iniciar a Fase 1 (estoque próprio
de produto de varejo) — ou para ajustar o escopo acima antes de começar.
