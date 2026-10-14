# Prompt para a Emergent — Recriar plataforma de Suporte Técnico (Web + Android + PC)

> Cola o texto abaixo (a partir de "=== INÍCIO DO PROMPT ===") num novo projeto Emergent.

=== INÍCIO DO PROMPT ===

Quero uma plataforma profissional de **suporte técnico remoto** chamada **Crypto.Invest**, composta por **3 componentes** que comunicam entre si em tempo real. Responde-me sempre em **Português de Portugal (PT-PT)**.

## Visão geral
Um técnico, a partir de um painel web, consegue **ver o ecrã** de um dispositivo de um cliente (Android ou PC) e **controlá-lo remotamente** (tocar, deslizar, escrever, navegar). O cliente instala uma app (Android nativa ou Windows) ou abre uma página, carrega UM botão "Conectar", e a sessão aparece automaticamente no painel do técnico.

## Componentes

### 1) Site / Painel Web do Técnico (React + FastAPI + MongoDB)
- **Autenticação** JWT (login por email/password) com dois papéis: **Admin** (vê tudo) e **Agente/Técnico** (vê apenas os seus dispositivos). Isolamento por "mesa"/tenant.
- **Lista de aparelhos conectados** (CRM): cada dispositivo aparece como um cartão com nome, estado (online/offline/a aguardar), e uma **pré-visualização ao vivo** do ecrã. Admin pode **atribuir** sessões a técnicos, **renomear** e **apagar** aparelhos.
- **Link permanente por técnico**: cada técnico tem um link próprio (ex. `/conectar?t=TOKEN`) com botões Copiar/WhatsApp, para enviar ao cliente; o dispositivo que usar esse link fica associado a esse técnico.
- **Visualizador (viewer)** em ecrã cheio com:
  - Vídeo do ecrã do cliente (WebRTC), com clique = toque e arrastar = deslizar (swipe), com normalização correta de coordenadas (sem desalinhamento, mesmo com barras pretas/letterbox).
  - Barra de **navegação Android** (Voltar, Início, Recentes, Notificações).
  - **Teclado ao vivo** (captura teclas e escreve no dispositivo) + caixa de texto manual.
  - Botão **Reconectar** (recria a ligação com ICE restart) e reconexão automática se cair.
  - Botão **Ecrã de privacidade** (escurece o ecrã do cliente mantendo o técnico a ver — ver nota técnica).
- **Backend**: FastAPI com prefixo `/api`, MongoDB, e um **WebSocket de sinalização** (`/api/ws/support/{code}`) que faz relay de mensagens WebRTC (offer/answer/ICE) e dos comandos de controlo (toque/swipe/texto/tecla/navegação/privacidade) entre cliente e técnico. Endpoint `/api/support/ice` devolve servidores STUN/TURN. Registo automático do dispositivo via `/api/public/support/connect` (sem login, reconhece o mesmo aparelho por device_id).

### 2) App Android NATIVA (Kotlin)
- Ecrã único, minimalista: logótipo + um botão grande **CONECTAR** + indicador de estado.
- Partilha de ecrã **real** via `MediaProjection` + WebRTC nativo, transmitida ao técnico pelo mesmo protocolo WS.
- **Controlo remoto** via `AccessibilityService`: executa toque (dispatchGesture), deslize, escrita de texto no campo focado, e botões de sistema (Voltar/Início/Recentes/Notificações via performGlobalAction).
- Pede ao utilizador para ativar a Acessibilidade e a captura de ecrã 1x.
- Serviço em primeiro plano (foreground service tipo mediaProjection) + reconexão automática do WebSocket.
- Compilação via GitHub Actions (gerar APK). O URL do backend vem de BuildConfig.

### 3) App PC / Windows (Electron)
- Abre direto no modo de partilha ("/conectar?autostart=1"): auto-partilha de ecrã e auto-conecta ao técnico.
- **Controlo remoto do SO** sem módulos nativos pesados: usar um processo PowerShell persistente para mover/clicar o rato (coordenadas absolutas normalizadas, imunes a DPI) e enviar teclas.
- Ecrã de privacidade com `setContentProtection(true)` (o cliente vê preto, o técnico continua a ver normal).
- Instalador .exe gerado via GitHub Actions.

## Nota técnica importante (manter igual ao que já funciona)
- WebRTC P2P com STUN **e TURN** (relay) — ambientes restritos/emuladores precisam de TURN.
- Debounce na criação de offers (evitar negociação dupla → ecrã preto).
- Buffer de ICE candidates até `setRemoteDescription`.
- Privacidade: no Android reduz-se o **brilho** (o framebuffer capturado não é afetado); no Windows usa-se content-protection. Em navegador puro o split não é possível.
- **NÃO** incluir qualquer funcionalidade de root / FLAG_SECURE (foi removida a pedido).
- **NÃO** fazer versão iOS (o iOS não permite controlo remoto).

## DESIGN — este é o ponto mais importante
Quero uma interface que pareça feita por um **designer de produto sénior com mais de 10 anos de experiência**, **nada que pareça feito por IA**. Evita por completo o aspeto "template genérico":
- **Proibido**: gradientes roxo/violeta sobre branco; tipografias Inter/Roboto/Arial por defeito; tudo centrado com espaçamento igual; grelhas de cartões genéricas todas iguais; emojis como ícones.
- **Quero**: uma identidade visual coesa e distinta, com uma paleta própria (escolhe uma sofisticada, ex. tons escuros profundos com um acento vibrante único), profundidade real (camadas, sombras subtis, glass-morphism com blur, textura/grão muito ligeiro), layout **assimétrico e alinhado à esquerda** com respiração generosa (2–3x mais espaçamento do que o habitual).
- **Tipografia** expressiva: um par de fontes com personalidade (display + corpo) — títulos marcantes, hierarquia clara.
- **Micro-interações** em tudo: estados hover, transições suaves (apenas em opacity/transform/background, nunca `transition: all`), animações de entrada escalonadas (staggered) no carregamento, cursores/estados de seleção personalizados, animações de loading elegantes.
- **Ícones**: usar lucide-react ou FontAwesome (nunca emojis).
- **Botões** modernos (pill ou cantos vivos) com animação ao interagir.
- O viewer de suporte deve parecer uma **ferramenta de operações premium** (tipo consola profissional), com indicadores de estado em tempo real bonitos e legíveis.
- Dá atenção especial ao **primeiro ecrã** (login e lista de aparelhos) e ao **viewer** — são o cartão de visita.
- Totalmente responsivo e com dark mode nativo bem resolvido.

Entrega: web (técnico) + app Android nativa + app Windows, com a MESMA funcionalidade de partilha de ecrã e controlo remoto que já descrevi, mas com esta nova interface profissional. Começa por me propor a direção de design (paleta, tipografia, estilo dos componentes) antes de construir.

=== FIM DO PROMPT ===
