# Passar o "ecrã preto" (FLAG_SECURE) no emulador Android

## Porque é que fica preto?
Apps como o **Chrome (separador anónimo)**, **apps bancárias**, **conteúdo com DRM (Netflix)** e **alguns jogos** marcam as janelas com a flag de segurança do Android **`FLAG_SECURE`**. O próprio Android (system_server / SurfaceFlinger) **pinta essas janelas a preto em QUALQUER partilha/gravação de ecrã** — inclui a nossa app (MediaProjection), screenshots e screencast.

**Facto técnico:** não existe nenhum comando nem truque em tempo real para desligar isto num Android normal. A ÚNICA forma real é **ao nível do framework**, e isso exige **root**. Como usa **emuladores (que têm root)**, é possível.

O método fiável e mantido é o módulo **DisableFlagSecure** (LSPosed), que faz *hook* ao `WindowState.isSecureLocked` do sistema. Depois de ativo, TODAS as apps ficam visíveis na partilha.

---

## Opção 1 — Automática (dentro da app Crypto.Invest)
A app instala o **APK do módulo** por si (com root). Faltam sempre 2 passos manuais que o LSPosed obriga (ativar + reiniciar).

### 1a — Pelo aparelho
1. Garanta que o emulador tem **root**, **Magisk (com Zygisk)** e **LSPosed** instalados (ver Opção 2, passos 1–3).
2. Abra a app **Crypto.Invest** → **"ATIVAR SUPORTE TOTAL (root)"** → leia e **aceite o aviso legal**.
3. A app descarrega e instala o módulo automaticamente.
4. Abra o **LSPosed** → **Módulos** → ative **"DisableFlagSecure"** com âmbito **"Framework do Sistema / System"**.
5. **Reinicie o emulador.** Pronto — Chrome anónimo, jogos e bancos ficam visíveis.

### 1b — Pedido pelo técnico (viewer)
1. No viewer (CRM → Crypto.Invest → sessão), se disser **"Root: sim"**, clique em **"Desbloquear FLAG_SECURE (root)"**.
2. Se o cliente ainda não consentiu, ele recebe uma **notificação** para autorizar (aviso legal) — toca e aceita.
3. Depois faça os passos 4–5 acima (ativar no LSPosed + reiniciar).

---

## Opção 2 — Manual (garantida)

### Passo 1 — Root no emulador
- **BlueStacks / LDPlayer / MEmu / Nox**: Definições → ativar **Root**.
- **Android Studio AVD**: imagem **"Google APIs"** (não "Google Play") → `adb root`.
- **Genymotion**: já tem root.

### Passo 2 — Magisk + Zygisk
1. Instale o **Magisk** (https://github.com/topjohnwu/Magisk/releases).
2. No Magisk → Definições → ative **Zygisk** → reinicie.

### Passo 3 — LSPosed
1. Descarregue o **LSPosed (Zygisk)** de https://github.com/JingMatrix/LSPosed/releases (fork mantido) — ficheiro `.zip`.
2. Magisk → **Módulos** → **Instalar a partir de ficheiro** → o `.zip` do LSPosed → **reinicie**.

### Passo 4 — Módulo DisableFlagSecure
1. Descarregue o APK: **https://github.com/veeti/DisableFlagSecure/releases/download/1.2/1.2.apk**
   (alternativa: https://github.com/Dev97633/FLAG_SECURE-next/releases)
2. Instale o APK no emulador.
3. Abra o **LSPosed** → **Módulos** → ative **DisableFlagSecure** com âmbito **"System Framework"**.
4. **Reinicie o emulador.**

### Passo 5 — Confirmar
- Abra o Chrome anónimo ou um jogo e confirme na partilha do técnico que já aparece (não preto).

---

## Casos especiais
- **Chrome anónimo (sem root):** no Chrome, `chrome://flags` → ativar **"Incognito Screenshot"** → reiniciar o Chrome. Resolve só o Chrome anónimo.
- **DRM (Netflix, Prime):** mesmo com o módulo ativo, o vídeo pode não aparecer — a descodificação DRM é por hardware e não passa pela captura. Limitação do próprio DRM.
