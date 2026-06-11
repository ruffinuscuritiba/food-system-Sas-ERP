# scripts/

Scripts auxiliares de operação. **Não** executados automaticamente — uso manual ou via CI.

## `smoke-prod.sh`

Smoke test rápido contra os ambientes de produção (VPS + Vercel). Roda em <30s.

### Uso
```bash
bash scripts/smoke-prod.sh
```

### Variáveis de ambiente (todas opcionais)
| Var | Default | Descrição |
|---|---|---|
| `SMOKE_BACK` | `https://api.srv1747711.hstgr.cloud` | URL do backend VPS |
| `SMOKE_FRONT` | `https://food-system-sas-erp-frontend.vercel.app` | URL do frontend Vercel |
| `SMOKE_EMAIL` | `admin@teste.com` | Email para o teste de login |
| `SMOKE_PASS` | `123456` | Senha para o teste de login |

Para usar credenciais reais:
```bash
SMOKE_EMAIL=meuemail@x.com SMOKE_PASS='minhaSenha' bash scripts/smoke-prod.sh
```

### O que valida (6 testes)

**Backend (VPS Hostinger)**
1. `GET /api/health` retorna 200
2. `POST /api/auth/login` retorna token
3. `GET /api/orders/kitchen` autenticado **não** é 404 (Adapter Caminho 2 deployed)

**Frontend (Vercel)**
4. `GET /login` retorna 200
5. `GET /dashboard` retorna 200 ou redirect esperado (302/307/308)
6. `/complements` contém a string `Novo Grupo` em algum chunk JS visível no shell HTML (marca de que a Fase B está em produção, não a versão pré-Fase-B com "Novo Complemento"). **Limitação**: `/complements` é Client Component do App Router — o chunk específico da página entra dinamicamente após hidratação JS, então a string pode não estar acessível via `curl` puro. Por isso este teste **emite warning, não fail** — em caso de warning, validar visualmente no browser.

### Exit code
- `0` — todos passaram (ou passaram com warnings)
- `1` — ao menos um teste **falhou** (warnings não derrubam)

### Quando executar
- Após qualquer `git push` para `main` (aguardar ~5-10 min para Render+Vercel completarem build)
- Antes de criar tag de release
- Manualmente após mudanças sensíveis em prod
