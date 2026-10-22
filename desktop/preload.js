const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("gemboDesktop", {
  browserLogin: () => ipcRenderer.invoke("gembo:browser-login")
});
