# INVEST — PRD

## Problema
Plataforma empresarial full-stack (PT-PT) de faturação + CRM + módulo Cálculo + monitorização contínua + inteligência de mercado crypto, preparada para produção 24/7.

## Arquitetura
- Frontend React (Tailwind, shadcn/ui, recharts, jsPDF, qrcode) — `REACT_APP_BACKEND_URL`, rotas `/app/*` + públicas `/emitir`, `/enviar`, `/fatura`.
- Backend FastAPI + Motor (MongoDB), todas as rotas com prefixo `/api`. `server.py` + `crypto_service.py`.
- Auth JWT (Bearer em localStorage `invest_token`) + bcrypt + brute-force + RBAC + isolamento por `tenant_id`.
- Scheduler asyncio: expira faturas vencidas e arquiva entradas de Cálculo (independente do navegador).
- Monitorização via WebSocket `/api/ws/monitor` com heartbeat + reconexão backoff.
- Crypto: Coinbase (preços/candles), Alternative.me (Fear&Greed), CoinGecko (dominância, best-effort), GPT-5.4 (análise).

## Personas
- **Admin** (euapostomesmo@proton.me): acesso total à Mesa invest.
- **Agente** (agente@invest.pt): emite/gere faturas e clientes; sem eliminação crítica nem gestão de utilizadores.
- (Portal de cliente desativado a pedido do utilizador.)

## Requisitos estáticos
Multi-tenancy por Mesa · PT-PT · cores navy/dourado · numeração FAT-<ano>-<6díg> · IBAN PT (máscara+validação) · estados de fatura · PDF+QR · CSV/XLSX reais · bónus 20% + sexta-feira · segurança (JWT/bcrypt/RBAC/rate-limit).

## Implementado (2026-09-11)
- Auth JWT + RBAC + brute-force (X-Forwarded-For, janela 15 min) + seed admin/agente.
- Dashboard executivo (KPIs, gráficos, recentes, contadores).
- Faturas: emissor detalhado, itens com cálculo automático, prazos, IBAN/Multibanco/internacional, estados, PDF+QR, WhatsApp, link público, edição, eliminação (admin).
- CRM/Clientes + detalhe com métricas e histórico.
- Comprovativos (aceitar/recusar/pedir novo, aceitar→pago), Uploads (galeria + partilha + página pública), Contratos, Modelos.
- Relatórios (filtros + exportação CSV/XLSX real), Histórico, Definições, Utilizadores.
- Cálculo (perfis, bónus 20%, sexta-feira, arquivamento automático, PDF+XLSX).
- Monitorização (WebSocket, uptime, relógio, ecrã inteiro, estados de ligação).
- Análise Crypto (mercado real, gráfico, indicadores RSI/MACD/EMA/Bollinger, score multi-fator + confiança, relatório IA GPT-5.4, notícias, fontes, watchlist, cenários, histórico).
- Páginas públicas: /emitir/{tenant}, /enviar/{tenant}, /fatura/{number}.
- Testado: backend 37/39 pytest; frontend 100% módulos carregam.

## Crypto.Invest — atualização (2026-09-12)
- Painel/cliente/viewer/login com nova identidade: fundo cinza escuro (#171A1F) + botões verde-claro (#4ADE80).
- Prévia AO VIVO da partilha em cada cartão de sessão (snapshots JPEG ~2.5s via WS role=preview) antes de "Abrir ecrã".
- Admin cria perfis de agente (reutiliza POST /api/users) e atribui/reatribui sessões a agentes (POST /support/sessions/{code}/assign).
- Renomear aparelho por sessão (PATCH /support/sessions/{code}/rename).
- Isolamento: admin vê todas as sessões da mesa; agente vê apenas owned OU assigned. GET /support/agents é admin-only (403 para agente).
- Viewer: botão "Reconectar" funcional (recria WS+RTCPeerConnection; cliente re-oferece ao detetar peer tech).
- Cliente Windows: após COMEÇAR, botão "Instalar aplicação (Windows)" — usa REACT_APP_WINDOWS_APP_URL (.exe) se definido, senão PWA/instruções.
- Testado: endpoints via curl (criar agente, atribuir, renomear, isolamento, RBAC); UI via screenshot (prévia AO VIVO confirmada em sessão real).

## Backlog / Próximos (P1/P2)
- P1: Notificações por email (preparado, desativado a pedido).
- P1: Dados macro/on-chain reais (requerem fontes/chaves pagas — atualmente "Dados indisponíveis nesta fonte").
- P2: Modo rápido (modal) de emissão de fatura; alertas de preço crypto configuráveis.
- P2: PWA instalável do painel de Monitorização.
