import { app, BrowserWindow, dialog, ipcMain, shell } from "electron"
import path from "node:path"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { connect, diagnose, errorMessage } from "./native-device.js"
import { RecoveryController } from "./recovery.js"
import type { DeviceIdentity, RecoveryOptions } from "./types.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
let mainWindow: BrowserWindow | null = null
let connectedIdentity: DeviceIdentity | null = null
const recovery = new RecoveryController()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 980,
    minHeight: 700,
    title: "iMusicRecovery",
    backgroundColor: "#0d1219",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) void shell.openExternal(url)
    return { action: "deny" }
  })
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file:") && !url.startsWith(process.env.VITE_DEV_SERVER_URL ?? "__never__")) {
      event.preventDefault()
      if (/^https:\/\//i.test(url)) void shell.openExternal(url)
    }
  })

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) void mainWindow.loadURL(devUrl)
  else void mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"))
}

ipcMain.handle("device:diagnose", async () => diagnose())
ipcMain.handle("device:connect", async () => {
  recovery.resetSession()
  connectedIdentity = await connect()
  return connectedIdentity
})
ipcMain.handle("device:disconnect", async () => { connectedIdentity = null; recovery.resetSession() })
ipcMain.handle("output:choose", async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Choose an empty iMusicRecovery folder",
    properties: ["openDirectory", "createDirectory"],
    buttonLabel: "Use this folder",
  })
  return result.canceled ? null : result.filePaths[0] ?? null
})
ipcMain.handle("device:inventory", async () => {
  if (!connectedIdentity) throw new Error("Connect the iPod first.")
  recovery.resetCancel()
  return recovery.inventory(connectedIdentity, (line) => mainWindow?.webContents.send("recovery:log", line))
})
ipcMain.handle("recovery:start", async (_event, options: RecoveryOptions) => {
  if (!connectedIdentity) throw new Error("Connect the iPod first.")
  if (!options?.outputRoot) throw new Error("Choose a recovery folder first.")
  try {
    return await recovery.recover(
      connectedIdentity,
      options,
      (progress) => mainWindow?.webContents.send("recovery:progress", progress),
      (line) => mainWindow?.webContents.send("recovery:log", line),
    )
  } catch (error) {
    throw new Error(errorMessage(error))
  }
})
ipcMain.handle("recovery:cancel", async () => recovery.cancel())
ipcMain.handle("app:open-external", async (_event, url: string) => {
  if (!/^https:\/\//i.test(url)) throw new Error("Only HTTPS links may be opened externally.")
  await shell.openExternal(url)
})
ipcMain.handle("app:reveal-folder", async (_event, folder: string) => {
  // Prefer highlighting a known file, but fall back to opening the folder.
  // A run that failed early may have no device_identity.json yet, and
  // showItemInFolder fails silently on a missing path.
  const marker = path.join(folder, "device_identity.json")
  if (existsSync(marker)) {
    shell.showItemInFolder(marker)
    return
  }
  const opened = await shell.openPath(folder)
  if (opened) throw new Error(`Could not open ${folder}: ${opened}`)
})

app.whenReady().then(() => {
  createWindow()
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit() })
