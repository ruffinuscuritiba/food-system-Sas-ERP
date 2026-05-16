# Guia de deploy em produção — Food System

Este projeto foi validado como uma aplicação com **backend NestJS + Prisma**, **frontend Next.js**, **banco relacional via Prisma** e comunicação em tempo real por **Socket.IO**. O caminho recomendado para produção é publicar o **backend na Render**, o **frontend na Vercel** e usar **PostgreSQL gerenciado**, porque essa combinação reduz a complexidade operacional e mantém build, variáveis de ambiente, logs e rollback em painéis separados.

> A documentação oficial da Vercel informa que projetos Next.js podem ser integrados ao Git e configurados com variáveis de ambiente por ambiente de execução. A documentação oficial da Render orienta criar um Web Service Node conectado ao repositório, definindo comandos de build e start. A documentação oficial do Prisma recomenda `prisma migrate deploy` para aplicar migrations pendentes em ambientes de staging/produção.[^1][^2][^3]

## 1. Pré-requisitos

Antes do deploy, suba o projeto corrigido para um repositório Git. Não versionar arquivos `.env`, bancos locais, dependências instaladas ou artefatos de build. Os arquivos `backend/.env.example` e `frontend/.env.example` foram criados para servir como modelo seguro.

| Item | Recomendação |
|---|---|
| Node.js | Usar Node 22.x ou a versão padrão atual da plataforma, desde que o build local continue passando. |
| Banco | PostgreSQL gerenciado em produção. Não usar `dev.db` SQLite local. |
| Backend | Render Web Service apontando para a subpasta `backend`. |
| Frontend | Vercel Project apontando para a subpasta `frontend`. |
| Migrações | Executar `npx prisma migrate deploy` no build do backend. |

## 2. Variáveis de ambiente do backend

Configure estas variáveis no painel da Render, no serviço do backend. Os valores abaixo são exemplos e devem ser substituídos pelos valores reais de produção.

| Variável | Exemplo | Observação |
|---|---|---|
| `PORT` | `3001` | Na Render, a plataforma injeta a porta automaticamente em muitos cenários; manter apenas se necessário. |
| `DATABASE_URL` | `postgresql://USER:PASSWORD@HOST:5432/DB?schema=public` | URL do PostgreSQL de produção. |
| `JWT_SECRET` | `um-segredo-forte-com-32-caracteres-ou-mais` | Nunca versionar nem compartilhar. |
| `FRONTEND_URL` | `https://seu-frontend.vercel.app` | Usado no CORS do backend. |
| `BACKEND_URL` | `https://seu-backend.onrender.com` | Útil para URLs públicas e integrações. |

## 3. Variáveis de ambiente do frontend

Configure estas variáveis no painel da Vercel, no projeto do frontend.

| Variável | Exemplo | Observação |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://seu-backend.onrender.com/api` | Deve incluir o prefixo `/api`, pois o backend usa `app.setGlobalPrefix('api')`. |
| `NEXT_PUBLIC_SOCKET_URL` | `https://seu-backend.onrender.com` | Não incluir `/api`, pois Socket.IO conecta na raiz do servidor. |
| `NEXT_PUBLIC_FRONTEND_URL` | `https://seu-frontend.vercel.app` | Usado para gerar QR Codes e links públicos do cardápio. |

## 4. Deploy do backend na Render

Crie um **Web Service** na Render conectado ao repositório Git do projeto. Se o repositório contiver as pastas `backend` e `frontend` na raiz, configure o serviço para trabalhar dentro da pasta `backend`.

| Campo da Render | Valor recomendado |
|---|---|
| Root Directory | `backend` |
| Runtime | Node |
| Build Command | `npm ci && npx prisma generate && npx prisma migrate deploy && npm run build` |
| Start Command | `npm run start:prod` |
| Health Check Path | `/api/health` |

Se a Render não usar o campo **Root Directory**, use comandos explícitos a partir da raiz do repositório:

```bash
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
npm run start:prod
```

Depois do primeiro deploy, abra os logs do serviço e confirme que aparece um registro JSON parecido com este:

```json
{"level":"info","event":"app_started","port":3001,"timestamp":"2026-05-16T00:00:00.000Z"}
```

## 5. Deploy do frontend na Vercel

Crie um projeto na Vercel conectado ao mesmo repositório Git e selecione a pasta `frontend` como raiz do projeto.

| Campo da Vercel | Valor recomendado |
|---|---|
| Framework Preset | Next.js |
| Root Directory | `frontend` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | Padrão da Vercel para Next.js |

Após configurar as variáveis `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL` e `NEXT_PUBLIC_FRONTEND_URL`, execute o deploy. Quando a Vercel gerar a URL final, volte ao painel da Render e atualize `FRONTEND_URL` com a URL final do frontend para liberar CORS corretamente.

## 6. Validação pós-deploy

Após publicar backend e frontend, execute esta sequência de validação.

| Teste | Como validar | Resultado esperado |
|---|---|---|
| Backend online | Abrir `https://seu-backend.onrender.com/api/health` | Deve retornar `status: "ok"`. |
| Frontend online | Abrir `https://seu-frontend.vercel.app` | A página deve carregar sem erro de build/runtime. |
| Login/autenticação | Entrar com usuário válido | Token deve ser salvo e enviado nas chamadas autenticadas. |
| CORS | Abrir DevTools > Network no frontend | As chamadas para o backend não devem falhar por CORS. |
| Socket.IO | Abrir dashboard/status e alterar pedido | Atualizações em tempo real devem chegar sem erro de conexão. |
| Banco | Criar/editar um item simples | Dados devem persistir após refresh. |

## 7. Monitoramento simples já implementado

Foi adicionado o endpoint `GET /api/health` para verificação de disponibilidade do serviço em produção. Também foi injetado um monitoramento simples por **logs estruturados em JSON** no backend. Cada requisição HTTP registra método, rota, status, duração e timestamp. Erros também são registrados com `level: "error"`, evento `http_exception`, mensagem e stack trace.

Exemplo de requisição bem-sucedida:

```json
{"level":"info","event":"http_request","method":"GET","path":"/api/orders","statusCode":200,"durationMs":31,"timestamp":"2026-05-16T00:00:00.000Z"}
```

Exemplo de erro:

```json
{"level":"error","event":"http_exception","method":"POST","path":"/api/orders","statusCode":400,"message":["campo inválido"],"stack":"...","timestamp":"2026-05-16T00:00:00.000Z"}
```

Na Render, esses logs aparecem diretamente na aba **Logs** do serviço. Para investigar falhas reais em produção, filtre por `level":"error` ou pelo evento `http_exception`.

## 8. Comandos locais de verificação antes de cada deploy

Execute estes comandos sempre antes de subir uma nova versão.

```bash
cd backend
npm ci
npx prisma generate
npm run build

cd ../frontend
npm ci
npm run build
```

Se o banco de produção já estiver configurado em `DATABASE_URL`, aplique migrations pendentes com:

```bash
cd backend
npx prisma migrate deploy
```

Não use `prisma migrate dev` em produção, porque ele é voltado ao ciclo de desenvolvimento local. Para produção/staging, use `prisma migrate deploy`.[^3]

## 9. Observações importantes

O frontend foi ajustado para não depender mais de `localhost` ou do IP local `192.168.15.127` nas chamadas principais. A URL REST agora vem de `NEXT_PUBLIC_API_URL`; a URL de WebSocket vem de `NEXT_PUBLIC_SOCKET_URL`; e a URL pública do frontend vem de `NEXT_PUBLIC_FRONTEND_URL`. Isso evita que a aplicação funcione localmente, mas quebre quando publicada.

O backend usa CORS restrito à variável `FRONTEND_URL`. Portanto, quando a URL final da Vercel mudar, atualize essa variável no backend e faça redeploy/restart do serviço.

[^1]: [Vercel — Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
[^2]: [Render — Deploy a Node Express app](https://render.com/docs/deploy-node-express-app)
[^3]: [Prisma — `prisma migrate deploy`](https://www.prisma.io/docs/cli/migrate/deploy)
