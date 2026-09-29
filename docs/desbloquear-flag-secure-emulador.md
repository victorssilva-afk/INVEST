# Desbloquear o "ecrã preto" (FLAG_SECURE) no emulador Android

## Porque é que fica preto?
Apps como o **Chrome (separador anónimo)**, **apps bancárias**, **conteúdo com DRM (Netflix)** e **alguns jogos** marcam as suas janelas com a flag de segurança do Android **`FLAG_SECURE`**. Esta flag obriga o próprio Android a **pintar essas janelas a preto em QUALQUER partilha/gravação de ecrã** — inclui MediaProjection (a nossa app), screenshots e screencast.

**Nenhuma app de suporte (a nossa, o TeamViewer ou o AnyDesk) consegue ignorar isto por código num Android normal.** É uma barreira ao nível do sistema operativo. A única forma de desativar é **ao nível do framework**, o que requer **root**.

Como usa **emuladores (que quase sempre têm root)**, tem duas formas de resolver: **automática** (dentro da app) ou **manual** (este guia).

---

## Opção 1 — Automática (dentro da app Crypto.Invest)
1. Garanta que o emulador tem **root** e o **Magisk** instalados (ver Opção 2, passo 1–2, se ainda não tiver).
2. No **viewer do técnico** (CRM → Crypto.Invest → sessão), veja a barra de estado do aparelho. Se disser **"FLAG_SECURE: bloqueado"** e **"Root: sim"**, aparece o botão **"Desbloquear FLAG_SECURE (root)"**.
3. Clique nesse botão. A app no emulador vai descarregar e instalar automaticamente o módulo Magisk que desativa o FLAG_SECURE.
4. Quando aparecer a notificação **"Desbloqueio instalado"**, **reinicie o emulador**.
5. Reconecte — agora Chrome anónimo, jogos e bancos ficam visíveis.

> Se o botão disser que falhou (URL indisponível, sem Magisk, etc.), use a Opção 2 (manual).

---

## Opção 2 — Manual (garantida)

### Passo 1 — Ter root no emulador
- **BlueStacks**: Definições → Avançado → ativar **Root**.
- **LDPlayer / MEmu / Nox**: Definições → ativar **Root**.
- **Android Studio AVD**: use uma imagem **"Google APIs"** (não "Google Play") — tem `adb root`. No terminal: `adb root`.
- **Genymotion**: já vem com root ativo.

### Passo 2 — Instalar o Magisk (se o emulador não trouxer)
- Descarregue o `Magisk.apk` de https://github.com/topjohnwu/Magisk/releases e instale-o no emulador.
- Alguns emuladores já trazem uma app de root; nesse caso pode saltar este passo.

### Passo 3 — Instalar o módulo que desativa o FLAG_SECURE
Escolha **A** (mais simples, recomendado) ou **B**.

**A) Módulo Magisk "FlagSecure Disabler" (patch do framework):**
1. Descarregue o módulo de https://github.com/BlassGO/Android-FlagSecure-Disabler/releases (ficheiro `.zip`).
2. Abra o **Magisk** → separador **Módulos** → **Instalar a partir de ficheiro** → escolha o `.zip`.
3. **Reinicie o emulador.**
4. Pronto: o FLAG_SECURE fica desativado em todo o sistema.

**B) LSPosed + módulo "Disable-FLAG_SECURE" (alternativa por hook):**
1. Instale o **LSPosed** (via Magisk, precisa de Zygisk ativo).
2. No LSPosed, instale o módulo **"Disable-FLAG_SECURE"** (https://github.com/VarunS2002/Xposed-Disable-FLAG_SECURE).
3. Ative-o com **âmbito = System Framework**.
4. **Reinicie o emulador.**

### Passo 4 — Confirmar
- Abra o Chrome em separador anónimo, ou um jogo, e verifique na partilha do técnico que já aparece (não preto).

---

## Casos especiais
- **Chrome anónimo (sem root):** no próprio Chrome, abrir `chrome://flags` → ativar **"Incognito Screenshot"** → reiniciar o Chrome. Isto resolve só o Chrome anónimo, sem root.
- **DRM (Netflix, Prime Video):** mesmo com o FLAG_SECURE desativado, o vídeo pode não aparecer, porque a descodificação DRM é feita por hardware e não passa pela captura. É uma limitação do próprio DRM.
