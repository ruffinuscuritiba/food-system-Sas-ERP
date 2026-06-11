#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Smoke Test — Produção
#
# Valida saúde básica de Render (backend) e Vercel (frontend) após deploy.
# NÃO é teste E2E. NÃO altera dados. NÃO exige Chrome/browser.
#
# Uso:
#   bash scripts/smoke-prod.sh
#
# Credenciais customizáveis via env vars (defaults para conta seed):
#   SMOKE_EMAIL  (default: admin@teste.com)
#   SMOKE_PASS   (default: 123456)
#
# Exit code:
#   0 → todos os testes passaram
#   1 → ao menos 1 falhou (CI/scripts podem se basear nisso)
#
# Dependências: bash, curl, python (qualquer 3.x).
# ─────────────────────────────────────────────────────────────────────────────
set -u

BACK="${SMOKE_BACK:-https://api.srv1747711.hstgr.cloud}"
FRONT="${SMOKE_FRONT:-https://food-system-sas-erp-frontend.vercel.app}"
EMAIL="${SMOKE_EMAIL:-admin@teste.com}"
PASS="${SMOKE_PASS:-123456}"

FAILED=0
WARNED=0

pass() { printf "  \033[32m✓\033[0m %s\n" "$1"; }
fail() { printf "  \033[31m✗\033[0m %s\n" "$1"; FAILED=1; }
warn() { printf "  \033[33m⚠\033[0m %s\n" "$1"; WARNED=1; }
info() { printf "  · %s\n" "$1"; }

echo "================================================================"
echo "SMOKE TEST — Produção"
echo "================================================================"
echo "Backend : $BACK"
echo "Frontend: $FRONT"
echo "Email   : $EMAIL"
echo ""

# ─── BACKEND ───────────────────────────────────────────────────────────────
echo "─ Backend ─────────────────────────────────────────────────────"

# 1) GET /api/health = 200
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$BACK/api/health")
if [ "$CODE" = "200" ]; then pass "GET /api/health = $CODE"
else                          fail "GET /api/health = $CODE (esperado 200)"; fi

# 2) POST /api/auth/login = 200
LOGIN_BODY="{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}"
LOGIN_RES=$(curl -s --max-time 30 -X POST -H "Content-Type: application/json" -d "$LOGIN_BODY" "$BACK/api/auth/login")
TOK=$(printf '%s' "$LOGIN_RES" | python -c "import sys,json
try: print(json.load(sys.stdin).get('accessToken',''))
except: print('')" 2>/dev/null)
if [ -n "$TOK" ]; then pass "POST /api/auth/login = 200 (token recebido)"
else                   fail "POST /api/auth/login (token vazio — resposta: $(printf '%s' "$LOGIN_RES" | head -c 120))"; fi

# 3) GET /api/orders/kitchen autenticado != 404
if [ -n "$TOK" ]; then
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 -H "Authorization: Bearer $TOK" "$BACK/api/orders/kitchen")
  if [ "$CODE" != "404" ] && [ "$CODE" != "000" ]; then
    pass "GET /api/orders/kitchen = $CODE (adapter Caminho 2 ativo)"
  else
    fail "GET /api/orders/kitchen = $CODE (adapter ausente — backend desatualizado)"
  fi
else
  fail "GET /api/orders/kitchen: sem token (login falhou)"
fi

# ─── FRONTEND ──────────────────────────────────────────────────────────────
echo ""
echo "─ Frontend ────────────────────────────────────────────────────"

# 4) GET /login = 200
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$FRONT/login")
if [ "$CODE" = "200" ]; then pass "GET /login = $CODE"
else                          fail "GET /login = $CODE (esperado 200)"; fi

# 5) GET /dashboard = 200 ou redirect esperado (307/302/308)
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$FRONT/dashboard")
case "$CODE" in
  200|301|302|307|308) pass "GET /dashboard = $CODE (200 ou redirect esperado)" ;;
  *)                   fail "GET /dashboard = $CODE (esperado 200/30x)" ;;
esac

# 6) /complements contém "Novo Grupo" (marca de Fase B em produção)
#    Limitação: /complements é client component (App Router) — chunk
#    específico da página NÃO está no HTML inicial (entra após hidratação).
#    Verificamos os chunks visíveis (runtime/shared). Se não achar, emite
#    WARNING (não falha) — confirmação visual via Chrome ainda é necessária.
HTML=$(curl -sL --max-time 30 "$FRONT/complements")
CHUNKS=$(printf '%s' "$HTML" | grep -oE '/_next/static/chunks/[^"]+\.js' | sort -u | head -25)
if [ -z "$CHUNKS" ]; then
  fail "/complements: nenhum chunk JS encontrado no HTML"
else
  FOUND=0
  for c in $CHUNKS; do
    if curl -s --max-time 30 "$FRONT$c" | grep -q "Novo Grupo"; then FOUND=1; break; fi
  done
  if [ $FOUND -eq 1 ]; then
    pass "/complements: 'Novo Grupo' presente (Fase B em produção)"
  else
    # /complements é client component — chunk dinâmico não está no shell.
    # Verifica que ao menos o shell respondeu OK (já validado no teste 5)
    # e emite warning sugerindo validação visual.
    warn "/complements: 'Novo Grupo' não localizado em chunks visíveis no shell HTML ($(printf '%s\n' "$CHUNKS" | wc -l | tr -d ' ') chunks inspecionados). Esperado em client component — validar visualmente no browser."
  fi
fi

# ─── RESULTADO ─────────────────────────────────────────────────────────────
echo ""
if [ $FAILED -eq 0 ] && [ $WARNED -eq 0 ]; then
  printf "\033[32m✅ TODOS OS SMOKES PASSARAM\033[0m\n"
  exit 0
elif [ $FAILED -eq 0 ]; then
  printf "\033[33m⚠  SMOKES PASSARAM COM AVISOS — validação visual recomendada\033[0m\n"
  exit 0
else
  printf "\033[31m❌ ALGUNS SMOKES FALHARAM\033[0m\n"
  exit 1
fi
