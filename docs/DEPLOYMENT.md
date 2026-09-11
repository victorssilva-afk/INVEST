# Deployment 24/7 — INVEST

## Arquitetura
```
INTERNET → Reverse Proxy (Nginx) → Frontend (React build)  e  /api → Backend (FastAPI:8001) → MongoDB
```
O backend é **independente do navegador**: a página de Monitorização é apenas um painel que se liga por WebSocket e reconecta automaticamente. Fechar o Chrome não afeta o servidor.

## Reinício automático
- **supervisor** (ambiente atual) ou **systemd** garantem o restart do processo FastAPI em caso de falha.
- Health check: `GET /api/health` → `{status, database, timestamp, uptime}`.
- Scheduler interno (asyncio) expira faturas pendentes vencidas e arquiva entradas de Cálculo — corre no servidor, 24/7.

## Exemplo systemd (produção)
```ini
[Service]
WorkingDirectory=/app/backend
ExecStart=/usr/bin/uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always
```

## Segurança
- JWT + bcrypt, expiração de token, proteção brute-force, RBAC, isolamento por tenant, validação de inputs, CORS configurável (`CORS_ORIGINS`).
- HTTPS deve ser terminado no reverse proxy.
- Segredos apenas via `.env` (nunca no código). Publicar apenas `.env.example`.

## PWA / Painel Chrome
A página `/app/monitorizacao` suporta ecrã inteiro e destina-se a ficar aberta num monitor como painel permanente, com limpeza correta de timers/listeners/WebSocket para evitar memory leaks.
