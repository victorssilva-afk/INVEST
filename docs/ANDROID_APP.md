# Crypto.Invest — App Android/PWA

## 1) Instalação instantânea (PWA — recomendada, já funciona)
A página do cliente (`/suporte/{código}`) deteta o Android e mostra **"Instalar App"**.
- No Chrome Android: toca em **Instalar App** (ou menu ⋮ → *Instalar aplicação*).
- A app instala uma **casca leve** e, como usa Service Worker, **atualiza-se sozinha** sempre que abrir (o "instalador vem vazio e o sistema entra na atualização").
- Funciona também em Windows/Mac/Linux/iOS (iOS: *Partilhar → Adicionar ao ecrã principal*).
- **Partilha de ecrã** funciona na PWA (WebRTC `getDisplayMedia`).

## 2) APK nativo para GitHub (Capacitor)
O workflow `.github/workflows/android.yml` gera um **APK** automaticamente:
1. Faça push do projeto para o GitHub.
2. Vá a **Actions → Build Android APK → Run workflow** (ou crie uma tag `v1.0.0`).
3. Descarregue o artefacto **cryptoinvest-apk** (`app-debug.apk`) e publique em *Releases*.

O `capacitor.config.json` usa `server.url` a apontar para o site publicado — por isso o **APK é um shell fino que carrega sempre a versão mais recente** (auto-atualização). Para publicar na Play Store, gere um APK/AAB *release* assinado (`assembleRelease` + keystore).

> Troque `server.url` para o seu domínio de produção antes de compilar.

## 3) Controlo remoto de toques / "escorregar o dedo" — importante
- **Ver o ecrã** do cliente: ✅ possível (PWA e APK).
- **Controlar o dispositivo** (injetar toques/swipes no ecrã do cliente a partir do técnico): ❌ **não é possível em web/PWA** por segurança do Android/iOS.
- Para controlo remoto real de toques no Android é obrigatório um **AccessibilityService** nativo (o cliente autoriza em *Definições → Acessibilidade*), tipicamente com `dispatchGesture()` para simular swipes. Isto exige código nativo (Kotlin) adicionado ao projeto Capacitor e **não pode ser compilado neste ambiente web** — faz-se no projeto Android gerado pelo workflow acima.
- No iOS, a Apple **não permite** controlo remoto de toques por apps de terceiros.

Enquanto isso, o técnico orienta o cliente com o **círculo vermelho** (já implementado): o cliente vê exatamente onde tocar/deslizar.
