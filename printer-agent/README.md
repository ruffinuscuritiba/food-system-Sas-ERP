# FoodSaaS Printer Agent

Agente Node.js standalone que faz polling dos jobs de impressão e envia para impressoras térmicas via ESC/POS.

## Instalação

```bash
cd printer-agent
npm install
```

## Configuração

Defina as variáveis de ambiente:

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `PRINTER_AUTH_TOKEN` | ✅ | JWT de admin da empresa (pegue no localStorage após login) |
| `API_URL` | | URL do backend (default: `http://localhost:3001/api`) |
| `POLL_INTERVAL_MS` | | Intervalo de polling em ms (default: `5000`) |
| `PAPER_WIDTH` | | Largura do papel: `58` ou `80` (default: `80`) |

### Modo USB

```env
USB_VENDOR_ID=0x04b8
USB_PRODUCT_ID=0x0202
```

### Modo Rede (TCP)

```env
NETWORK_HOST=192.168.1.100
NETWORK_PORT=9100
```

## Uso

```bash
# Direto
PRINTER_AUTH_TOKEN=seu_jwt node index.js

# Com PM2 (persistente)
npm run pm2
```

## Como obter o JWT

1. Faça login no sistema
2. Abra o DevTools → Application → Local Storage
3. Copie o valor de `token`

O token expira em 24h (padrão do sistema). Use um usuário ADMIN para ter acesso às rotas de jobs.

## Fluxo

1. Agent busca `GET /printers/jobs?status=PENDING` a cada 5s
2. Para cada job: marca como `SENT`, imprime via ESC/POS, marca como `PRINTED`
3. Em caso de erro: marca como `FAILED` com motivo
