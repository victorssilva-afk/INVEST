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

const MOUSE = "Add-Type -Name U -Namespace W -MemberDefinition '[DllImport(\"user32.dll\")] public static extern bool SetCursorPos(int X,int Y); [DllImport(\"user32.dll\")] public static extern void mouse_event(uint f,uint dx,uint dy,uint d,int e);';";

function tap(x, y) {
  ps(`${MOUSE} [W.U]::SetCursorPos(${x | 0},${y | 0}); [W.U]::mouse_event(2,0,0,0,0); Start-Sleep -Milliseconds 40; [W.U]::mouse_event(4,0,0,0,0)`);
}

function swipe(x, y, x2, y2, dur) {
  const steps = 14;
  const per = Math.max(5, Math.round((dur || 350) / steps));
  let s = `${MOUSE} [W.U]::SetCursorPos(${x | 0},${y | 0}); [W.U]::mouse_event(2,0,0,0,0);`;
  for (let i = 1; i <= steps; i++) {
    const ix = Math.round(x + (x2 - x) * (i / steps));
    const iy = Math.round(y + (y2 - y) * (i / steps));
    s += ` Start-Sleep -Milliseconds ${per}; [W.U]::SetCursorPos(${ix},${iy});`;
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
