const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mainaillBot", {
  getConfig: () => ipcRenderer.invoke("config:get"),
  getVersion: () => ipcRenderer.invoke("app:version"),
  saveConfig: (value) => ipcRenderer.invoke("config:save", value),
  refreshMapping: () => ipcRenderer.invoke("mapping:refresh"),
  getWorkers: () => ipcRenderer.invoke("workers:get"),
  startWorker: (name) => ipcRenderer.invoke("workers:start", name),
  stopWorker: (name) => ipcRenderer.invoke("workers:stop", name),
  openMainaill: () => ipcRenderer.invoke("mainaill:open"),
  openLogs: () => ipcRenderer.invoke("logs:open"),
  onWorkerState: (listener) => ipcRenderer.on("workers:state", (_event, value) => listener(value)),
  onMappingError: (listener) => ipcRenderer.on("mapping:error", (_event, value) => listener(value)),
});

