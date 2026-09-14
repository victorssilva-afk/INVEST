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

## Downloads diretos APK/.exe (2026-09-12)
- Botões do cliente descarregam já o ficheiro ao clicar (anchor → URL da Release GitHub).
- Repo: victorssilva-afk/INVEST. Links: /releases/download/latest/Crypto.Invest.apk e /Crypto.Invest-Setup.exe.
- Workflows android.yml/windows.yml agora publicam artefactos numa Release tag `latest` (softprops/action-gh-release@v2, permissions contents:write).
- electron/package.json: nsis oneClick + artifactName fixo Crypto.Invest-Setup.exe.
- IMPORTANTE: links só funcionam DEPOIS de correr os workflows (criam a Release). Browser não instala silenciosamente: descarrega e o utilizador confirma (Android: permitir origem desconhecida; Windows: executar .exe).

## Fluxo cliente self-service (2026-09-12)
- Nova página `/conectar` (SuporteDispositivo.jsx): SEM login. Um botão CONECTAR → auto-regista o dispositivo e partilha ecrã.
- Reconhecimento por device_id (localStorage) → mesmo aparelho reutiliza a mesma sessão/code (POST /public/support/connect, sem auth, tenant=invest).
- Sessão do dispositivo aparece automaticamente no CRM do técnico (admin vê todas; polling 5s). source="device".
- Apagar dispositivo/sessão no CRM: DELETE /support/sessions/{code} + botão "Apagar" no cartão.
- APK/app nativo abre direto em /conectar (RootRedirect deteta window.Capacitor.isNativePlatform).
- Fluxo antigo por link /suporte/{code} mantido para casos iniciados pelo técnico.
- Testado por curl (connect idempotente por device, listagem no CRM, delete) + screenshot da página /conectar.

## App Android NATIVA (2026-09-12)
- Projeto Kotlin em /app/android-native (Gradle 8.9 / AGP 8.5.2 / Kotlin 1.9.24, minSdk24/target34).
- Ecrã único (logo B verde + botão CONECTAR + status). Regista dispositivo via POST /api/public/support/connect (device_id em SharedPreferences).
- Partilha de ecrã REAL: MediaProjection + FGS type mediaProjection + WebRTC nativo (io.getstream:stream-webrtc-android:1.3.10) → stream para o técnico (mesmo protocolo WS offer/answer/ice do viewer web).
- Controlo remoto: RemoteControlService (AccessibilityService) executa toque (dispatchGesture tap), deslize (swipe) e TECLADO (ACTION_SET_TEXT no campo focado). Comandos chegam pelo mesmo WS via ScreenShareService.
- Acessibilidade: app pede ao utilizador para ativar 1x nas Definições (obrigatório no Android).
- Ícones launcher gerados (mipmaps) + tema dark.
- Workflow .github/workflows/android-native.yml (setup-android + gradle) compila e publica Crypto.Invest.apk na Release latest. Workflow Capacitor antigo (android.yml) REMOVIDO.
- BuildConfig.BACKEND_URL fixo ao preview — mudar se domínio de produção mudar.
- NÃO testado/compilado no container (sem Android SDK): precisa de correr no GitHub Actions e ser testado em telemóvel real. Preview do CRM (snapshots) não aparece para clientes nativos; técnico vê vídeo ao abrir a sessão.

- CORREÇÃO build #1 (2026-09-12): removida dependência org.json (duplicate class com Android framework → dex fail) e corrigida null-safety Kotlin (surfaceHelper!!, videoSource!!, videoTrack!!) + OkHttp 4 toRequestBody/toMediaTypeOrNull. setup-gradle 8.9 confirmado a funcionar.

- VALIDAÇÃO (2026-09-12): instalado JDK17+SDK34+gradle8.9 no container; build parou no aapt2 APENAS por ser arm64 (aapt2 é x86_64) — não é bug de código; GitHub runner x86_64 corre aapt2 OK. Compilei ScreenShareService.kt + RemoteControlService.kt com kotlinc 1.9.24 contra libs reais (stream-webrtc 1.3.10, okhttp 4.12, androidx.core, android.jar): exit=0, 0 erros. SDK removido de /app; adicionado android-native/.gitignore.

## Melhorias suporte (2026-09-14)
- Android cliques: RemoteControlService passou a usar getRealMetrics (ecrã completo incl. barras) em vez de resources.displayMetrics → corrige offset (toques/botões inferiores caíam acima). Mapeamento agora coincide com a captura (ScreenCapturerAndroid usa getRealMetrics).
- Android teclado: typeText usa findFocus(FOCUS_INPUT) + ACTION_SET_TEXT + ACTION_SET_SELECTION (cursor no fim). Mais fiável.
- Viewer técnico: botão "Ecrã inteiro" (video.requestFullscreen).
- Link permanente por técnico: user.support_token + GET /support/my-link; /public/support/connect aceita tech_token → sessão atribuída a esse técnico e reutilizada por device_id. Painel mostra cartão "O meu link permanente" com Copiar/WhatsApp. Link = /conectar?t=TOKEN.
- Electron (Windows): main.js agora abre /conectar?autostart=1 (era /crypto-invest = CRM). Auto-partilha de ecrã (setDisplayMediaRequestHandler) + auto-conectar. NOTA: controlo de rato/teclado no Windows NÃO implementado (Electron não injeta input do SO sem módulo nativo tipo robotjs/nut.js) — só partilha de ecrã + auto-conectar. Android tem controlo completo via Acessibilidade.
- Validado: backend curl (my-link, connect com tech_token atribui e reutiliza). Alterações Android usam APIs padrão (baixo risco); build completo continua a depender do GitHub x86_64.

- LOGO CONEXÃO (2026-09-14): nova logo aplicada aos ícones da app Android (mipmaps mdpi→xxxhdpi ic_launcher/ic_launcher_round) e Windows (electron/build/icon.ico + icon.png; package.json win.icon/nsis installerIcon/mac/linux icon). Fonte: /app/frontend/public/conexao-src.png. Aplica-se no próximo build GitHub.

## Controlo remoto Windows (2026-09-14)
- Electron app agora suporta controlo remoto do SO SEM módulo nativo: main.js executa PowerShell (user32.dll SetCursorPos+mouse_event p/ tap/swipe; System.Windows.Forms.SendKeys p/ texto), acionado por IPC.
- preload.js expõe window.CI_NATIVE.control(cmd) via contextBridge (contextIsolation).
- SuporteDispositivo.jsx: ao receber gesture/text por WS, se window.CI_NATIVE.available (Electron), converte coords normalizadas → pixels (via track getSettings width/height) e reencaminha ao main → cliques/arrasto/teclado reais no Windows.
- electron/package.json: files inclui preload.js; ícone CONEXÃO (build/icon.ico).
- Caveat DPI: em ecrãs com escala !=100% pode haver ligeiro desvio (SetCursorPos usa pixels físicos). A 100% é preciso.
- NÃO testável no container (precisa de Windows + .exe do GitHub). Frontend forwarding compila OK.

## Correção clique Windows + nova logo gerada (2026-09-14)
- Clique desalinhado corrigido: Electron passou a usar mouse_event ABSOLUTE (0x8001) com coords normalizadas 0..65535 (imune a DPI/escala) em vez de SetCursorPos em pixels. Renderer envia coords normalizadas 0..1 (sem conversão por track). Sintaxe Node validada (node --check OK).
- Logo: nova logo criada com image_generation_tool (Bitcoin+rede/circuito verde, estilo ícone app) substituiu as fotos. Aplicada a Android mipmaps + Electron icon.ico/png. Fonte: /app/frontend/public/conexao-src.png.

## Correções Android vídeo + ícone (2026-09-14)
- Ecrã preto/lento p/ técnico: ScreenShareService reduz captura (lado maior ≤1280, dimensões pares) e fps 20→15; DefaultVideoEncoderFactory highProfile true→false (H264 baseline, mais compatível com browser). Coords de controlo continuam normalizadas (independentes da resolução).
- Ícone "estranho" (pequeno em círculo branco): criado ícone adaptativo — mipmap-anydpi-v26/ic_launcher.xml + ic_launcher_round.xml (foreground @mipmap/ic_launcher_fg + background @color/ic_launcher_background=#040718). Foregrounds ic_launcher_fg.png gerados por densidade (logo ~74% centrada em canvas transparente). Fonte: logo gerada por IA (conexao-src.png).
- Viewer confirmado correto (autoplay/muted/playsInline/ontrack). Aplica-se no próximo build GitHub.

## Backlog / Próximos (P1/P2)
- P1: Notificações por email (preparado, desativado a pedido).
- P1: Dados macro/on-chain reais (requerem fontes/chaves pagas — atualmente "Dados indisponíveis nesta fonte").
- P2: Modo rápido (modal) de emissão de fatura; alertas de preço crypto configuráveis.
- P2: PWA instalável do painel de Monitorização.
