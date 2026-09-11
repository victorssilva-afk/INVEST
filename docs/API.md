# API — INVEST

Todas as rotas têm prefixo `/api`. Autenticação por JWT Bearer (`Authorization: Bearer <token>`), token guardado no frontend em `localStorage` como `invest_token`. O JWT contém o claim `tenant_id`.

## Autenticação
- `POST /api/auth/login` → `{ token, user }`
- `GET /api/auth/me`

## Utilizadores (admin)
- `GET/POST /api/users` · `PUT/DELETE /api/users/{id}`

## Definições
- `GET /api/settings` · `PUT /api/settings` (admin)

## Clientes
- `GET/POST /api/clients` · `GET/PUT /api/clients/{id}` · `DELETE /api/clients/{id}` (admin)

## Faturas
- `GET/POST /api/invoices` · `GET/PUT/DELETE /api/invoices/{id}`
- `GET /api/invoices/next-number` · `PATCH /api/invoices/{id}/status`

## Público (sem auth)
- `POST /api/public/invoice/create?tenant=<mesa>`
- `GET /api/public/invoice/{number}`
- `POST /api/public/upload/{tenant}` (multipart)
- `POST /api/public/proof/{tenant}` (multipart)

## Comprovativos / Uploads
- `GET/POST /api/proofs` · `PATCH /api/proofs/{id}` · `GET /api/proofs/{id}/file`
- `GET/POST /api/uploads` · `DELETE /api/uploads/{id}`

## Contratos / Modelos / Relatórios / Histórico
- `GET/POST/PUT/DELETE /api/contracts` · `GET/POST/DELETE /api/templates`
- `GET /api/reports` · `GET /api/reports/export?fmt=csv|xlsx`
- `GET /api/history`

## Cálculo
- `GET/POST /api/calc/profiles` · `DELETE /api/calc/profiles/{id}`
- `POST /api/calc/entries` · `DELETE /api/calc/entries/{id}`
- `GET /api/calc/export?profile_id=<id>` (XLSX)

## Crypto
- `GET /api/crypto/market` · `GET /api/crypto/assets/{symbol}?days=` · `GET /api/crypto/news`
- `GET /api/crypto/sources` · `POST /api/crypto/analysis` · `GET /api/crypto/analysis/{symbol}`
- `GET /api/crypto/history` · `DELETE /api/crypto/history/{id}`
- `GET/POST /api/crypto/watchlist` · `DELETE /api/crypto/watchlist/{symbol}`

## Sistema
- `GET /api/health` · `GET /api/monitor/stats` · `WS /api/ws/monitor`
