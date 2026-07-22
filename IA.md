# IA.md — Referência rápida de tudo que envolve IA/WhatsApp

Este arquivo existe porque o estado do WhatsApp/Kely **quebra silenciosamente** toda vez que
alguém reconecta o número (nova instância = novo nome = env var desatualizada em algum lugar).
Antes de investigar "a Kely não responde" do zero, comece aqui.

⚠️ **Os valores abaixo têm data de validade.** Sempre que a Kely for reconectada via QR Code,
os 3 primeiros itens deste arquivo (instância, connectionId, companyId da plataforma) podem mudar.
Depois de qualquer reconexão, **atualize este arquivo na mesma sessão**, ou o próximo debug começa
do zero de novo.

---

## 1. Estado atual conhecido (última verificação: ver data no rodapé)

| Item | Valor |
|---|---|
| Evolution API URL | `https://evolution-api-j9ur.srv1747711.hstgr.cloud` |
| Instância Evolution ativa | `kely-cmq7d3dx-mr5aakwk` |
| WhatsappConnection.id (banco) | `cmr5aaozs002ualnbvo5whlpu` |
| Empresa "plataforma" (Kely vende o sistema) | `cmq7d3dxs0006gw5pabsljy87` — nome de exibição "Ruffinu's Pizzaria", login `platform@foodsaas.internal` |
| Número de WhatsApp do dono (avisos) | `5567991753455` (`NOTIFY_WHATSAPP_NUMBER`) |
| Número que atende a Ruffinu's Pizzaria | `41987397797` — conexão `cmrmn2csj000p4dch7pmvre0m`, `aiProvider=CLAUDE` |
| Número que vende o FoodSaaS (SaaS) | `41988729370` — empresa dedicada `R FoodSaaS - Vendas` (`cmrwjq6k70013vh9dc8dslbo9`), `PLATFORM_SELLER_COMPANY_ID` setada no `.env` do VPS. **Ainda falta conectar via QR** — a empresa existe mas não tem `WhatsappConnection` ainda (precisa escanear o QR com o celular físico do número, ninguém consegue fazer isso remotamente) |
| Provider de IA ativo (Kely) | `CLAUDE` (motor completo "Carol", `claude-cart.service.ts`) — modelo `claude-haiku-4-5-20251001`, fallback automático Gemini `gemini-2.0-flash` dentro do próprio motor |

## 2. Como verificar se está tudo certo (checklist rápido)

1. **A instância ainda existe na Evolution?**
   Terminal VPS → `curl -s https://evolution-api-j9ur.srv1747711.hstgr.cloud/instance/connectionState/kely-cmq7d3dx-mr5aakwk -H "apikey: $EVOLUTION_API_KEY"` — precisa retornar `"state":"open"`.

2. **A env var do backend bate com a instância real?**
   `docker exec foodsaas-backend-backend-1 printenv EVOLUTION_INSTANCE_NAME` — se for diferente do nome real da instância aberta, **é isso** — corrige em `/opt/foodsaas-backend/.env` e recria o container (ver item 143 do CLAUDE.md).

3. **A conversa não está travada em modo HUMAN?**
   `WhatsappConversation.mode` — se um atendente assumiu a conversa manualmente uma vez, fica em HUMAN pra sempre pra aquele número, e a Kely nunca mais responde ele. Auto-reset existe (60 min sem resposta do humano), mas só a partir do item 93.

4. **`WhatsappAiSettings` existe pra essa conexão?**
   Reprovisionar a conexão (nova instância) **apaga as settings em cascade** (1:1 com `connectionId`). Se `settings=null`, o sistema hoje faz self-healing (cria default), mas confirme `aiProvider`/`mode=AUTO` depois.

5. **Horário de funcionamento não está bloqueando por engano?**
   Bug conhecido: se o horário cruza meia-noite (ex: 18h–02h) e a lógica de overnight não está com o fix, `isBusinessHours()` retorna sempre `false`. Ambientes de venda (R_FOOD_SAAS/LOJA_DEMO) já têm bypass — só afeta clientes reais.

6. **`aiProvider` da conexão é `CLAUDE` (loja real) ou `GEMINI`/`ANTHROPIC` (venda do SaaS)?** — ver regra principal no topo do `CLAUDE.md` e item 169. Toda reconexão via QR reseta `aiProvider` pro default `GEMINI` do schema, o que joga a loja de volta pro motor fraco (sem conhecimento de entrega/horário/pagamento/borda). Checar com `GET /whatsapp-ai/connections` (autenticado como a empresa) e corrigir com `PUT /whatsapp-ai/settings/:connectionId {"aiProvider":"CLAUDE"}` se for loja real.

7. **Teste de sanidade rápido**: mande uma mensagem de teste perguntando entrega+horário+pagamento numa tacada só (ex: "entregam no bairro X? que horas fecham? aceitam pix?"). Se a resposta não cobrir os 3 pontos, o motor fraco está ativo (item 6).

## 3. Onde cada coisa mora

- **Backend WhatsApp IA**: `backend/src/modules/whatsapp-ai/` — `whatsapp-ai.service.ts` (lógica principal), `claude-cart.service.ts` (prompt + carrinho conversacional), `whatsapp-ai-prompt.service.ts` (prompt-mestre multi-ambiente).
- **Detecção de ambiente** (`detectAmbiente`): decide se a conversa é venda do sistema (R_FOOD_SAAS), demo (LOJA_DEMO) ou cliente real (CLIENTE_REAL) — cada um usa uma persona diferente.
- **Env vars no VPS** (`/opt/foodsaas-backend/.env`): `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME`, `NOTIFY_WHATSAPP_NUMBER`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `SUPPORT_WHATSAPP`.
- **Deploy**: qualquer mudança de env var exige recriar o container (`docker compose up -d` depois de editar o `.env`, ou `docker rm -f` + `up -d` se der conflito de nome — ver procedimento completo no `CLAUDE.md` item 143).
- **Luna** (`/ia-demo`, vende o sistema pro visitante do site): `backend/src/modules/ia/ia.service.ts` — não usa WhatsApp, é chat web direto (SSE), prompt hardcoded `PLATFORM_DEMO_SYSTEM_PROMPT`.
- **IA do painel admin** (assistente interno): também em `ia.service.ts`, endpoints autenticados `POST /ia/ask`.
- **Smart Import** (cadastro por imagem/PDF/XML): `backend/src/modules/smart-import/` — Gemini primário, Anthropic fallback, `OPENROUTER_API_KEY` opcional.

## 4. Outros pontos de falha já vistos (não repetir o mesmo debug)

- **Instância antiga "morre" sem aviso** quando reconectada — os nomes documentados aqui (item 1) já são a 3ª geração (`mq8orbg9` → morreu → reconectada como `mr5aakwk`). Sempre confirme que a instância do item 1 ainda é a real antes de assumir que "já sabe" o nome.
- **Bridge local (`kely-bridge` via PM2, `C:\Users\Ruffinus Pizzaria\Desktop\qr-scan\`)** é um fallback manual antigo, hoje parado — não usar sem confirmar que a Evolution API no VPS está indisponível primeiro (rodar os dois ao mesmo tempo = respostas duplicadas).
- **Deploy do VPS não builda automaticamente** — `git push` sozinho não atualiza o backend rodando. Precisa `docker compose build --no-cache backend` manual no terminal do Hostinger (ver CLAUDE.md item 143). Frontend (Vercel) sim é automático.

---

*Última atualização deste arquivo: 22/07/2026 (tarde) — mantenha a data acima em dia sempre que revisar/corrigir algo aqui.*
