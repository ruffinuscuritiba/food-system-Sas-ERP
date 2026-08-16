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
| Instância Evolution ativa | `ruffinu-s-cmq7d3dx-ms569mw6` (reconectada via QR em 28/07/2026 ~21:32 UTC — a `kely-cmq7d3dx-mr5aakwk` documentada antes já não existe mais) |
| WhatsappConnection.id (banco) | `cms569qw9008emlh76kpuh161` |
| Empresa "plataforma" (Kely vende o sistema) | `cmq7d3dxs0006gw5pabsljy87` — nome de exibição "Ruffinu's Pizzaria", login `platform@foodsaas.internal` |
| Número de WhatsApp do dono (avisos) | `5567991753455` (`NOTIFY_WHATSAPP_NUMBER`) |
| Número que atende a Ruffinu's Pizzaria (Evolution, ativo) | `5541987397797` — conexão `cms569qw9008emlh76kpuh161`, `aiProvider=CLAUDE`, `mode=AUTO` |
| Número Meta Cloud API novo (Ruffinu's, EM VALIDAÇÃO — 03/08/2026) | `5567987397797` — conexão `cmscqljpv0001ysh68flqszfb`, App Meta ID `2351196475686940`, webhook `https://api.srv1747711.hstgr.cloud/api/whatsapp-ai/webhook/cmscqljpv0001ysh68flqszfb` (verificado pela Meta). **Plano combinado**: coexistir com a Evolution até validar, DEPOIS desativar a Evolution — nunca as duas ativas por muito tempo (avisos automáticos como confirmação de pedido pegam a conexão ativa mais recente por `createdAt desc`, então migrariam sozinhos pro número novo assim que ele for ativado). **Pendente crítico**: essa conexão foi criada pelo formulário genérico (não pelo fluxo de QR), então **NÃO tem `WhatsappAiSettings` criada automaticamente** — precisa forçar manualmente em Configurar IA: `aiProvider=CLAUDE`, `aiModel=claude-haiku-4-5-20251001`, `mode=AUTO`, ANTES de qualquer mensagem chegar (senão corre risco de nascer em GEMIN/motor fraco, mesmo bug do item 169 do CLAUDE.md). |
| Número que vende o FoodSaaS (SaaS) | `41988729370` — empresa **`Mestra Gestão Digital`** (`cmrf983h6000auqph3fmrrp21`, CNPJ/endereço reais, já existia arquivada de sessão anterior, restaurada em 22/07/2026) = `PLATFORM_SELLER_COMPANY_ID` (era o default hardcoded o tempo todo). **Ainda falta conectar via QR** — empresa existe e tem usuário ativo, mas não tem `WhatsappConnection` ainda (precisa escanear o QR com o celular físico do número). ⚠️ Uma "R FoodSaaS - Vendas" foi criada por engano numa sessão e já foi **apagada** — não recriar. |
| Provider de IA ativo (Kely) | `CLAUDE` (motor completo "Carol", `claude-cart.service.ts`) — modelo `claude-haiku-4-5-20251001`, fallback automático Gemini `gemini-2.0-flash` dentro do próprio motor |

## 2. Como verificar se está tudo certo (checklist rápido)

1. **A instância ainda existe na Evolution?**
   Terminal VPS → `curl -s https://evolution-api-j9ur.srv1747711.hstgr.cloud/instance/connectionState/kely-cmq7d3dx-mr5aakwk -H "apikey: $EVOLUTION_API_KEY"` — precisa retornar `"state":"open"`.

2. **A env var do backend bate com a instância real?**
   `docker exec foodsaas-backend-backend-1 printenv EVOLUTION_INSTANCE_NAME` — se for diferente do nome real da instância aberta, **é isso** — corrige em `/opt/foodsaas-backend/.env` e recria o container (ver item 143 do CLAUDE.md).

3. **A conversa não está travada em modo HUMAN?**
   `WhatsappConversation.mode` — se um atendente assumiu a conversa manualmente uma vez, fica em HUMAN pra sempre pra aquele número, e a Kely nunca mais responde ele. Auto-reset existe (60 min sem resposta do humano), mas só a partir do item 93.

4. **`WhatsappAiSettings` existe pra essa conexão?**
   Reprovisionar a conexão (nova instância) **apaga as settings em cascade** (1:1 com `connectionId`). Se `settings=null`, o self-healing (desde 22/07/2026) detecta o ambiente sozinho e já cria com o provider certo (`CLAUDE` pra loja real, `ANTHROPIC` pra venda do SaaS) — não precisa mais corrigir manualmente. Ainda assim, confirme `mode=AUTO`/`HYBRID` depois.

5. **Horário de funcionamento não está bloqueando por engano?**
   Bug conhecido: se o horário cruza meia-noite (ex: 18h–02h) e a lógica de overnight não está com o fix, `isBusinessHours()` retorna sempre `false`. Ambientes de venda (R_FOOD_SAAS/LOJA_DEMO) já têm bypass — só afeta clientes reais.

6. **`aiProvider` da conexão é `CLAUDE` (loja real) ou `GEMINI`/`ANTHROPIC` (venda do SaaS)?** — ver regra principal no topo do `CLAUDE.md` e item 169. Toda reconexão via QR reseta `aiProvider` pro default `GEMINI` do schema, o que joga a loja de volta pro motor fraco (sem conhecimento de entrega/horário/pagamento/borda). Checar com `GET /whatsapp-ai/connections` (autenticado como a empresa) e corrigir com `PUT /whatsapp-ai/settings/:connectionId {"aiProvider":"CLAUDE"}` se for loja real.

7. **Teste de sanidade rápido**: mande uma mensagem de teste perguntando entrega+horário+pagamento numa tacada só (ex: "entregam no bairro X? que horas fecham? aceitam pix?"). Se a resposta não cobrir os 3 pontos, o motor fraco está ativo (item 6).

8. **⚠️ O painel de conversas mostrar a resposta da Kely NÃO significa que o cliente recebeu de verdade** (bug real corrigido no item 179 do CLAUDE.md — 28/07/2026). Antes de assumir que "a Kely respondeu certo", cheque `WhatsappMessage.deliveryFailed` da(s) mensagem(ns) ASSISTANT mais recente(s) da conversa — se vier `true`, o envio falhou de verdade (Evolution/Cloud API rejeitou) mesmo a mensagem aparecendo normal no painel. `GET /whatsapp-ai/conversations/:id/messages` retorna esse campo. Se `deliveryFailed=true` em várias conversas recentes, é sinal forte de instância Evolution desconectada/sessão expirada — ver item 1/2 acima antes de qualquer outra investigação.

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
- **Deploy do VPS é automático desde 06/08/2026** (`.github/workflows/deploy-backend.yml`, ver CLAUDE.md item 143/182) — `git push` na `main` tocando `backend/**` já builda e sobe sozinho via GitHub Actions; confirmar com `gh run list --workflow=deploy-backend.yml --limit 1`. Deploy manual no terminal Hostinger vira **fallback**, só se o pipeline falhar 2x seguidas por motivo não-transitório — rodar os dois ao mesmo tempo já causou colisão real (`removal of container ... is already in progress`). Frontend (Vercel) continua automático.

- **"Sem resposta" pode ser um envio que falhou silenciosamente, não a IA travada** (item 179 do CLAUDE.md, 28/07/2026): até essa correção, `saveMessage()` (grava no painel) rodava ANTES de `dispatchMessage()` (envio real) e o resultado do envio era descartado — E, causa mais funda, `sendEvolution`/`sendCloudApi` só logavam erro HTTP em vez de lançar, então nem esse resultado existia de verdade. Os dois foram corrigidos, mas se algum ponto novo de envio for adicionado no futuro sem passar pelo helper `sendAssistantReply()`, o mesmo bug pode voltar — sempre que adicionar um envio novo, usar esse helper em vez de chamar `dispatchMessage`/`saveMessage` direto.

- **`deliveryFailed:false` no banco NÃO é garantia de entrega real** (achado 28/07/2026, mesmo dia da correção acima — logo depois de ir pro ar): cliente real (Daniele) mandou "Oiee hoje está tá de quanto?" às 18:01 — o banco registrou a resposta da Kely como enviada (`deliveryFailed:false`), mas ela **nunca chegou no WhatsApp real** da cliente (confirmado por print do celular do dono, 18 min de silêncio até ele responder manualmente, pedido perdido). Causa provável: a instância Evolution tinha sido reconectada via QR pouco antes (nome de instância mudou, ver item 1) e uma sessão Baileys recém-linkada pode ficar instável por um tempo — a API da Evolution aceita o pedido de envio (por isso `deliveryFailed` fica `false`, é só um check de `res.ok` HTTP) mas a entrega real pro WhatsApp pode falhar silenciosamente numa camada que nosso código não enxerga. `GET /whatsapp-ai/connections/:id/qr` retornando `state:"open"` também não é garantia total — só confirma que a Evolution *acha* que está conectada. **Ação que resolveu**: desconectar e reconectar via QR de novo (nova instância `ruffinu-s-cmq7d3dx-ms569mw6`, ver item 1) — depois da reconexão nova, testes de sanidade via webhook responderam normal. Se o padrão se repetir (banco diz "entregue" mas cliente real não recebe), o próximo passo é olhar os logs do container Evolution direto no VPS (não só o estado reportado pela API), não assumir que reconectar de novo sempre resolve.

- **`businessHoursInfo` (texto que a Carol usa pra responder "que horas vocês fecham") usava o campo ERRADO** (achado e corrigido 28/07/2026, `whatsapp-ai.service.ts`): existem 2 fontes de horário — `Company.businessHours` (editável em `/configuracoes`, fonte real, usada pelo *gate* que decide se responde ou manda "fora do horário") e `WhatsappAiSettings.businessHoursStart/End` (campo legado, "08:00"–"22:00" hardcoded como default, quase nunca reflete o horário real). O *gate* (`isBusinessHours`) já priorizava `Company.businessHours` desde o item 108, mas o TEXTO informativo que a Carol usa dentro da conversa (`businessHoursInfo`, `runClaudeStructuredResponse`) sempre montava a frase só com o campo legado — por isso a Kely respondia "atendemos das 08h às 22h" pra Ruffinu's Pizzaria, mesmo o horário real cadastrado sendo 18h–23h15. Corrigido: novo helper `buildBusinessHoursInfo()` busca `Company.businessHours` e monta o texto a partir dele (mesma prioridade do gate), só cai no campo legado se a empresa não tiver preenchido o horário centralizado. **Requer rebuild do VPS pra entrar em produção** (ver item abaixo) — só commit/push não é suficiente.

- **Deploy do VPS é automático** (ver item logo acima) — qualquer fix de backend chega em produção sozinho ao dar push na `main`; só checar `gh run list --workflow=deploy-backend.yml --limit 1` pra confirmar que rodou, em vez de assumir manualmente.

- **`engineMode="GREETER_ONLY"` é uma escolha de negócio, não um bug** (item 185 do CLAUDE.md, 15/08/2026): o dono decidiu tirar a Kely do papel de "montar pedido pelo chat" (custo de créditos + risco de resposta errada) e usá-la só pra saudar + mandar o link do cardápio digital — o cliente pede sozinho por lá. Config do motor completo (`aiProvider`/personalidade) continua salva, só fica sem efeito enquanto esse modo estiver ativo. **Mesma regressão de reconexão via QR que `aiProvider`** — se a Kely for reconectada, `engineMode` volta pro default `FULL_SALES` do schema; checar `WhatsappAiSettings.engineMode` da conexão real depois de qualquer reconexão e restaurar pra `GREETER_ONLY` se a loja estava nesse modo antes.

---

*Última atualização deste arquivo: 28/07/2026 21:35 UTC — mantenha a data acima em dia sempre que revisar/corrigir algo aqui.*
