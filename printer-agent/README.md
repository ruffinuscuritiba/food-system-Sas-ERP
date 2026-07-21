# FoodSaaS Printer Agent

Agente Node.js standalone que faz polling dos jobs de impressão e envia para impressoras térmicas via ESC/POS.

## Instalação

```bash
cd printer-agent
npm install
```

## Configuração

Defina as variáveis de ambiente — ou crie um arquivo `.env` na **mesma pasta do executável** (lido automaticamente, funciona tanto rodando via `node index.js` quanto no `.exe` empacotado):

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `PRINTER_AUTH_TOKEN` | ✅ | JWT de admin da empresa (pegue no localStorage após login, ou no botão "Copiar" da tela Impressão Local) |
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

### Modo Impressora do Windows (recomendado para a maioria das térmicas brasileiras)

Use o **nome exato** da impressora tal como aparece em "Impressoras e Scanners" do Windows. Funciona com impressoras conectadas por porta COM/serial (comum em Bematech, Elgin, Tanca — que aparecem ao Windows como `NomeDaImpressora_COM3:` e não como dispositivo USB "cru"), USB genérico ou compartilhada em rede — o agente envia os bytes RAW direto pelo spooler do Windows (WinAPI), sem depender de VID/PID.

```env
PRINTER_NAME=MP-4200 TH
```

Exemplo `.env` completo:

```env
PRINTER_AUTH_TOKEN=cole_o_token_aqui
API_URL=https://api.seudominio.com/api
PRINTER_NAME=MP-4200 TH
```

## Uso

```bash
# Direto
PRINTER_AUTH_TOKEN=seu_jwt node index.js

# Com PM2 (persistente)
npm run pm2

# Executável empacotado (Windows) — crie o .env ao lado do .exe e dê duplo-clique,
# ou rode pelo terminal:
./FoodSaaS-Printer-Agent-win.exe
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
