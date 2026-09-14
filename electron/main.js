const { app, BrowserWindow, desktopCapturer, session, ipcMain } = require("electron");
const path = require("path");
const { execFile } = require("child_process");

// Crypto.Invest — janela desktop (Windows) que carrega a pagina de partilha e liga automaticamente.
// A partilha de ecra (getDisplayMedia) e concedida automaticamente ao 1o ecra.
// O controlo remoto (cliques/arrasto/teclado) e executado no SO via PowerShell (user32.dll) — sem modulo nativo.
const APP_URL = process.env.CRYPTOINVEST_URL || "https://invest-analysis-14.preview.emergentagent.com/conectar?autostart=1";

function ps(script) {
  try {
    execFile("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], { windowsHide: true }, () => {});
  } catch (e) { /* ignore */ }
}

const MOUSE = "Add-Type -Name U -Namespace W -MemberDefinition '[DllImport(\"user32.dll\")] public static extern void mouse_event(uint f,uint dx,uint dy,uint d,int e);';";

function clamp01(v) { return Math.min(1, Math.max(0, v)); }
function absMove(nx, ny) {
  // Coordenadas absolutas normalizadas (0..65535) — imunes a DPI/escala do ecra.
  return `[W.U]::mouse_event(0x8001,${Math.round(clamp01(nx) * 65535)},${Math.round(clamp01(ny) * 65535)},0,0);`;
}

function tap(nx, ny) {
  ps(`${MOUSE} ${absMove(nx, ny)} Start-Sleep -Milliseconds 25; [W.U]::mouse_event(2,0,0,0,0); Start-Sleep -Milliseconds 45; [W.U]::mouse_event(4,0,0,0,0)`);
}

function swipe(nx, ny, nx2, ny2, dur) {
  const steps = 16;
  const per = Math.max(5, Math.round((dur || 350) / steps));
  let s = `${MOUSE} ${absMove(nx, ny)} [W.U]::mouse_event(2,0,0,0,0);`;
  for (let i = 1; i <= steps; i++) {
    const ix = nx + (nx2 - nx) * (i / steps);
    const iy = ny + (ny2 - ny) * (i / steps);
    s += ` Start-Sleep -Milliseconds ${per}; ${absMove(ix, iy)}`;
  }
  s += " [W.U]::mouse_event(4,0,0,0,0)";
  ps(s);
}

function typeText(v) {
  const esc = String(v || "").replace(/([+^%~(){}\[\]])/g, "{$1}").replace(/"/g, '`"');
  ps(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("${esc}")`);
}

ipcMain.on("ci-control", (_e, c) => {
  if (process.platform !== "win32" || !c) return;
  try {
    if (c.action === "tap") tap(c.x, c.y);
    else if (c.action === "swipe") swipe(c.x, c.y, c.x2, c.y2, c.duration);
    else if (c.action === "text") typeText(c.value);
  } catch (e) { /* ignore */ }
});

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

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
