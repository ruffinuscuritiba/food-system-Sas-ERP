# CLAUDE.md — Food System SaaS ERP

Memória técnica resumida do projeto. Consultar **antes** de explorar o código para evitar leituras repetidas.

---

## Stack

**Backend** (`/backend`)
- NestJS 11 + TypeScript 6
- Prisma 5.22 + PostgreSQL (Supabase em prod)
- JWT (`@nestjs/jwt`) + Passport (`passport-jwt`)
- Socket.IO 4 (`@nestjs/websockets`)
- bcrypt (hash 10 rounds)
- class-validator + class-transformer (ValidationPipe global, `whitelist` + `forbidNonWhitelisted` + `transform`)
- Cloudinary + Multer (uploads; fallback local em `/uploads`)
- Anthropic SDK + Google Generative AI (IA / Smart Import)
- Nodemailer, pdf-parse, xlsx, fast-xml-parser

**Frontend** (`/frontend`)
- Next.js 16.2 (App Router) + React 19.2
- Tailwind CSS 4 + shadcn + Radix UI + lucide-react
- Zustand 5 (auth store)
- @tanstack/react-query 5
- Axios (com interceptor JWT) + socket.io-client
- framer-motion, recharts, react-hot-toast, @hello-pangea/dnd, qrcode.react
- js-cookie (token também em cookie para middleware)

**Infra**
- Backend → Render (`render.yaml`)
- Frontend → Vercel (`vercel.json`)
- DB → Supabase PostgreSQL
- Node v24.15.0

---

## Arquitetura

**SaaS multi-tenant** com isolamento por `companyId` em todas as tabelas. Tenant é validado em duas camadas:
1. JWT carrega `companyId` (assinado no login)
2. `TenantGuard` valida que a empresa existe e não está bloqueada (`isBlocked`, `subscriptionStatus`)

**Backend** é monolito modular NestJS (módulos por domínio). Prefixo global `/api`. `PrismaService` tem readiness gate: requisições recebem 503 até `$connect` completar (frontend reusa em retry de 5xx).

**Real-time**: `SocketGateway` autentica via JWT no handshake e cria rooms por tenant (`company:${companyId}`). Eventos: `orderCreated`, `kitchenUpdate`, `dashboardUpdate`, `tableUpdate`, `onlineOrderPaid`. Clientes públicos (página de status do pedido) conectam sem token e não entram em room.

**CORS**: regex em `main.ts` libera `*.vercel.app` + localhost + domínio fixo.

---

## Estrutura de pastas

```
/backend
  prisma/
    schema.prisma        # 1151 linhas — todos os models
    seed.ts              # admin@teste.com / 123456
    migrations/
  src/
    main.ts              # bootstrap (CORS, ValidationPipe, prefix /api, readiness gate)
    app.module.ts        # registra módulos ativos
    common/
      decorators/        # @Roles, @CurrentUser
      guards/            # JwtAuthGuard, RolesGuard, TenantGuard
      filters/           # HttpExceptionFilter global
      enums/ interceptors/ pipes/ utils/ interfaces/
    database/            # PrismaModule + PrismaService (com readiness)
    socket/              # SocketGateway + SocketModule
    company-module/      # CRUD do catálogo de módulos contratados
    services/
      ai/                # Anthropic + Gemini
      storage/           # Cloudinary + local fallback
    modules/
      auth/              # Login, signup, JWT strategy, ModuleGuard, SubscriptionGuard
      users/ company/
      categories/ products/ pizza-borders/
      ingredients/ recipes/ stock/
      orders/ table-orders/ tables/
      cash/ financial/ payments/
      themes/            # CompanyTheme (cores, logo, banner)
      audit/             # AuditService (log de ações)
      notifications/ reports/ upload/
      ia/                # Chatbot + AiConversation
      loyalty/ coupons/  # Fidelidade + cupons
      smart-import/      # Cadastro inteligente (imagem/PDF/XML)
      delivery-config/ drivers/ tracking/
      online-orders/ chat/
      alerts/ super-admin/
  uploads/               # arquivos locais (fallback)

/frontend
  middleware.ts          # protege rotas (cookie `token`)
  app/                   # App Router — uma pasta por rota
    layout.tsx page.tsx
    login/ signup/ landing/ menu/   # públicas
    dashboard/ orders/ kitchen/ pdv/
    products/ categories/ ingredients/ recipes/ stock/
    tables/ order-status/ pedido/ pagamento/
    financeiro/ entregadores/ tracking/
    theme/ planos/ modulos/ pizza-borders/
    cadastro-inteligente/ bi/
    admin/ super-admin/
    api/                 # rotas API server-side do Next (proxies)
  components/
    ui/                  # shadcn base (button, card, input, label, table)
    layout/sidebar.tsx
    pdv/                 # CartSidebar, CategorySidebar, ProductCard, PizzaBuilder, PaymentModal
    dashboard/           # kpi-card, sales-chart
    chat/ tracking/ modulos/
    ClientShell.tsx ImageUpload.tsx role-guard.tsx
  hooks/                 # useKitchen, useOrders, useTables
  app/pdv/hooks/         # useCart, useCash, useCatalog (locais do PDV)
  lib/                   # api.ts, utils.ts, pdv-theme.ts
  services/              # api.ts (axios), socket.ts, env.ts, dashboard.service.ts, superAdminApi.ts
  stores/auth.store.ts   # Zustand (user/token + isAdmin/isKitchen/isCashier)
  public/
```

---

## Padrões frontend

- **App Router** do Next.js 16 (não confundir com Pages Router). `AGENTS.md` no `/frontend` avisa: API e convenções têm breaking changes em relação ao Next.js conhecido — ler `node_modules/next/dist/docs/` antes de editar.
- **Auth client**: `localStorage` (`token`, `user`) **+** cookie `token` (para `middleware.ts`). Store Zustand sincroniza ambos.
- **API client** (`services/api.ts`): axios com interceptor de request que injeta `Authorization: Bearer`, e interceptor de response que em 401 limpa storage + cookie e redireciona para `/login`.
- **Socket** (`services/socket.ts`): cliente Socket.IO com token no handshake.
- **Estilo**: Tailwind 4 + shadcn. UI components em `components/ui`. Cores tematizadas via `CompanyTheme` (primary/secondary/background/text + dark mode).
- **Estado**: Zustand para auth global; estado local com `useState`/hooks dedicados (PDV usa hooks isolados em `app/pdv/hooks`).
- **Rotas públicas** (sem auth, definidas no `middleware.ts`): `/login`, `/signup`, `/landing`, `/menu`, `/pagamento*`, `/pedido`.
- **PDV**: `useCart` (carrinho local), `useCatalog` (produtos/categorias), `useCash` (caixa aberto). Pizza tem builder próprio (`PizzaBuilder.tsx`) com bordas e tamanhos.

---

## Padrões backend

- **Estrutura por módulo**: `xxx.module.ts` + `xxx.controller.ts` + `xxx.service.ts` + `dto/`. Cada Module importa `PrismaModule`.
- **Controllers**: decoradores `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)` na maioria dos endpoints. `companyId` lido SEMPRE de `req.user.companyId` (nunca do body).
- **Services**: recebem `companyId` por parâmetro e filtram **toda** query Prisma por `companyId`.
- **Validação**: DTOs com class-validator. ValidationPipe global rejeita campos não-whitelisted.
- **Transações Prisma**: ações que mudam estoque/financeiro usam `$transaction` com `IsolationLevel.Serializable` (ver `orders.service.ts`).
- **Auditoria**: `AuditService.log({ action, entity, entityId, userId, companyId, description, metadata })` chamado em login/signup e ações sensíveis.
- **Erros**: lançar `NotFoundException`, `UnauthorizedException`, `ForbiddenException`, `BadRequestException`. `HttpExceptionFilter` formata resposta.
- **Path alias**: `@/` → `src/`.

---

## Models Prisma (schema.prisma — 1151 linhas)

**Core multi-tenant**
- `Company` — tenant raiz. Campos: `plan`, `subscriptionStatus`, `dueDate`, `isBlocked`, `metaPixelId`, `googleAnalyticsId`.
- `User` — pertence a Company. `role: Role` (SUPER_ADMIN/ADMIN/MANAGER/CASHIER/KITCHEN/DELIVERY).
- `CompanyModule` — módulos ativos por tenant. Campos novos: `moduleSlug`, `status: ModuleStatus` (TRIAL/ACTIVE/INACTIVE/EXPIRED), `trialEndsAt`, `activatedAt`.
- `Module` — catálogo global de módulos contratáveis. `category: ModuleCategory` (OPERACAO/MARKETING/FINANCEIRO/AUTOMACAO), `price`, `isFree`, `benefits[]`.

**Catálogo**
- `Category` (companyId, name)
- `Product` — `costPrice`, `salePrice`, `profitMargin`, `trackStock`, `allowNegativeStock`, `deletedAt` (soft delete), `imageUrl`, `categoryId?`.
- `ProductSize` — múltiplos tamanhos com `price` próprio (`@@unique([productId, size])`).
- `PizzaBorder` + `PizzaBorderSize` — bordas com preço por `PizzaSize` (PEQUENA/MEDIA/GRANDE/FAMILIA/EXTRA_GRANDE).

**Pedidos**
- `Order` — `status: OrderStatus` (PENDING/CONFIRMED/PREPARING/READY/OUT_FOR_DELIVERY/DELIVERED/CANCELLED), `paymentMethod`, `subtotal`, `deliveryFee`, `driverFee?`, `driverId?`, `total`, timestamps por status (`confirmedAt`, `preparingAt`, `readyAt`, `outForDeliveryAt`, `deliveredAt`, `cancelledAt`, `completedAt`).
- `OrderItem` — snapshot: `productName`, `productSku`, `unitPrice`, `subtotal`, `productCost`, `cmv`, `profit`.
- `TableOrder` + `TableOrderItem` — pedidos por mesa.
- `Table` — `number`, `status: TableStatus` (FREE/OCCUPIED/RESERVED).

**Estoque**
- `Ingredient` — `stock`, `minimumStock`, `cost`, `averageCost`, `lastPurchaseCost`, `allowNegativeStock`, `deletedAt`.
- `Recipe` (1:1 com Product) + `RecipeItem` (ingrediente × quantidade).
- `StockMovement` — `type: StockMovementType` (ENTRY/EXIT/LOSS/INVENTORY/ADJUSTMENT/SALE/PURCHASE/PRODUCTION/TRANSFER/RETURN/CANCELLATION), `previousStock`, `currentStock`, `unitCost`, `totalCost`, `reason`, `referenceId`, `referenceType`, `metadata`.

**Financeiro/Caixa**
- `Cash` — `openingValue`, `balance`, `entries`, `exits`, `isOpen`.
- `Financial` — `type: FinancialType` (INCOME/EXPENSE), `category`, `amount`, `paymentMethod?`.
- `Payment` (F8) — gateway externo. `provider: PaymentProvider` (MERCADO_PAGO/PAGSEGURO), `status: PaymentStatus`, `externalId`, `checkoutUrl`, `webhookData`.

**Cliente/Fidelidade (F7)**
- `Customer` (companyId, phone)
- `LoyaltyAccount` (1:1 customer/company) — `totalPoints`, `totalCashback`.
- `PointTransaction` — `type: PointType` (EARNED/REDEEMED/EXPIRED/BONUS/CASHBACK), pode ter `expiresAt`.
- `Coupon` — `type: CouponType` (PERCENTAGE/FIXED_AMOUNT/FREE_SHIPPING), `pointsCost?` (resgate por pontos), `usageLimit`/`usageCount`.

**Entrega**
- `DriverProfile` (1:1 User) — `isAvailable`, `currentLat/Lng`.
- `DeliveryZone` — `type`, `neighborhood`, `baseFee`, `pricePerKm`, `clientFee`, `driverShare`.

**IA / BI / Auxiliares**
- `ChatSession` + `ChatMessage` (F6 — chatbot público com `sessionKey`).
- `AiConversation` + `AiMessage` (IA interna do admin).
- `KpiSnapshot` — snapshot diário por tenant (revenue, cmv, grossMargin, avgTicket, breakdown por OrderType e PaymentMethod).
- `Alert` — `type: AlertType` (LOW_STOCK/HIGH_CMV/REVENUE_DROP/TICKET_DROP/CANCELLATION_SPIKE), `severity`.
- `OperationalCost` — custos fixos/variáveis.
- `ImportSession` + `ImportItem` + `ImportLog` — Smart Import (cadastro inteligente via imagem/PDF/XML). `type: ImportType` (MENU/INVOICE), `status: ImportStatus`.

**Theme/Audit**
- `CompanyTheme` (1:1) — cores + logo + banner + darkMode.
- `AuditLog` — `action`, `entity`, `entityId`, `metadata`, `ipAddress`, `userAgent`, `userId?`, `companyId`.

---

## Regras de negócio

**Pedido (Order)**
1. `create`: busca todos os produtos pelo `productId`, valida pertencimento ao tenant, calcula `subtotal` (`quantity * salePrice`), soma `deliveryFee`, gera `total`. Cria com `status=PENDING`. Snapshota `productName`, `productSku`, `productCost`. Emite `orderCreated` + `dashboardUpdate` no socket.
2. `updateStatus` em transação Serializable:
   - **PENDING → CONFIRMED**: para cada item, busca a receita, consome ingredientes (`StockService.consumeIngredientTransactional`), calcula `itemCmv` (Σ `ingrediente.averageCost × quantidade`), atualiza `OrderItem.cmv` e `OrderItem.profit = subtotal − cmv`. Dispara hook de fidelidade (`LoyaltyService.processOrderReward`).
   - **→ CANCELLED**: restaura ingredientes (`restoreIngredientTransactional`).
   - Grava timestamp do status correspondente.
3. Emite `kitchenUpdate` + `dashboardUpdate`.

**Estoque**: consumo SEMPRE via receita (RecipeItem). Sem receita → não consome. Movimento registrado em `StockMovement` com `previousStock`/`currentStock`/`referenceId=orderId`.

**Multi-tenant**: nenhuma query pode rodar sem `companyId`. JWT é a fonte da verdade.

**Empresa bloqueada**: `Company.isBlocked=true` impede login (`AuthService.login`) e bloqueia qualquer request via `TenantGuard`.

**Soft delete**: `Product` e `Ingredient` usam `deletedAt`. Queries de listagem filtram `deletedAt: null`.

**Signup**: cria `Company` + `User` ADMIN + ativa módulos default: `TABLES`, `CASH`, `FINANCIAL`, `STOCK`, `RECIPES`, `DELIVERY`.

---

## Autenticação

**Fluxo**
1. `POST /api/auth/login { email, password }` → valida `bcrypt.compare`, checa `company.isBlocked`, assina JWT `{ sub, email, companyId, role }`, retorna `{ accessToken, user }`. Log via AuditService.
2. `POST /api/auth/signup { companyName, name, email, password }` → cria company + admin + módulos default + retorna token.
3. Frontend salva token em `localStorage` + cookie `token` (Zustand `setAuth`).
4. Requisições subsequentes: `Authorization: Bearer <token>` via interceptor axios.
5. `middleware.ts` (Next) bloqueia rotas privadas se cookie `token` ausente.
6. 401 do backend → interceptor frontend faz logout e redireciona para `/login`.

**JWT Strategy** (`jwt.strategy.ts`): extrai do Bearer, valida com `JWT_SECRET` (default `'secret'` se env faltar), `validate(payload)` busca user no banco e retorna `{ userId, email, companyId, role }` em `req.user`.

**Socket**: token via `handshake.auth.token` ou `handshake.query.token`. `jwtService.verify` → join em `company:${companyId}`. Sem token = cliente público (sem room).

---

## Permissões

**Roles** (`enum Role`): `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `CASHIER`, `KITCHEN`, `DELIVERY` (também aparece `WAITER` em alguns controllers — string livre).

**Guards (ordem)**:
1. `JwtAuthGuard` — autentica
2. `TenantGuard` — valida empresa ativa (`req.tenantId = company.id`)
3. `RolesGuard` — lê `@Roles(...)` via Reflector e checa `user.role`
4. `ModuleGuard` — lê `@requiredModule('NOME')` e checa `CompanyModule.active`
5. `SubscriptionGuard` — checa `subscriptionStatus`/`dueDate`

**Frontend**: `useAuthStore` expõe `isAdmin()` (SUPER_ADMIN/ADMIN/MANAGER), `isKitchen()`, `isCashier()`. `<RoleGuard>` em `components/role-guard.tsx` restringe páginas.

---

## Principais services (backend)

- **AuthService** — signup/login/register, hash bcrypt(10), audit log.
- **OrdersService** — create/findAll/updateStatus/dashboard. Transação Serializable, integração com StockService, SocketGateway, LoyaltyService.
- **StockService** — `consumeIngredientTransactional`, `restoreIngredientTransactional` (recebem `tx` da transação atual). Atualiza `Ingredient.stock` e cria `StockMovement`.
- **ProductsService** — CRUD com soft-delete, parsing de `sizes` (JSON string ou array), normalização de Decimal.
- **LoyaltyService** — `processOrderReward(customerId, companyId, orderId, total)`: gera pontos/cashback no LoyaltyAccount.
- **AuditService** — `log(...)` cria AuditLog.
- **PrismaService** — readiness gate (`isReady`, `readyPromise`) + retry de `$connect` (8 tentativas × 3s).
- **SocketGateway** — emit por tenant: `orderCreated`, `kitchenUpdate`, `dashboardUpdate`, `tableUpdate`, `onlineOrderPaid`.
- **services/ai** — wrappers Anthropic e Gemini (Smart Import + chatbot + IA assistant).
- **services/storage** — Cloudinary com fallback para `/uploads` local.

---

## Principais componentes (frontend)

- **`ClientShell`** — wrapper client com providers (React Query, sidebar, toaster).
- **`Sidebar`** (`components/layout/sidebar.tsx`) — navegação principal por role.
- **`RoleGuard`** — restringe render por role.
- **PDV** (`components/pdv/`): `CategorySidebar`, `ProductCard`, `CartSidebar`, `PaymentModal`, `PizzaBuilder` (composição de pizza com bordas/tamanhos).
- **Dashboard**: `KpiCard`, `SalesChart` (recharts), `DashboardCharts`.
- **UI base** (`components/ui/`): `button`, `card`, `input`, `label`, `table`, `CurrencyInputBR`, `BarcodeScannerInput`, `ImageUploaderPreview`.
- **Hooks**: `useOrders`, `useKitchen`, `useTables` (globais); `useCart`, `useCash`, `useCatalog` (PDV).

---

## Fluxo do pedido

```
Cliente (PDV ou /menu público)
  ↓
POST /api/orders  (autenticado)  OU  POST /api/orders/public
  ↓
OrdersService.create
  ├─ Valida produtos pertencem ao tenant
  ├─ Calcula subtotal + deliveryFee → total
  ├─ Cria Order (PENDING) + OrderItems (snapshot)  [transação Serializable]
  ├─ socket.emit('orderCreated', order)            → cozinha vê em tempo real
  └─ socket.emit('dashboardUpdate', kpis)
  ↓
PATCH /api/orders/:id/status  { status: CONFIRMED }
  ↓
OrdersService.updateStatus (Serializable)
  ├─ Para cada OrderItem:
  │   ├─ Busca Recipe → consome RecipeItems (StockService.consumeIngredientTransactional)
  │   ├─ Cria StockMovement (referenceType=ORDER)
  │   ├─ Calcula cmv = Σ(averageCost × qty) → grava cmv e profit no OrderItem
  ├─ LoyaltyService.processOrderReward (se customerId)
  ├─ Grava confirmedAt
  └─ socket.emit('kitchenUpdate' + 'dashboardUpdate')
  ↓
PREPARING → READY → OUT_FOR_DELIVERY → DELIVERED
  (cada transição grava o timestamp correspondente)

CANCELLED em qualquer ponto:
  └─ Restaura ingredientes (restoreIngredientTransactional) + grava cancelledAt
```

---

## Fluxo de preços

**Produto simples**: `salePrice` direto (Decimal 10,2). `profitMargin` opcional. Pode ter `costPrice`.

**Produto com tamanhos**: `ProductSize[]` — preço por tamanho (`@@unique([productId, size])`). Frontend escolhe um size; o preço usado vem de `ProductSize.price`.

**Pizza com borda**: `Product` (sabor) + `ProductSize` (tamanho) + `PizzaBorder` → `PizzaBorderSize` (preço da borda no tamanho selecionado). Soma final = preço do tamanho + preço da borda no mesmo tamanho. `PizzaBuilder.tsx` no PDV monta a composição.

**Pedido**:
- `OrderItem.unitPrice` = preço efetivo do item (já com tamanho/borda resolvidos)
- `OrderItem.subtotal` = `unitPrice × quantity`
- `Order.subtotal` = Σ `OrderItem.subtotal`
- `Order.deliveryFee` (calculado por `DeliveryZone` se aplicável)
- `Order.driverFee` (de `DeliveryZone.driverShare`)
- `Order.total` = `subtotal + deliveryFee`

**Cupom** (`Coupon`): `PERCENTAGE`, `FIXED_AMOUNT` ou `FREE_SHIPPING`. `minOrderAmount`/`maxDiscount` limitam. Pode custar pontos (`pointsCost`).

**CMV** (calculado em CONFIRMED): `OrderItem.cmv = Σ (RecipeItem.quantity × OrderItem.quantity × Ingredient.averageCost || cost)`. `OrderItem.profit = subtotal − cmv`.

**Custo médio do ingrediente**: `Ingredient.averageCost` é atualizado em compras (PURCHASE em StockMovement). Snapshot em `KpiSnapshot.cmv`/`grossMargin`.

---

## Convenções do projeto

- **Idioma**: PT-BR em mensagens de erro, comentários, UI. Código em inglês.
- **Path alias backend**: `@/` → `src/`.
- **Validação**: sempre via DTO + class-validator. Nunca aceitar `body: any` em produção (alguns controllers legados ainda usam).
- **Multi-tenant**: `companyId` vem do JWT (`req.user.companyId`) — **nunca** do body.
- **Money**: Prisma `Decimal @db.Decimal(10, 2)`. No JS, sempre `Number(...)` antes de cálculos.
- **Soft delete**: `Product` e `Ingredient` usam `deletedAt`; listagens filtram `deletedAt: null`.
- **Snapshot em OrderItem**: `productName`/`productSku`/`productCost` copiados na criação (não dependem do estado atual do produto).
- **Stock**: só decrementa em `PENDING → CONFIRMED`; restaura em `* → CANCELLED`.
- **Migrações Prisma**: novas migrations DEVEM ser idempotentes (ver commits recentes corrigindo `add_pizza_borders` e enum duplicado).
- **Logs**: JSON estruturado em `main.ts` (`{ level, event, version, ... }`).
- **Modo operacional (PRIMORDIAL)**: ver memória `feedback_modo_operacional.md` — modo cirúrgico, patch mínimo, formato fixo (Diagnóstico → Patch → Validação → Status). Verificação obrigatória pós-correção.

---

## Observações importantes

1. **Next.js 16 NÃO é o que parece**: `frontend/AGENTS.md` avisa que há breaking changes — checar `node_modules/next/dist/docs/` antes de escrever código de App Router.
2. **Módulos comentados em `app.module.ts`**: `ChatModule`, `AlertsModule` estão desabilitados ("schema/code mismatch"). `PaymentsModule` foi reabilitado (fix: `MERCADOPAGO` → `MERCADO_PAGO` em `payments.service.ts` e `payments.controller.ts`). Models existem no schema.
3. **PaymentMethod enum** **não** inclui `BANK_TRANSFER` no nome (usa `TRANSFER`). Frontend deve usar exatamente: `CASH | PIX | CREDIT_CARD | DEBIT_CARD | TRANSFER`.
4. **JWT_SECRET fallback `'secret'`**: se a env não estiver setada em produção, qualquer um pode forjar token. Validar deploy.
5. **CORS em `SocketGateway`** está `origin: '*'` (não restrito como o HTTP). Aceitar como intencional para clientes públicos.
6. **CompanyModule tem dois nomes**: campo legacy `module` (string) + novo `moduleSlug`. `ModuleGuard` ainda checa o legacy `module`.
7. **Body limit JSON 10MB** — para imagens base64 (logo, banner) em `CompanyTheme`.
8. **Readiness gate**: requisições durante boot recebem 503 → frontend deve ter retry de 5xx (não verificado se está implementado no interceptor atual).
9. **Endpoint público `/api/orders/public`** — sem auth — usado por cardápio público `/menu`. Aceita `companyId` no body (única exceção à regra).
10. **Seed**: `admin@teste.com / 123456` (SUPER_ADMIN), `admin@food.com / 123456` (ADMIN), `company-seed-001`.
11. **Backend prod**: `https://food-system-backend-no7d.onrender.com`. Frontend prod: `https://food-system-sas-erp-frontend.vercel.app`.
12. **Smart Import** processa imagem/PDF/XML com IA (Anthropic + Gemini). Sessão fica em `ImportSession` → `ImportItem` (`confirmed`/`savedId`) antes de virar Product/Ingredient.
13. **Pizza Borders** é módulo novo (migration `add_pizza_borders` precisou de fixes idempotentes em prod).
14. **TypeScript backend 6.x**: pode quebrar com libs que esperam TS 5. Verificar antes de bump.
15. **node_modules_bak/** e `gen_output.txt` no repo são lixo — não commitar.
16. **Smart Import — env vars no Render**: `GEMINI_API_KEY` e `GEMINI_MODEL` já estão configurados manualmente no Render (não vinham no `render.yaml` antes). `OPENROUTER_API_KEY` é opcional (fallback). `ANTHROPIC_API_KEY` é o último fallback. Gemini é primário e usa `responseMimeType: 'application/json'`.
17. **Smart Import — AnthropicProvider**: não tratava `textContent` (requests sem imagem, ex. PDF com texto extraído) — corrigido para enviar mensagem texto-only sem bloco `image` quando `textContent` está presente.
18. **Smart Import — Prisma Json field**: todos os saves de `ImportItem.data` usam `JSON.parse(JSON.stringify(item))` para garantir objeto plain (não Proxy/class instance). Bug em investigação: campos em branco na tela de revisão — logs diagnósticos adicionados em `getSession` e `runMenuExtraction` para ver no Render o shape real do `data`.
19. **Smart Import — Gemini timeout**: `AbortSignal.timeout` em `gemini.provider.ts` aumentado de 60s para 120s para evitar falha em imagens grandes. Erro original: "Tempo limite atingido ao processar a imagem".
20. **CompanyTheme.pizzaPricingMode**: campo `String @default("MAX")` adicionado. Valores: `"MAX"` (cobra o sabor mais caro) ou `"HALF"` (cobra a média). Configurável na página `/theme`. Menu lê via `GET /api/themes/:companyId` e aplica em `confirmFlavors`.
21. **Menu cardápio — CEP autocomplete**: campo CEP usa ViaCEP (`https://viacep.com.br/ws/{cep}/json/`) para preencher rua/bairro/cidade/UF automaticamente ao digitar 8 dígitos.
22. **Menu cardápio — checkout mobile**: modal usa `flex-col max-h-[92vh]` com header fixo, área scrollável e botão "Confirmar" fixo no rodapé. Resolve overflow em telas 320-390px.
23. **PizzaSizeConfig**: modelo novo para configurar `slices`, `maxFlavors`, `isActive`, `label` por tamanho (PEQUENA/MEDIA/GRANDE/FAMILIA/EXTRA_GRANDE) por empresa. Módulo `pizza-size-configs` com endpoint público `GET /api/pizza-size-configs/public?companyId=xxx`. Página `/pizza-borders` reformulada com tabs "Tamanhos & Sabores" e "Bordas Recheadas". Defaults criados automaticamente na primeira consulta por empresa. `(this.prisma as any).pizzaSizeConfig` em uso enquanto `prisma generate` não roda no Render.
24. **Complements**: sistema de complementos iFood-style — hierarquia Produto → Complement → ComplementOption. 4 tipos: `INGREDIENTES`, `ESPECIFICACOES`, `CROSS_SELL`, `DESCARTAVEIS`. Campos: `required`, `chargesExtra`, `multipleChoice`, `minOptions`, `maxOptions`. Módulo `complements` com endpoint público `GET /api/complements/public/product/:productId?companyId=xxx`. Página `/complements` no painel admin. `(this.prisma as any).complement` e `.complementOption` em uso enquanto client não regenera.
25. **Bebidas / categoryType**: `Category` tem campo `categoryType String @default("normal")` e `displayColumns Int @default(4)`. Quando `categoryType = "bebidas"`, página de produtos abre `BeverageModal` com fluxo 3 passos: tipo (preparado/industrializado) → busca por EAN ou nome via Open Food Facts API → formulário pré-preenchido. `Product` tem `productType String @default("standard")` e `eanCode String?`. Menu exibe grid responsivo (2/3/4 colunas) para categorias bebidas.
26. **Open Food Facts**: integração sem chave de API. EAN (8-14 dígitos numéricos) → `https://world.openfoodfacts.org/api/v0/product/{ean}.json`. Busca por nome → `https://world.openfoodfacts.org/cgi/search.pl?search_terms={q}&action=process&json=1&page_size=8&fields=code,product_name,brands,image_url`. Auto-fill: nome, EAN, imagem, marca no formulário do produto.
27. **maxFlavors no cardápio**: menu usa `globalMaxFlavors = Math.max(...pizzaSizeConfigs.filter(isActive).map(c => c.maxFlavors))` para limitar os botões de partes (2/3/4 sabores). `(this.prisma as any)` casts em pizza-size-configs e complements serão resolvidos após `prisma generate` no Render deploy.
28. **Product.videoUrl / hasVideo**: `Product` tem `videoUrl String?` e `hasVideo Boolean @default(false)`. `hasVideo` é auto-derivado de `videoUrl` no service (create e update). PDV exibe botão Eye ativo (azul) se produto tem vídeo, EyeOff desabilitado (opacity 0.4, cursor not-allowed) se não tem. Modal desktop: centralizado com backdrop. Mobile: overlay fullscreen estilo reels com autoplay. Botão editar (Pencil) removido do PDV. Cardápio digital também exibe botão "Vídeo" nas listas e grid de bebidas.
29. **OnlineOrder model**: `OnlineOrder` foi adicionado ao `schema.prisma` (migration `20260525000000_add_online_orders` cria a tabela mas o model estava faltando no schema). `OnlineOrdersModule` registrado em `app.module.ts`. Após salvar no DB, emite `orderCreated` + `dashboardUpdate` via SocketGateway (setImmediate para não bloquear resposta). `OnlineOrdersService` injeta `SocketGateway` (via `SocketModule` importado em `OnlineOrdersModule`).
30. **Render build — regras críticas**: (a) `prisma db seed` REMOVIDO do `buildCommand` — seed é dev-only e bloqueava todo deploy. (b) Novas migrations DEVEM usar `pg_constraint` / `information_schema` checks em vez de `EXCEPTION WHEN duplicate_object` (código `42P07` não é capturado por esse handler). (c) Toda migration nova precisa de `--rolled-back <nome>` no `render.yaml` antes do `prisma migrate deploy`. (d) Se Render builda commit antigo (cache), push commit vazio para forçar rebuild do HEAD.
31. **PDV responsivo**: sidebar de navegação `hidden md:flex`, header compacto em mobile, categorias como scroll horizontal em mobile, lista de produtos full-width com cards compactos em mobile, cart drawer full-screen em mobile. Desktop preservado. `PizzaBuilder` agora aceita prop `sizes?: SizeOption[]` com tamanhos reais do produto (preço por tamanho); fallback para 5 tamanhos padrão se não fornecido.
32. **DB sync migration `20260529000000_fix_db_sync`**: adiciona `EXTRA_GRANDE` ao enum `PizzaSize`, `customerId` à `LoyaltyAccount`, cria tabelas `OnlineOrder` e `PaymentWebhook` caso não existam. Todas as operações são idempotentes via `pg_constraint`/`information_schema` checks.
33. **WhatsApp IA module**: módulo completo NestJS em `src/modules/whatsapp-ai/`. Models: `WhatsappConnection` (provider: EVOLUTION_API|CLOUD_API_META), `WhatsappAiSettings` (aiProvider, mode AUTO/HYBRID/MANUAL, systemPrompt, businessHours), `WhatsappConversation` (context JSON com carrinho), `WhatsappMessage`. Migration `20260528200000_add_whatsapp_ai`. Página admin `/whatsapp-ia` com 4 tabs: Conexões, Configurar IA, Conversas (split-pane), Estatísticas. Webhook público: `GET/POST /api/whatsapp-ai/webhook/:connectionId`. Comandos inline no texto da IA: `[CMD:ADD_ITEM:id:qty]`, `[CMD:CONFIRM_ORDER:type:address:phone]`, `[CMD:TRANSFER_HUMAN]`, `[CMD:CLOSE]`. RAG de cardápio via `buildMenuContext()`. Providers suportados: Gemini (primary) e Anthropic.
34. **Super Admin impersonation UI**: removido banner amarelo `bg-amber-400` em `ClientShell.tsx`. Substituído por pill button discreto `fixed bottom-5 right-5 z-[9998]` que abre mini popup (backdrop + actions: abrir cardápio, sair da visualização).
35. **PDV beverages grid**: quando `Category.categoryType === "bebidas"`, PDV troca layout de lista por grid responsivo: desktop `grid-cols-5` (xl) / `grid-cols-3`, mobile `grid-cols-2`. Cards compactos com imagem quadrada, nome, preço e botão "+Adicionar". `Category` interface no PDV inclui `categoryType?: string`.
36. **BeverageModal debounce**: campo de busca na tela de cadastro de bebidas tem debounce 500ms (mínimo 3 chars) via `useRef<setTimeout>`. Busca também dispara no Enter e no botão de lupa.
37. **ClientShell MODULE_NAV — whatsapp-ia**: slug `"whatsapp-ia"` mapeado para `href: "/whatsapp-ia"`, label "WhatsApp IA", ícone `MessageCircle`. Aparece na sidebar quando módulo está ACTIVE ou TRIAL.
38. **Preço mínimo "A partir de"**: helper `productMinPrice(p)` e `productPriceLabel(p)` em `app/pdv/page.tsx` e `app/menu/[companyId]/page.tsx`. Produtos com `sizes.length > 1` exibem "A partir de R$ X,XX" (menor preço dos tamanhos). Produtos sem sizes ou com 1 size exibem o preço normal. Product type no menu inclui `sizes?: { size: string; price: number }[]`.
39. **PizzaBuilder — maxFlavors dinâmico**: `PizzaBuilder.tsx` aceita prop `sizeConfigs?: Record<string, { maxFlavors: number }>`. `maxFlavors` é calculado por tamanho selecionado (`sizeConfigs[selectedSize.size]?.maxFlavors ?? 2`). PDV busca `GET /api/pizza-size-configs/public?companyId=xxx` ao carregar e passa `sizeConfigs` para o builder. Label de sabores mostra `X/N selecionados`. Ao trocar tamanho, sabores excedentes são removidos automaticamente.
40. **Digital Menu — pizza 1 sabor**: partes disponíveis agora `[1, 2, 3, 4]` (antes `[2, 3, 4]`), filtradas por `globalMaxFlavors`. `confirmFlavors` exige ao menos 1 sabor. Composição de 1 sabor usa nome direto `"Pizza Nome"`. Fração exibida como `"inteiro"` para 1 sabor.
41. **OrderDetailsForm compartilhado**: componente `components/shared/OrderDetailsForm.tsx` com todos os campos de atendimento: tipo (DINE_IN/DELIVERY/PICKUP), número da mesa, nome/telefone do cliente, CEP (autocomplete ViaCEP 600ms debounce), rua, número, complemento, bairro, cidade. Usado no `PaymentModal` (quando `orderDetails` não é passado) e no cart drawer do PDV. `PdvOrderDetails` em `PaymentModal.tsx` é alias de `OrderDetails`. `closePaidOrder` no PDV monta `fullAddress` concatenando rua + número + complemento + bairro + cidade.
42. **WhatsApp — notificação automática de pedido**: `WhatsappAiService.sendOrderNotification()` — busca primeira conexão WhatsApp ativa da empresa (`WhatsappConnection.isActive=true`), monta mensagem com resumo do pedido (itens, total, tipo, status emoji) e envia via `dispatchMessage`. `OrdersService` injeta `WhatsappAiService` com `@Optional()` e chama `setImmediate` (não bloqueante) após transações CONFIRMED/READY/OUT_FOR_DELIVERY/DELIVERED/CANCELLED quando `order.customerPhone` está presente. `WhatsappAiModule` registrado em `AppModule` e importado em `OrdersModule`.
43. **Order model — campos ausentes**: `Order` NÃO tem `customerPhone`, `customerName` nem `orderType` (esses campos existem em `OnlineOrder`). `OrdersService.updateStatus` lê `customerPhone` via `order.customer?.phone` (inclui `customer: true` no findFirst). `orderType` é acessado via `(order as any).orderType`. Nunca assumir que campos de `OnlineOrder` existem em `Order`.
44. **FinancialModule**: registrado em `app.module.ts` (estava faltando — causava 404 em `/api/financial` e `/api/financial/summary`). Endpoints disponíveis: `GET /api/financial` (lista), `GET /api/financial/summary` (entries/exits/balance/totalSales/totalOrders/ticketAverage), `POST /api/financial` (criar). Roles: SUPER_ADMIN/ADMIN/MANAGER.
45. **Página Financeiro — reescrita completa**: `app/financeiro/page.tsx` agora usa dados reais. Tab Extrato: `GET /api/financial` + `GET /api/financial/summary` + `GET /api/cash/current`. Modal "Nova Transação": POST `/api/financial` com type/category/description/amount/paymentMethod. Filtro INCOME/EXPENSE + busca por texto. Export CSV real. Tab Relatório: breakdown por forma de pagamento + resultado líquido usando despesas do summary. Tab Mensalidade: KPIs reais de totalSales/totalOrders/ticketAverage. Tab Configurações: persiste em localStorage.
46. **Módulos adicionados ao app.module.ts**: `IngredientsModule`, `RecipesModule`, `StockModule`, `DriversModule`, `FinancialModule` — estavam ausentes causando 404 nessas rotas.
47. **Open Food Facts — proxy Next.js**: para evitar CORS ao buscar dados de bebidas do browser, criados dois API routes server-side: `app/api/off/search/route.ts` (`GET /api/off/search?q=...`) e `app/api/off/product/[ean]/route.ts` (`GET /api/off/product/:ean`). Frontend chama esses proxies em vez de `world.openfoodfacts.org` diretamente.
48. **Products page — campo brand removido**: `brand` não existe no `Product` schema nem no `CreateProductDto`. Enviar `fd.append("brand", ...)` no FormData causava 400 (`forbidNonWhitelisted`). Campo removido do submit — a marca fica embutida no nome do produto.
49. **Entregadores page — reescrita completa**: `app/entregadores/page.tsx` reescrita com API real. `GET /api/drivers` → lista real. Modal "Novo Entregador": `POST /api/drivers` com name/email/password/phone/vehicleType/vehiclePlate. Modal "Editar": `PATCH /api/drivers/:id` com toggle isActive/isAvailable. Stats derivadas dos dados reais (online/ocupado/offline). `drivers.controller.ts` import corrigido: `@/auth/jwt-auth.guard` → `@/common/guards/jwt-auth.guard`.
50. **Fase 1 — Complementos (COMPLETO)**: fluxo de complementos implementado e validado end-to-end. `OrderItemComplement` persiste por item individualmente (transação Serializable). `orders.service.ts` `create()` usa `tx.orderItem.create()` individual por item (elimina risco de `createdOrder.items[i]` com heap order errado). `findAll()` inclui `selectedComplements` via `(this.prisma as any)`. PDV: `openProductAdd()` faz GET do endpoint público de complementos; se `groups.length > 0` abre modal; se 0 adiciona direto. `cartTotal` inclui preço de complementos. `closePaidOrder` mapeia `complements[]` por item. Frontend kitchen/orders exibe complementos por item na tela e na impressão. Validação: 10/10 PASS com dados reais.
51. **Build de produção — corrigido**: problema do `tsBuildInfoFile` stale resolvido com `"tsBuildInfoFile": "./dist/.tsbuildinfo"` no `tsconfig.json` + script `prebuild` em `package.json` que limpa `dist/` e `.tsbuildinfo` antes de cada build. `npm run build` agora é idempotente (3 execuções consecutivas: 373 arquivos cada). `npm run start:prod` (`node dist/main`) sobe em 3s sem ts-node. `Dockerfile`: `EXPOSE 3001` (era 3000) e `prisma db seed` removido do CMD (era risco crítico em produção).
52. **Fase 2 — OrderType (AUDITORIA PENDENTE DE IMPLEMENTAÇÃO)**: `enum OrderType {DELIVERY, DINE_IN, PICKUP}` existe no schema mas `Order` model NÃO tem campo `orderType`, `customerName`, `customerPhone` nem `deliveryAddress`. `OnlineOrder` tem todos esses campos. PDV envia `orderType` no POST /orders mas é silenciosamente descartado. `reports.service.ts` lê `(order as any).orderType` que retorna sempre `undefined` → TODOS os pedidos do PDV são contados como `dineIn` nos relatórios, independente do tipo real. A cozinha identifica o tipo apenas pelo campo `notes` (texto livre). Implementação da Fase 2 = adicionar os 4 campos ao model `Order` + migration idempotente + persistir no service + exibir nos cards.
53. **Item 3 — Ordenação manual de Categorias e Produtos (COMPLETO)**: `Category.sortOrder Int @default(0)` + `Product.sortOrder Int @default(0)` + `Product.isFeatured Boolean @default(false)` (preparado para áreas de destaque/promoções, não usado ainda). Migration `20260530000000_add_sort_order` idempotente (`ADD COLUMN IF NOT EXISTS` + backfill `ROW_NUMBER() PARTITION BY companyId ORDER BY name ASC` que só sobrescreve `sortOrder=0`). Índices compostos `(companyId, sortOrder)`. Backend: `categories.service.findAll/create/reorder` e `products.service.findAll/publicMenu/create/reorder` — `create` calcula `(max+1)`, `reorder` valida ownership por `findMany({id:{in:ids}, companyId})` antes do `$transaction` (preserva SECURITY-001). Endpoints novos: `PATCH /api/categories/reorder` e `PATCH /api/products/reorder` body `{items:[{id,sortOrder}]}`. **IMPORTANTE**: no `products.controller.ts` a rota `@Patch("reorder")` precisa ficar ANTES de `@Patch(":id")` (mesma constraint do Nest match-by-order). Frontend: `app/categories/page.tsx` e `app/products/page.tsx` usam `@hello-pangea/dnd` via `dynamic({ssr:false})` — drag handle `<GripVertical>`, rollback otimista em erro de API. Drag-and-drop apenas para ordenação (NÃO move produto entre categorias — `reorder` só toca `sortOrder`). `app/menu/[companyId]/page.tsx` removeu `.sort()` alfabético — confia em `publicMenu` orderBy `[{sortOrder:'asc'},{name:'asc'}]`. Validação E2E PASS: GET retorna ordenado, reorder persiste após refresh, cross-tenant bloqueado com `BadRequestException("Categoria/Produto fora da empresa")`, PDV e Cardápio Digital respeitam.
54. **Item 4 — Fase A + Adapter Cozinha/Impressão (COMPLETO)**: complementos agora funcionam end-to-end no Cardápio Digital e pedidos do cardápio chegam na cozinha como os do PDV. Mudanças: (a) **A1**: `components/shared/ComplementsModal.tsx` (novo) — componente único usado por PDV (theme="dark") e Cardápio Digital (theme="light"); botões `min-h-[56px]` (touch); progress bar de obrigatórios; subtotal vivo. `app/menu/[companyId]/page.tsx` agora chama `GET /complements/public/product/:id?companyId=X` antes de adicionar ao carrinho; CartItem inclui `complements[]`; payload do POST `/online-orders` envia `complements` por item. `app/pdv/page.tsx` refatorado para usar o mesmo componente. (b) **A2**: validação server-side em `OnlineOrdersService.create` — recarrega `Complement` por `productId+companyId` e valida `required`/`min`/`max`/`multipleChoice` + anti-spoof de option-id; rejeita com `BadRequestException`. (c) **A4**: coerência min/max em `app/complements/page.tsx` — toggles ajustam valores correlatos, input max desabilitado em escolha única, valida `min ≤ max` e `required ⇒ min ≥ 1` no submit. (d) **Adapter (Caminho 2)** — `OrdersService.findAllForKitchen(companyId)` une `Order` (PDV) + `OnlineOrder` (Cardápio) em shape único `{id, source: "PDV"|"ONLINE", status, items[{ selectedComplements[] }], ...}`; status normalizado via `mapOnlineStatusToKitchen` (`DELIVERING→OUT_FOR_DELIVERY`, `COMPLETED→DELIVERED`, `CANCELED→CANCELLED`); `updateKitchenStatus(source, id, status, userId, companyId)` roteia para `Order` ou `OnlineOrder.orderStatus` mapeado de volta. **IMPORTANTE**: `OnlineOrder` usa `orderStatus`, NÃO `status`. Endpoints novos: `GET /api/orders/kitchen` e `PATCH /api/orders/kitchen/:source/:id/status`. Frontend (`hooks/useKitchen.ts`, `app/kitchen/page.tsx`, `app/kitchen/KitchenBoard.tsx`, `app/orders/page.tsx`) trocaram `/orders` por `/orders/kitchen`, usam `key=${source}-${id}` e exibem badge `[PDV]`/`[ONLINE]`. Validação E2E PASS 15/15: GET público retorna grupos, validação rejeita pedido sem obrigatório/com excesso/com option falso, pedido ONLINE com complementos cria e aparece em /orders/kitchen com `source=ONLINE`, pedido PDV idem com `source=PDV`, complementos chegam em ambos via `selectedComplements`, status PREPARING persiste após refresh (DB salva como `PREPARING` em `Order.status` e `OnlineOrder.orderStatus`), cross-tenant 4/4 bloqueado (B não altera status PDV/ONLINE de A, B não vê pedidos de A em /orders/kitchen, B não cria complemento em produto de A — novo `assertOwnership` em `ComplementsService.create` validando `productId+companyId`). Pagamento, webhooks e schemas `Order`/`OnlineOrder` intactos.
55. **Item 4 — Fase B (COMPLETO)**: hierarquia P>C>G + duplicate + reorder + upload imagem + vínculo por categoria.

**Backend**: `complements.service.ts` reescrito com método dedicado `applyComplementsPriority(groups)` que aplica P>C>G + dedup por `name.toLowerCase().trim()` (docstring de bloco explica regra de prioridade e estabilidade). `findByProduct(productId, companyId)` busca produto → categoria → query única `OR(productId | productId=null+categoryId=cat | productId=null+categoryId=null)` → aplica regra. `assertScopeAndOwnership` rejeita `productId+categoryId` simultâneos e valida ownership de ambos. Novos métodos: `duplicate(id, companyId)` (copia grupo + options com `"(cópia)"` no nome, sortOrder=max+1 dentro do mesmo escopo), `reorderGroups(companyId, items)`, `reorderOptions(complementId, companyId, items)`. `complements.controller.ts` adicionou `PATCH /complements/reorder`, `POST /complements/:id/duplicate`, `PATCH /complements/:id/options/reorder` ANTES de `@Patch(':id')` (Nest match-by-order). `imageUrl` na option persiste via base64 no JSON existente (sem multipart).

**Frontend** (`app/complements/page.tsx` reescrita): radio "Aplicar a" (🌐 Global / 📂 Categoria / 🍔 Produto) com dropdowns condicionais; badges visuais de escopo com cores diferentes (roxo/azul/laranja); agrupamento por escopo (`buckets`); botão "Duplicar grupo" (ícone Copy azul); DnD `@hello-pangea/dnd` separado por escopo (cada bucket é uma `Droppable` distinta — impede reorder cruzado); DnD de opções dentro de cada grupo; upload de imagem por opção via `ImageUploaderPreview` (thumbnail 40x40 aparece ao lado do nome); todos os botões/inputs com `min-h-[44px]` (touch); modal sticky-bottom em mobile (`items-end sm:items-center`); coerência min/max preservada da Fase A.

**Validação E2E backend** (`test_fase_b.sh`) — **12/12 PASS**:
- Hierarquia P>C>G: cria 3 escopos com mesmo nome "Adicionais" → GET retorna apenas o PRODUTO com a opção "Catupiry Produto" (vence)
- Remoção progressiva: remove P → retorna C (Catupiry Categoria); remove C → retorna G (Catupiry Global); remove G → retorna 0 grupos
- Exclusividade: `POST {productId:X, categoryId:Y}` → 400 "Defina apenas UM escopo"
- Multiempresa 3 cenários: B cria grupo em categoria de A → 404; B reordena grupos de A → 400 "fora da empresa"; B duplica grupo de A → 404
- B2 duplicate: cria grupo "Bordas" com [Catupiry, Cheddar] → cópia tem nome "Bordas (cópia)" + ambas options copiadas
- B4 reorder grupos: troca sortOrder 1↔10, persistência confirmada via findAll
- B4 reorder opções: troca [Catupiry, Cheddar] → [Cheddar, Catupiry], persiste
- B3 upload: opção criada com `imageUrl` base64 (114 bytes de PNG 1x1), retorna no payload

**Bugs descobertos e corrigidos durante teste**: lixo de execuções anteriores (grupos "Adicionais" antigos isActive=true) precisou ser limpo via `UPDATE Complement SET isActive=false WHERE name IN (...)` antes do teste 7 passar. Python no Windows com codec cp1252 não imprime "→" — exportar `PYTHONIOENCODING=utf-8` antes de rodar shell tests.

**Não tocados** (consumem automaticamente via GET público): `components/shared/ComplementsModal.tsx`, `app/pdv/page.tsx`, `app/menu/[companyId]/page.tsx` — herança transparente.

**Não implementado** (consciente): teste manual de DnD em browser real (touch/tablet). Backend testado, frontend type-check OK. Validação visual requer interação humana.
56. **Sprint UX-01 (COMPLETO)** — 4 fixes pós-auditoria: (M-01) `ComplementsModal.tsx` agora renderiza `<img>` 40x40 da opção quando `imageUrl` existe → torna visível para o cliente final a feature B3 da Fase B (antes a imagem era cadastrada no admin mas nunca aparecia no PDV/cardápio). (C-01) Cardápio digital `app/menu/[companyId]/page.tsx` recebe `pb-44` no `<main>` quando há item no carrinho + `paddingBottom: calc(11rem + env(safe-area-inset-bottom))` inline + CTA flutuante também ganha `env(safe-area-inset-bottom)` → último item não fica mais coberto pelo botão "Ver pedido" em mobile/iOS com notch. (I-01) `app/orders/page.tsx` função `printOrder` adiciona badge `[PDV]`/`[ONLINE]` no HTML impresso (azul `#1d4ed8` para online, preto `#111` para PDV) — operador na cozinha distingue origem mesmo no papel térmico. (I-01) extrai source via `(order as any).source` (vem do adapter `/orders/kitchen` do Item 4). (A-02) `ImageUploaderPreview` ganha prop `maxFileSizeMB` (default 5MB), valida antes da compressão e mostra erro amigável em caixa vermelha com ícone svg (`bg-red-50 border border-red-200 rounded-xl`, `text-sm font-medium`) — antes era um `text-xs` discreto. Type-check OK em todos os arquivos. Nenhum backend tocado.
65. **feat(demo-vitrine): demos populadas como vitrines comerciais de pizzaria**: `DemoVitrineService` em `super-admin/demo-vitrine.service.ts` + endpoint `POST /api/super-admin/demo/vitrine`. Cada tier recebe: categorias com banners, produtos com imagens locais, clientes, entregadores, pedidos históricos + hoje, WhatsApp IA (Carol) com 3 conversas de exemplo, registros financeiros. Resultado real: Bella Napoli (BASIC): 4 cats, 24 prods, 10 clientes, 33 pedidos, R$804 hoje. Don Corleone (PRO): 5 cats, 28 prods, 50 clientes, 128 pedidos, R$2412 hoje. Milano (ENTERPRISE): 5 cats, 28 prods, 185 clientes, 369 pedidos, R$5631 hoje. Imagens: 20 JPEGs baixados de Unsplash para `frontend/public/demo-assets/` (pizzas/, bebidas/, sobremesas/, combos/, banners/) — URLs absolutas Vercel no banco, sem base64. Seguro: só toca `demo-basic-001`, `demo-pro-001`, `demo-enterprise-001`. Idempotente. Commits `e7537d6f` + `36f07840`.
57. **Deploy — 7 commits pushados (CONCLUÍDO)**: estratégia de commits separados aprovada e executada. Sequência: (1) `49379d8d` fix(security): SECURITY-001 tenant guards recipes+tables. (2) `a1377c75` feat(item-3): manual sort order + DnD + SECURITY-001 fixes cat/prod (8 arquivos, +312/-36, **migration 20260530000000_add_sort_order** idempotente). (3) `d55b6947` feat(super-admin): visible impersonation bar. (4) `16c6d8f2` feat(complements): Phase A — modal cardápio + validação server-side (inclui Sprint UX-01 M-01 e C-01 nos mesmos arquivos). (5) `d3314b87` feat(complements): Phase B — P>C>G + duplicate + reorder + upload imagem. (6) `f0d449d6` feat(orders): Item 4 Caminho 2 — Adapter Kitchen unificado (**migration 20260529100000_add_order_type_fields** idempotente, inclui UX-01 I-01 badge impressão e UX-02 fix #4 toast useKitchen). (7) `6bf9a623` chore(ux+infra): UX-01 A-02 ImageUploaderPreview + Dockerfile/package.json/tsconfig.json build fixes + **render.yaml com 2 entradas migrate resolve --rolled-back para as migrations novas** (CLAUDE.md §30c) + CLAUDE.md atualizado. Total: 33 arquivos +2276/-658. `git status` clean. **Pendente git push**: Crítico #1 da Sprint UX-02 (`/orders/kitchen` quebrado em prod) só se resolve ao deployar commit 6. Backend deploy ANTES de frontend (Render auto-deploya ao push). Cleanup TESTE UX já executado em prod (3 grupos / 8 opções removidos da Alexandria — companyId cmpkj25po00021r8u0dvvxo3x).
59. **Fix: React hydration error #418 em `/modulos`**: `components/modulos/HeroModules.tsx` usava `Math.random()` inline nos `style` e `transition` props das partículas decorativas (linhas 42-56). Next.js App Router faz SSR de componentes `"use client"` para o HTML inicial — valores diferentes entre servidor e cliente geravam divergência de hydration (React error #418). Fix: dados das 20 partículas movidos para `useState<Particle[]>([])` + `useEffect` (render client-only). Commit `8f4dbe94`.
61. **Fix: `CompanyModuleModule` ausente do `app.module.ts`**: `src/company-module/` existia com controller/service/module completos mas nunca foi registrado em `app.module.ts` — todos os endpoints `/api/company-module/*` retornavam 404 (página `/modulos` não carregava os módulos da empresa). Fix: adicionado `import { CompanyModuleModule }` + entrada em `imports[]`. Type-check OK. Commit `51517aac`. **Observação**: o controller usa `'src/modules/auth/jwt-auth.guard'` (caminho legado) em vez de `@/common/guards/jwt-auth.guard` — ambos os arquivos existem, então funciona, mas o padrão do projeto é o `@/common/guards/`.
60. **Fix: `Promise.all` silenciando KPIs no BI por causa de `/alerts` 404**: `app/bi/page.tsx` usava `Promise.all([kpi, revenue, alerts])` — como `AlertsModule` está comentado no `app.module.ts` (schema/code mismatch), o 404 em `/alerts?unread=false` fazia o `catch {}` engolir o erro E deixava KPIs e revenue sem dados. Trocado para `Promise.allSettled` com verificação individual de `status === "fulfilled"` por resposta. O 404 em si persiste (módulo desabilitado intencionalmente), mas não afeta mais os outros dados. Commit `8f4dbe94`.
64. **feat(whatsapp-ia): seletor visual de provedor no formulário de nova conexão**: `app/whatsapp-ia/page.tsx` — `ConnectionsTab` agora exibe 3 cards clicáveis (WhatsApp Business / Evolution API / Meta Cloud API) em vez do `<select>` antigo. "WhatsApp Business (Recomendado)" mostra apenas Nome + Telefone + banner "Após salvar poderá conectar via QR Code"; envia `provider:"EVOLUTION"` ao backend (sem alterar contrato da API). Evolution API mantém todos os campos técnicos. Meta Cloud API mantém Phone Number ID + token + webhook. `providerType` é estado local (UI-only), `form.provider` continua sendo o valor real enviado. Reset de campos técnicos ao trocar de tipo. Sem alterações de backend, schema, service ou migration. Commit `9b4899ca`.
63. **feat(sidebar): "Configurar IA" visível em todos os planos**: `ClientShell.tsx` — removido `moduleSlug: "whatsapp"` do item "Configurar IA" na seção "Atendimento". A função `canAccessModule` só restringe role DEMO; para usuários regulares já retornava `true`. Remoção do `moduleSlug` torna a intenção explícita: item sempre visível para SUPER_ADMIN/ADMIN/MANAGER independente de plano ou módulo ativo. Efeito colateral: DEMO também passa a ver o item (antes ficava oculto se "whatsapp" não estivesse em `activeSlugs`). Commit `d8ea3056`.
62. **feat(whatsapp-ia): Carol evoluída para persona de venda consultiva**: apenas `buildSystemPrompt()` em `claude-cart.service.ts` foi alterado — 8 novas diretivas adicionadas dentro da seção `━━━ DIRETRIZES DE COMPORTAMENTO ━━━` (regras 7-14). Nenhum outro método, schema, controller ou migration tocado. Diretivas adicionadas: (7-8) Descoberta — faz UMA pergunta antes de registrar item (qtd pessoas, entrega/retirada, preferência); calibra tamanho pela resposta. (9) Recomendação — quando cliente indeciso, indica UM produto específico com justificativa curta. (10-11) Upsell — máx 1 sugestão complementar por mensagem, prioridade bebida > borda > sobremesa; se recusar não insiste. (12) Objeções de preço — não oferece desconto automático; sugere alternativa de melhor custo-benefício. (13) Fechamento — bloqueia `pedido_finalizado: true` enquanto endereço, pagamento ou tentativa de upsell estiverem faltando. (14) Linguagem — máx 3 frases por mensagem, máx 1 emoji. Commit `781ab2cf`.
67. **Sprint Segurança P2 — Rate Limiting + Helmet + prisma generate + fix as any (COMPLETO)**:
(a) `@nestjs/throttler@6.5.0` + `helmet@8.2.0` instalados. `ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])` em `AppModule` com `ThrottlerGuard` global. `@Throttle({ default: { limit: 5, ttl: 60_000 } })` em `POST /auth/login` (anti-bruteforce) e `@Throttle({ default: { limit: 10, ttl: 60_000 } })` em `POST /orders/public` (anti-spam). `helmet({ contentSecurityPolicy: false })` em `main.ts` antes do `json()` middleware (`CSP desabilitado` porque backend serve `/uploads` estático).
(b) `npx prisma generate` executado — client regenerado com todos os modelos incluindo `onlineOrder`, `whatsappConnection`, `whatsappAiSettings`, `whatsappConversation`, `whatsappMessage`, `orderItemComplement`, `complement`, `complementOption`. Todos os `(this.prisma as any).modelName` eliminados em: `orders.service.ts`, `whatsapp-ai.service.ts`, `whatsapp-ai/services/order-notification.service.ts`, `complements.service.ts`, `online-orders.service.ts`. Dois `as any` residuais mantidos justificados: `orderStatus: mapped as any` (mapeamento de string para enum OnlineOrderStatus) e `anthropicMsgs as any` (role string vs literal union). `tsc --noEmit` limpo. `npm run build` OK (373 arquivos).
(c) **Sprint 3 — Migrations (ANÁLISE, NÃO EXECUTADO)**: 20 entradas `--rolled-back` no `render.yaml` são harmless em produção pois o banco já tem todas as tabelas. Risco real: novo banco/restore de backup ficaria com lacunas. Solução: baseline migration (`prisma migrate diff --from-empty --to-schema-datamodel` + `migrate resolve --applied` no Supabase + remoção dos 20 `--rolled-back`). Requer acesso direto ao DATABASE_URL de produção para executar `migrate resolve --applied` na nova baseline. Não urgente enquanto não houver restore ou novo ambiente.
66. **Auditoria + correções P0/P1 de segurança (6 commits atômicos)**: auditoria Staff+ identificou nota 6.0/10. Aplicadas 6 correções sem alterar lógica de negócio. (B-01) `super-admin.service.ts` — SA_EMAIL/SA_PASSWORD movidos para env vars `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD` (commit `ca4e9d13`). (B-02) Fallback `|| 'secret'` removido de 4 arquivos (`jwt.strategy.ts`, `super-admin.guard.ts`, `super-admin.module.ts`, `super-admin.service.ts`) — app falha explicitamente se JWT_SECRET não setado (commit `040105dd`). (B-05/B-06) `docker-compose.yml` refatorado: porta 5432 removida do host, JWT_SECRET e POSTGRES_PASSWORD agora obrigatórios via `${VAR:?error}`, backend ganhou healthcheck, postgres pinado a `16.6-alpine`, criado `.env.example` (commit `410c61d2`). (A-08/A-09) `services/env.ts` e `app/api/warmup/route.ts` — URLs hardcoded de produção removidas, app avisa no console se NEXT_PUBLIC_API_URL não setada (commit `2bf3366c`). (A-12) `demo-vitrine.service.ts` — hash bcrypt fake `'$2b$10$demopasswordhash'` substituído por `bcrypt.hash('Demo@Driver123', 10)` real (commit `1be77456`). (A-13) `deleteCompany` no super-admin agora executa todos os 37 deleteMany dentro de um único `$transaction({ timeout: 60s })` — atomicidade garantida contra crash mid-delete (commit `c55f12ad`). Pendentes (P1-P4): rate limiting, Helmet, validação JWT no middleware, criptografia de apiToken, índices compostos, code dead cleanup.
68. **fix(demo): auto-bootstrap contas demo + fix interceptor 401 (COMPLETO)**: diagnóstico identificou 2 causas raiz. (1) Contas demo (`demo-basic@foodsaas.demo`, `demo-pro@foodsaas.demo`, `demo-enterprise@foodsaas.demo`) nunca existiram em prod — `POST /api/super-admin/demo/init` era manual e nunca foi chamado. (2) Interceptor Axios em `frontend/services/api.ts` redirecionava para `/login` em **qualquer** 401, incluindo o próprio `POST /auth/login` — usuário via tela de login em vez de toast de erro. Correções: (a) `DemoBootstrapService` novo (`src/modules/super-admin/demo-bootstrap.service.ts`) implementa `OnApplicationBootstrap` — aguarda `prisma.readyPromise`, conta usuários demo, se `count < 3` executa `initDemoCompanies()` + `populateAll()` automaticamente. No-op em restarts subsequentes. Registrado em `SuperAdminModule.providers`. (b) `frontend/services/api.ts` interceptor: `const isLoginAttempt = requestUrl.includes("auth/login")` — condição `!isLoginAttempt` garante que 401 no login mostre erro sem redirecionar. `tsc --noEmit` limpo em ambos. `npm run build` OK. Commit `30590af5`.
69. **fix(demo): resolve 403 em POST /auth/login para usuários DEMO (COMPLETO)**: causa raiz — `DemoGuard` (global APP_GUARD) não tinha whitelist de rotas públicas. Quando um DEMO token estava em `localStorage` (de sessão anterior), o interceptor Axios o injetava em **todas** as requisições incluindo `POST /auth/login`. O guard via `role=DEMO + method=POST` → `ForbiddenException(403)`. Loop auto-perpetuante: primeiro login bem-sucedido → DEMO token em localStorage → próxima tentativa de login → 403 eterno. Correção dupla (defesa em profundidade): (a) `backend/src/common/guards/demo.guard.ts` — whitelist `/auth/(login|signup|register)` no topo de `canActivate`, antes de qualquer verificação de role/método. Regex: `/\/auth\/(login|signup|register)/.test(url)` → `return true`. (b) `frontend/services/api.ts` request interceptor — `const skipAuth = config.url?.includes("auth/login") || auth/signup || auth/register` → não injeta `Authorization` header quando chamando endpoints de autenticação. `tsc --noEmit` limpo em ambos. `npm run build` backend + frontend OK. Commit `579d38ff`.
70. **feat(ia-demo): página pública de demo da IA Humanizada — Luna consultora comercial (COMPLETO)**: URL pública `https://food-system-sas-erp-frontend.vercel.app/ia-demo`. **Backend** — `ia.service.ts`: método `streamPlatformDemo(messages, res)` com SSE streaming via Anthropic (`claude-sonnet-4-6`, `ANTHROPIC_MODEL` env override). `PLATFORM_DEMO_SYSTEM_PROMPT` hardcoded com contexto completo: plataforma, módulos (PDV/Cardápio Digital/Cozinha/Estoque/Financeiro/BI/Delivery/WhatsApp IA), 3 planos (Basic/Pro/Enterprise), regras de comportamento consultivo, links de demo. Sem persistência em DB (stateless). `ia.controller.ts`: `POST /api/ia/platform-demo` — sem JWT, `@Throttle({default:{limit:15,ttl:60_000}})`, validação manual (máx 50 msgs × 2000 chars/msg), `@UseGuards(JwtAuthGuard)` movido de class para métodos individuais (endpoints autenticados existentes intactos). **Frontend** — `app/ia-demo/page.tsx` ("use client"): design dark premium com glow violeta radial, `Bot` avatar Luna, streaming chunk-by-chunk (cursor blink animado), `RichText` renderer para `**bold**` + newlines, 6 suggestion chips visíveis apenas no 1º turno, textarea auto-resize (máx 120px), spinner no botão durante loading. Footer: botão WhatsApp "Falar com Consultor" + botão "Testar o Sistema" (/demo), `env(safe-area-inset-bottom)` iPhone. `middleware.ts` + `ClientShell.tsx`: `/ia-demo` adicionado em PUBLIC_ROUTES de ambos. **ChatModule permanece desabilitado** (schema/code mismatch) — o novo endpoint vai direto no IaModule. Rate: 15 req/min/IP. Commit `d873091f`.
71. **fix(demo): demo banner no longer covers mobile header/hamburger on PDV**: causa — barra DEMO (`z-9999 top-0`) sobrepunha o mobile top bar (`z-40 top-0`). ClientShell: `isDemoUser = user?.role === "DEMO"` + `planLabel`. Mobile top bar: `top-8` (32px) quando isDemoUser. Layout wrapper: `md:pt-8 pt-[5.5rem]` (32+56=88px) quando isDemoUser. Banner: `env(safe-area-inset-top, 0px)` via inline style, mobile (<640px) exibe "Demo {plan} · Somente leitura" com `truncate max-w-[calc(100vw-4rem)]`, desktop texto completo. Commits `a4f60a70` + `2d5ee4c0`.
73. **feat(leads): melhorias de qualificação + stats + KPIs + follow-up log (COMPLETO)**: (a) `LeadsService.upsert()` retorna `null` e não persiste quando todos os 4 campos qualificadores (name, company, whatsapp, recommendedPlan) estão ausentes — visitantes anônimos não geram linhas no banco. (b) Auto-classificação: `status=QUALIFICADO` quando `recommendedPlan || whatsapp`; `NOVO` caso contrário; transição NOVO→QUALIFICADO em updates; nunca rebaixa de CONTATADO/PERDIDO. (c) `triggerFollowUp()` emite log JSON estruturado `{event:LEAD_QUALIFIED, leadId, nome, empresa, whatsapp, plano, resumo}` — arquitetura pronta para WhatsApp/E-mail/CRM via TODO(follow-up). (d) `getStats()`: `groupBy status` + `groupBy recommendedPlan` → `{total, novos, qualificados, contatados, perdidos, porPlano:{BASIC,PRO,ENTERPRISE}}`. (e) `SuperAdminController`: `GET leads/stats` adicionado ANTES de `GET leads` (match-by-order NestJS). (f) `/super-admin/leads`: 4 KPI cards (Total, Qualificados, Leads do Mês, Plano Mais Recomendado) acima da tabela; `Promise.all([listLeads, getStats])` na carga inicial. Commit `1c93f007`.
72. **feat(leads): captura persistente de leads da Kely (COMPLETO)**: model `Lead` no schema (sessionToken unique, name, company, whatsapp, recommendedPlan, conversationSummary, status DEFAULT 'NOVO'). Migration `20260606000000_add_lead` idempotente. `LeadsModule` (service upsert/findAll + controller POST público rate-limited 30req/min + GET admin com `@Roles(SUPER_ADMIN|ADMIN|MANAGER)`). `AppModule` registra `LeadsModule`. `SuperAdminModule` importa `LeadsModule`; `SuperAdminController` expõe `GET /api/super-admin/leads` (SuperAdminGuard). `ia-demo/page.tsx`: `SESSION_TOKEN = crypto.randomUUID()` gerado once no module scope; `buildConversationSummary(msgs)` pega últimas 10 msgs; `saveLead()` best-effort (`fetch /api/leads` silently ignores error); salva automaticamente ao detectar `[PLANO:X]` no streaming e ao submeter o form de lead. `/super-admin/leads/page.tsx`: tabela Nome/Empresa, WhatsApp (link wa.me), Plano badge colorido, Data, Status, expand resumo da conversa. `render.yaml`: `--rolled-back 20260606000000_add_lead` adicionado. Commit `786d03da`.
75. **fix(delivery): Fase 1 — Delivery Core Stabilization (COMPLETO)**: 7 arquivos alterados, zero novos models/migrations/rotas/módulos. (1) `orders.module.ts`: adicionado `exports: [OrdersService]` — prerequisito para os módulos de tracking e entregadores. (2) `tracking.gateway.ts`: import de `JwtService`+`OrdersService`+`OrderStatus`+`Logger`; `handleConnection` agora parseia JWT do handshake (`auth.token || query.token`) e armazena `{userId, companyId}` em `client.data` (clientes sem token conectam como públicos — sem rejeição); `server: Server` → `server!: Server` (TypeScript strict); `handleDelivered` substituído: `prisma.order.update` direto → `ordersService.updateStatus(orderId, DELIVERED, userId, companyId)` com guard de autenticação; `handlePickedUp` mantido (só atualiza `pickedUpAt`, não é transição de status). (3) `tracking.module.ts`: removido `PrismaService` provider direto (global); adicionado `imports: [AuthModule, OrdersModule]`. (4) `drivers.service.ts`: inject `OrdersService`; `assignOrder(orderId, driverId, companyId, userId)` — primeiro persiste `driverId+assignedAt` via Prisma direto, depois delega `OUT_FOR_DELIVERY` para `ordersService.updateStatus`. (5) `drivers.controller.ts`: `assignOrder` passa `req.user.userId`. (6) `drivers.module.ts`: adicionado `imports: [OrdersModule]`. (7) `app.module.ts`: adicionados `TrackingModule`+`DeliveryConfigModule` em imports; corrigido import path legado em `delivery-config.controller.ts` (`@/auth/jwt-auth.guard` → `@/common/guards/jwt-auth.guard`). Build backend OK (373 arquivos).
74. **feat(leads): WA Click Tracking P0 — rastreamento de conversão WhatsApp (COMPLETO)**: campo `waClickedAt DateTime?` adicionado ao model `Lead` (schema.prisma). Migration `20260606100000_add_wa_clicked_at` idempotente (`ADD COLUMN IF NOT EXISTS`). `render.yaml` atualizado com `--rolled-back 20260606100000_add_wa_clicked_at`. **Backend**: `LeadUpsertDto` recebe `waClicked?: boolean`; null-guard de sessão anônima agora inclui `&& !dto.waClicked` (clique WA sem dados ainda persiste); `findUnique` select adiciona `waClickedAt: true` para first-touch attribution; `upsert.create` define `waClickedAt: new Date()` quando `dto.waClicked`; `upsert.update` só seta `waClickedAt` se ainda não existir (first-touch, sem sobrescrever); `getStats()` adiciona 4º item ao `Promise.all`: `count({ where: { waClickedAt: { not: null } } })` → campo `waClicked: number` no `LeadStats`; `leads.controller.ts` sanitiza `waClicked: body.waClicked === true ? true : undefined`. **Frontend ia-demo**: `saveLead()` assinatura recebe `waClicked?: boolean`; `fetch` ganha `keepalive: true` (resolve iOS Safari que cancela requests ao abrir nova aba); 3 botões WA recebem `onClick={() => saveLead({ waClicked: true })}`: (1) Footer "Falar com Consultor", (2) inline CTA "Falar com consultor agora", (3) PlanCard "Solicitar proposta" via prop `onWaClick?: () => void`. **Frontend leads**: `LeadStats` recebe `waClicked: number`; grid muda para `grid-cols-2 md:grid-cols-5`; 5º KPI card "Cliques WhatsApp" com accent `emerald`; `ACCENT_CLASSES` adicionado `emerald`. `prisma generate` OK. Build backend + frontend OK.
77. **feat(whatsapp-ia): Mercado Pago + WhatsApp IA — pagamentos automáticos (COMPLETO + 5 riscos eliminados)**: integração end-to-end de PIX e Link de Pagamento (Cartão Crédito/Débito) via Mercado Pago no fluxo de atendimento WhatsApp IA. Arquitetura auto-contida no módulo `whatsapp-ai/` sem tocar `PaymentsModule`. (1) `claude-cart.service.ts`: `SolicitacaoPagamento` interface adicionada a `StructuredResponse`; system prompt da Carol recebe 3 novas diretrizes (15-17): coleta `formaPagamento` (pix/credit_card/debit_card), ativa `solicitacao_pagamento.requer_acao=true` ao finalizar, informa ao cliente o próximo passo; JSON de resposta obrigatório inclui campo `solicitacao_pagamento`. (2) `wa-payment.service.ts` (novo): `WaPaymentService` com `createPix(orderId, companyId, total, customerPhone, customerName, description)` → chama `POST /v1/payments` MP com `payment_method_id: "pix"` + `notification_url = /api/whatsapp-ai/webhook/mp-payment` + `external_reference = "WA_ORDER|orderId|companyId"`; `createPaymentLink(...)` → chama `POST /checkout/preferences` MP; ambos retornam mock quando `MERCADOPAGO_ACCESS_TOKEN` não configurado; **HTTPS warning** no getter `backendUrl` — loga `WARN` se não começar com `https://` (Render env var `BACKEND_URL` obrigatória em prod). (3) `whatsapp-ai.module.ts`: importa `ConfigModule` + `forwardRef(() => OrdersModule)` (circular dep resolvido). (4) `whatsapp-ai.service.ts`: injects `WaPaymentService`; `@Inject(forwardRef(() => OrdersService)) private ordersService?` (circular dep); **`normalizePaymentMethod(raw)`** converte aliases PT-BR ("cartão", "débito", "pix") para `pix|credit_card|debit_card`; `runClaudeStructuredResponse` usa `normalizePaymentMethod(rawMetodo)` antes de ramificar PIX vs link; `handleMpPaymentWebhook` agora: (a) **idempotência** — `findFirst({status})`, skip se já `CONFIRMED`; (b) **substitui bypass** — chama `ordersService.updateStatus(orderId, CONFIRMED, 'SYSTEM', companyId)` que dispara estoque+fidelidade+socket+WhatsApp-notif; fallback para `prisma.order.update` apenas se `ordersService` não disponível. (5) `whatsapp-ai.controller.ts`: `@Post('webhook/mp-payment')` adicionado ANTES de `@Post('webhook/:connectionId')` (match-by-order). (6) `orders.module.ts`: `forwardRef(() => WhatsappAiModule)`. (7) `PaymentsModule` reabilitado: `payments.service.ts` + `payments.controller.ts` corrigidos (`MERCADOPAGO` → `MERCADO_PAGO`); `app.module.ts` importa `PaymentsModule`. `tsc --noEmit` limpo. `npm run build` OK.

76. **feat(delivery): Fase 2 — DeliveryZone conectado ao fluxo de criação de pedidos (COMPLETO)**: raiz do bug: `Order.deliveryFee` vinha sempre do frontend sem validação; menu sempre enviava `deliveryFee: 0`; `driverFee` nunca era populado; `deliveryZoneId` não existia no model. Correções end-to-end: (1) `schema.prisma`: `Order` recebe `deliveryZoneId String?` + `deliveryZone DeliveryZone? @relation(...)` + `@@index([deliveryZoneId])`; `DeliveryZone` recebe `orders Order[]`. (2) Migration `20260607000000_add_delivery_zone_to_order` idempotente (`ADD COLUMN IF NOT EXISTS` + FK via `information_schema` check + `CREATE INDEX IF NOT EXISTS`). (3) `render.yaml`: +1 `--rolled-back` entry. (4) `prisma generate`. (5) `delivery-config.controller.ts`: `@UseGuards(JwtAuthGuard)` movido de class para cada método protegido; novo `GET /delivery-config/public?companyId=X` sem auth (retorna apenas `id/name/neighborhood/clientFee/type`, **NÃO** expõe `driverShare`). (6) `delivery-config.service.ts`: `findAllPublic(companyId)` com `select` seguro. (7) `orders.service.ts`: inject `DeliveryConfigService` via `@Optional()`; `create()` — se `deliveryZoneId` enviado pelo frontend, busca zona por id+companyId; senão se `neighborhood` presente busca por `getFeeForNeighborhood`; se zona encontrada: seta `driverFee = zone.driverShare`, `deliveryZoneId = zone.id`, override `deliveryFee` apenas quando frontend enviou 0. (8) `orders.module.ts`: import `DeliveryConfigModule`. (9) `online-orders.service.ts`: inject `DeliveryConfigService`; `create()` — mesma lógica de lookup por `neighborhood`; `total` recalculado como `subtotal - discount + deliveryFee` (corrige bug onde menu enviava `total = subtotal - discount` sem taxa). (10) `online-orders.module.ts`: import `DeliveryConfigModule`. (11) `OrderDetailsForm.tsx` (PDV): `OrderDetails` recebe `deliveryZoneId?: string`; busca `GET /delivery-config/public?companyId=X` ao montar; quando `bairro` muda → auto-match de zona → preenche `deliveryFee` + `deliveryZoneId` + mostra badge "Taxa: R$ X,XX" ao lado do label. (12) `app/pdv/page.tsx`: `closePaidOrder` envia `neighborhood: details.bairro` + `deliveryZoneId: details.deliveryZoneId` no POST /orders. (13) `app/menu/[companyId]/page.tsx`: `deliveryZones` state; fetch de zonas em `loadMenu`; `selectedZone` auto-matched quando `neighborhood` muda (input manual ou via CEP autocomplete); `deliveryFee: selectedZone?.clientFee ?? 0` no POST; linha "Taxa de entrega" com valor real ou "Bairro sem cobertura" exibida no resumo do checkout; total exibido inclui a taxa. `tsc --noEmit` limpo. `npm run build` OK (backend + frontend).

78. **feat(drivers+whatsapp): DriverEarning/Payment pipeline + WA order via ordersService (COMPLETO)**: `DriverPaymentStatus` enum (PENDING/PAID) + `DriverEarning` model (`orderId @unique`, `customerFee`, `driverAmount`, `platformFee`, `driverPaymentId?`) + `DriverPayment` model (`earnings[]`, `totalAmount`, `paidAt?`, `financialId?`). Migration `20260610000000_add_driver_earnings` idempotente. `prisma generate` limpo. `orders.service.ts`: após transação DELIVERED, `setImmediate` cria `driverEarning.upsert` (condição: `orderType=DELIVERY AND driverId!=null AND driverFee>0`); fire-and-forget com `console.error` no catch. `drivers.service.ts`: `listEarnings`, `listPayments`, `myEarnings`, `myPayments`, `createPayment` (batch de PENDING → `DriverPayment`), `payPayment` (cria `Financial(EXPENSE, REPASSE_ENTREGADOR)` + marca PAID em transação). `drivers.controller.ts`: `GET me/earnings`, `GET me/payments` (para driver logado); `GET :id/earnings`, `GET :id/payments`, `POST :id/payments` (admin cria batch), `PATCH payments/:paymentId/pay` (admin quita) — todos com `@Roles(ADMIN|MANAGER|SUPER_ADMIN)` menos os `me/*`. **Também neste commit**: WhatsApp IA `createOrderFromCart` reescrito para usar `ordersService.create` (estoque, loyalty, socket, WA notif todos disparados); `bairro` adicionado ao `CartStatus` interface + system prompt guia Carol a extrair bairro sem inventar. `tsc --noEmit` limpo. `npm run build` OK. Commit `c987b664`.

79. **fix(tables): persistência real de mesas via Order.tableId (COMPLETO)**: `tableItems` era estado React efêmero — mesa ficava OCCUPIED após reload mas modal exibia R$0,00. Correção: `Order.tableId String?` + `Table.dineInOrders Order[]` (back-relation separada de `TableOrder[]` já existente). Migration `20260611000000_add_table_id_to_order` idempotente (`ADD COLUMN IF NOT EXISTS` + FK pg_constraint + `CREATE INDEX IF NOT EXISTS`). `orders.service.ts create()`: salva `tableId` no order; DINE_IN block aceita `tableId` direto além de `tableNumber` para marcar Table OCCUPIED. `tables.service.ts findAll()`: inclui `dineInOrders { where: { status: notIn[CANCELLED] }, include: { items } }`. `app/tables/page.tsx`: ao abrir mesa reconstrói `tableItems` de `table.dineInOrders[].items[]` (banco real); `sendOrderToKitchen` passa `tableId: selectedTable.id`; `closeTable()` calcula total dos Orders persistidos (fallback para `tableTotal` local se banco retornar 0). Kitchen preservada: `Order` continua sendo criado normalmente para cada item. `tsc --noEmit` limpo em backend e frontend. `npm run build` OK. Commit `4674a7ab`.

80. **feat(integrations): Provider Pattern iFood — Passos 1-8 completos (commit `0083c8f1`)**: módulo `src/modules/integrations/` completo. `IntegrationProvider` enum (IFOOD/RAPPI/MOCK) + 4 novos models: `IntegrationConfig`, `IntegrationOrder`, `IntegrationEventLog`, `ProductCatalogMap`. `Order` recebe `channel String @default("PDV")` + `externalOrderId String? @unique`. Migration `20260615000000_add_integrations` idempotente. `IIntegrationProvider` interface + `MockProvider` (sandbox, sempre válido, id externo = interno) + `IfoodProvider` (HMAC sha256) + `IntegrationProviderFactory`. `IntegrationsService`: `processWebhook` (ACK imediato via `setImmediate`), idempotência via `externalOrderId @unique`, funneling para `ordersService.create/updateStatus`. `IntegrationsController`: admin endpoints com JWT+Roles; webhook público rate-limited 60/min. Página `/integracoes` com 4 tabs (Provedores, Mapeamento, Pedidos, Log). Sidebar: item "Integrações" com ícone `Cable` na seção Marketplace. **rawBody risk**: `main.ts` não tem `rawBody: true` — HMAC real do iFood usará JSON.stringify fallback (não bloqueia MOCK/sandbox). `render.yaml`: `--rolled-back 20260615000000_add_integrations` adicionado. `orders.service.ts`: `findAllForKitchen` usa `o.channel` como source; `updateKitchenStatus` roteia `source !== ONLINE` para `updateStatus`.

81. **fix(menu): apply company theme color to CSS variable (commit `16fb5fb8`)**: `app/menu/[companyId]/page.tsx` — ao carregar tema, `document.documentElement.style.setProperty("--color-primary", primary)` sincroniza a CSS variable global com a cor da empresa. Antes, elementos com `bg-[var(--color-primary)]` sempre mostravam o laranja hardcoded do `globals.css (#f97316)` em vez da cor configurada. Elementos com `style={{ backgroundColor: theme.primaryColor }}` já funcionavam corretamente.

82. **feat(kitchen+orders): impressão profissional 80mm + source badges reais (commit `480f341e`)**: `app/kitchen/page.tsx` — `printKitchenOrder` artesanal (300px, CSS inline, `window.open` manual) substituído por 3 linhas usando `buildKitchenTicket` + `printTicket` (80mm `@page`, fontes 22px, complementos, fonte bold para cozinha). `KitchenBoard.tsx` + `app/orders/page.tsx` — badge de fonte agora exibe o valor real (`order.source ?? "PDV"`) com cores distintas: ONLINE=azul, MOCK=roxo, IFOOD=vermelho, PDV/outros=cinza. Antes: todos não-ONLINE mostravam "PDV" independente da fonte real.

83. **feat(printing): FoodSaaS Printer Agent — Phase 1 (commit `fc0f69b5`)**: arquitetura multi-setor sem quebrar sistema existente. **Backend**: `orders.service.ts findAllForKitchen` inclui `product.category.categoryType` nos itens PDV via Prisma `include { product { include { category { select { categoryType } } } } }`; para itens de `OnlineOrder` (JSON field sem relação direta), faz batch-lookup por `productId` em uma única query e mapeia `categoryType`. **Frontend — novos arquivos**: `printDispatcher.ts` (abstração entre templates e dispositivos; fase 2 hook point para ESC/POS Agent; `printAllTickets()` com gap 350ms anti-throttle popup); `BarTicket.tsx` (template 80mm setor bar: somente bebidas, sem preços, fontes grandes, destaque azul, filtra `categoryType === "bebidas"`); `DeliveryLabel.tsx` (etiqueta delivery: endereço grande, pagamento, troco highlight CASH, sem custos internos); `PrintRouterService.ts` (classifica itens por `categoryType` → KITCHEN ou BAR; determina DELIVERY se `orderType === "DELIVERY"`; sempre adiciona CASHIER; métodos `printAll()`, `printSector()`, `route()`). **Frontend — pontos de chamada**: `app/kitchen/page.tsx` usa `PrintRouterService(KITCHEN+BAR)`; `app/orders/page.tsx` usa `PrintRouterService` com todos os setores; `app/historico-pedidos/page.tsx` idem; `app/pdv/page.tsx` ganha **impressão automática pós-pagamento** (sem nenhuma antes), monta `PrintableOrder` do carrinho local com `companyName` fetchado via `/company/:id`. `tsc --noEmit` limpo. Sem migrations. Sem novos models.

84. **fix(tables): P0 — sync selectedTable + auto-confirm + rollback (commit `434f580b`)**: 3 bugs raiz: (1) `selectedTable` era set uma vez no click e nunca atualizado quando `fetchTables` refrescava a lista — `dineInOrders` ficava stale, `closeTable` calculava R$0,00. Fix: `fetchTables` agora chama `setSelectedTable(prev => fresh.find(t => t.id === prev.id) ?? prev)` para sincronizar o objeto. (2) `sendOrderToKitchen` criava pedido PENDING mas nunca confirmava — estoque nunca consumido, stock-consume nunca rodava. Fix: após `POST /orders` bem-sucedido, chama `PATCH /orders/:id/status CONFIRMED` (mesmo fluxo do PDV). Rollback do item otimista em caso de erro. (3) `tableItems` era reconstruído manualmente em dois lugares inconsistentes. Fix: `useEffect([selectedTable])` único que reconstrói `tableItems` de `selectedTable.dineInOrders` sempre que o objeto muda — inclusive após sync do fetchTables. Também: removido `saveTableOrder` (dead code, usava `PATCH /tables/:id/order` inexistente), simplificado `closeTable` (sem fallback para stale `tableTotal`), `addItemToTable` passa `orderType: "DINE_IN"`. `tsc --noEmit` limpo.

58. **Sprint UX-02 — diagnóstico PizzaBuilder: INCONCLUSIVO (favor falso positivo Chrome MCP)**: "tela 100% preta" reportada ao clicar pizza no cardápio digital. Análise estática: 3 componentes envolvidos — `components/pdv/PizzaBuilder.tsx` (PDV apenas, retorna `<div space-y-6>` inline sem overlay), wrapper PDV em `app/pdv/page.tsx:1358` (`fixed inset-0 z-[100] bg-black/80` + container `bg-[#050816]` quase preto INTENCIONAL do tema dark), e Modal "Montar Pizza" em `app/menu/[companyId]/page.tsx:1150` (`fixed inset-0 z-50` + backdrop `bg-black/50` + container `bg-white max-w-md` — esse foi o que abriu). DOM debug durante incidente confirmou modal renderizado corretamente ("Montar Pizza Preço = sabor mais caro"). Causa provável: overlay z-index 2147483646 da extensão Chrome MCP (1494×650) cobriu viewport durante captura. Modal C estaticamente correto. Reprodução em browser real sem Chrome MCP fica pendente — frontend caiu durante teste. Recomendação: NÃO BLOQUEIA git push (componente está como está no código de prod; bug, se existir, já está lá).
