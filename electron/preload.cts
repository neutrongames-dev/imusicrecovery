import { contextBridge, ipcRenderer } from "electron"
import type { DiagnosticResult, DeviceIdentity, InventoryResult, RecoveryOptions, RecoveryProgress, RecoverySummary } from "./types.js"

contextBridge.exposeInMainWorld("iMusicRecovery", {
  diagnose: (): Promise<DiagnosticResult> => ipcRenderer.invoke("device:diagnose"),
  connect: (): Promise<DeviceIdentity> => ipcRenderer.invoke("device:connect"),
  disconnect: (): Promise<void> => ipcRenderer.invoke("device:disconnect"),
  chooseFolder: (): Promise<string | null> => ipcRenderer.invoke("output:choose"),
  inventory: (): Promise<InventoryResult> => ipcRenderer.invoke("device:inventory"),
  recover: (options: RecoveryOptions): Promise<RecoverySummary> => ipcRenderer.invoke("recovery:start", options),
  cancelRecovery: (): Promise<void> => ipcRenderer.invoke("recovery:cancel"),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke("app:open-external", url),
  revealFolder: (folder: string): Promise<void> => ipcRenderer.invoke("app:reveal-folder", folder),
  onProgress: (callback: (progress: RecoveryProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: RecoveryProgress) => callback(progress)
    ipcRenderer.on("recovery:progress", listener)
    return () => ipcRenderer.removeListener("recovery:progress", listener)
  },
  onLog: (callback: (line: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, line: string) => callback(line)
    ipcRenderer.on("recovery:log", listener)
    return () => ipcRenderer.removeListener("recovery:log", listener)
  },
})
