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
2. **Módulos comentados em `app.module.ts`**: `PaymentsModule`, `ChatModule`, `DriversModule`, `DeliveryConfigModule`, `TrackingModule`, `AlertsModule` estão desabilitados ("schema/code mismatch — re-enabled after backend cleanup"). Models existem no schema.
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
