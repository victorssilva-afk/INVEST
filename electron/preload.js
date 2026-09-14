const { contextBridge, ipcRenderer } = require("electron");

// Expoe uma ponte segura para o site enviar comandos de controlo remoto ao SO (Windows).
contextBridge.exposeInMainWorld("CI_NATIVE", {
  available: true,
  platform: process.platform,
  control: (cmd) => ipcRenderer.send("ci-control", cmd),
});
