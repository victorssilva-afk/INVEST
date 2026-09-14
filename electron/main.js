const { app, BrowserWindow, desktopCapturer, session } = require("electron");

// Crypto.Invest — janela desktop (Windows/Mac/Linux) que carrega o site.
// A partilha de ecrã (getDisplayMedia) é concedida automaticamente ao 1º ecrã.
const APP_URL = process.env.CRYPTOINVEST_URL || "https://invest-analysis-14.preview.emergentagent.com/conectar?autostart=1";

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    title: "Crypto.Invest",
    backgroundColor: "#0B1A30",
    webPreferences: { contextIsolation: true },
  });

  // Permitir partilha de ecrã sem diálogo bloqueante
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
