# INVEST

Plataforma empresarial full-stack de **faturação, CRM, módulo Cálculo, monitorização contínua e inteligência de mercado crypto**. Interface 100% em Português de Portugal (PT-PT).

## Stack
- **Frontend:** React, React Router, Tailwind CSS, shadcn/ui, lucide-react, jsPDF, html2canvas, qrcode, recharts, sonner
- **Backend:** FastAPI, Motor (MongoDB async), PyJWT, bcrypt, qrcode, openpyxl
- **Base de dados:** MongoDB
- **IA:** GPT-5.4 (Emergent LLM key) para análise crypto estruturada
- **Dados de mercado:** Coinbase (preços/candles), Alternative.me (Fear & Greed), CoinGecko (dominância) — fontes gratuitas

## Funcionalidades
Dashboard executivo · Faturas (emissor rápido/detalhado, PDF, QR, IBAN, Multibanco, internacional, estados, vencimentos) · CRM/Clientes · Portal público de fatura · Comprovativos · Fotos & Documentos (+ página pública `/enviar/{tenant}`) · Contratos · Modelos · Relatórios (CSV/XLSX) · Histórico · Definições · Utilizadores (RBAC) · Multi-tenancy (Mesas) · Módulo Cálculo (bónus 20%, sexta-feira, arquivamento, PDF/XLSX) · Monitorização (WebSocket, heartbeat, reconexão, ecrã inteiro) · Análise Crypto (mercado, gráficos, indicadores técnicos, score, notícias, cenários, watchlist, histórico).

## Portas / Ambiente
- Backend: `0.0.0.0:8001` · rotas com prefixo `/api`
- Frontend: `3000` · usa `REACT_APP_BACKEND_URL`
- Backend usa `MONGO_URL` e `DB_NAME` do `.env`
- Ver `backend/.env.example` e `frontend/.env.example`

## Contas de demonstração (Mesa: invest)
| Papel  | Email                    | Password    |
|--------|--------------------------|-------------|
| Admin  | euapostomesmo@proton.me  | Invest2026! |
| Agente | agente@invest.pt         | Agente2026! |

## Documentação
`docs/INSTALL.md` · `docs/API.md` · `docs/DATABASE.md` · `docs/DEPLOYMENT.md`

> Nunca publicar `.env`, passwords, tokens ou o JWT secret. Use sempre `.env.example`.
