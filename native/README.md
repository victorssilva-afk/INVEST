# Crypto.Invest — Apps nativas (Android + Windows) e como publicar no GitHub

> **Importante:** os ficheiros finais (`.apk` / `.exe`) são compilados no **GitHub Actions** — não neste ambiente web. Siga os passos abaixo e descarregue os instaladores dos *artifacts* / *Releases*.

---

## A) Colocar o projeto no GitHub
1. Crie um repositório novo em https://github.com (ex.: `crypto-invest`).
2. No seu computador, na pasta do projeto:
   ```bash
   git init
   git add .
   git commit -m "Crypto.Invest"
   git branch -M main
   git remote add origin https://github.com/SEU_USER/crypto-invest.git
   git push -u origin main
   ```
   > Nunca faça commit de `.env` (já está no `.gitignore`).

## B) Gerar o APK (Android — partilha de ecrã + controlo de toques)
1. No GitHub: **Actions → Build Android APK → Run workflow** (ou crie uma tag: `git tag v1.0.0 && git push --tags`).
2. O workflow (`.github/workflows/android.yml`): faz o build web, cria o projeto Android (Capacitor), **injeta o `RemoteControlService`** (Acessibilidade) e compila o APK.
3. **Passos manuais** que o workflow assinala (uma vez, no projeto gerado):
   - Aplicar `native/android/manifest_additions.xml` ao `AndroidManifest.xml`.
   - Em `res/values/strings.xml`: `<string name="accessibility_desc">…</string>`.
   - Em `app/build.gradle` (dependencies): `implementation("com.squareup.okhttp3:okhttp:4.12.0")`.
   > Depois de aplicados uma vez e commitados, os próximos builds são automáticos.
4. Descarregue **cryptoinvest-apk → app-debug.apk** em *Actions → (run) → Artifacts*.
5. No telemóvel: instale o APK, abra a app e **ative** em *Definições → Acessibilidade → Crypto.Invest*. A partir daí o técnico consegue **tocar e deslizar** no ecrã do cliente.

## C) Gerar o instalador Windows (.exe)
1. No GitHub: **Actions → Build Windows App → Run workflow** (ou tag `v*`).
2. O workflow (`.github/workflows/windows.yml`) usa **Electron + electron-builder**.
3. Descarregue **cryptoinvest-windows → *.exe** nos *Artifacts*. (Também funciona `dmg` no Mac e `AppImage` no Linux — ver `electron/package.json`.)

## D) Publicar (Releases)
1. GitHub → **Releases → Draft a new release** → escolha a tag (ex.: `v1.0.0`).
2. Arraste os ficheiros `app-debug.apk` e o `.exe` para os *assets* → **Publish release**.
3. Partilhe o link do Release com quem vai receber suporte.
4. Play Store (opcional): gere um **AAB assinado** (`./gradlew bundleRelease` com keystore).

---

## Como funciona o controlo remoto
- **Ecrã:** o cliente partilha via WebRTC (web/APK). O técnico vê em `/crypto-invest/sessao/{código}`.
- **Toques/Swipes:** no vídeo do técnico, **clique = toque** e **arrastar = deslizar**. Os gestos são enviados pelo WebSocket e o `RemoteControlService` (Android) injeta-os com `dispatchGesture()`.
- **Windows/Mac/Linux:** a app Electron é uma janela nativa do Crypto.Invest (partilha de ecrã automática). Injeção de rato/teclado no cliente Windows pode ser adicionada com `nut.js` (opcional, futura iteração).
- **iOS:** a Apple não permite controlo remoto de toques por apps de terceiros — apenas visualização de ecrã.

## Configuração
- Troque o domínio nos ficheiros para o seu domínio de produção:
  - `capacitor.config.json` → `server.url`
  - `native/android/RemoteControlService.kt` → `baseWs`
  - `electron/main.js` → `APP_URL` (ou variável `CRYPTOINVEST_URL`)
- TURN (WebRTC): definido no backend (`TURN_USERNAME` / `TURN_CREDENTIAL`; por omissão Open Relay grátis).
