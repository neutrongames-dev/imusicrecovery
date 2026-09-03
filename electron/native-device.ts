import { app } from "electron"
import { access } from "node:fs/promises"
import { constants } from "node:fs"
import { spawn } from "node:child_process"
import path from "node:path"
import type { AfcEntry, DeviceIdentity, DiagnosticResult } from "./types.js"

interface CommandResult { code: number; stdout: string; stderr: string }

const SUPPORTED_IPOD_TOUCH = new Map([
  ["iPod1,1", "iPod touch (1st generation)"],
  ["iPod2,1", "iPod touch (2nd generation)"],
  ["iPod3,1", "iPod touch (3rd generation)"],
  ["iPod4,1", "iPod touch (4th generation)"],
  ["iPod5,1", "iPod touch (5th generation)"],
  ["iPod7,1", "iPod touch (6th generation)"],
  ["iPod9,1", "iPod touch (7th generation)"],
])

export function supportedDeviceName(productType: string): string | null {
  return SUPPORTED_IPOD_TOUCH.get(productType) ?? null
}

function nativeRoot(): string {
  return app.isPackaged ? path.join(process.resourcesPath, "native") : path.resolve(process.cwd(), "vendor", "native")
}

async function exists(file: string): Promise<boolean> {
  try { await access(file, constants.F_OK); return true } catch { return false }
}

async function resolveTool(name: string): Promise<string> {
  const exe = process.platform === "win32" && !name.toLowerCase().endsWith(".exe") ? `${name}.exe` : name
  const local = path.join(nativeRoot(), exe)
  if (await exists(local)) return local
  // Development fallback: allow tools already on PATH.
  return exe
}

export async function nativeToolsReady(): Promise<boolean> {
  if (process.platform !== "win32") return false
  const root = nativeRoot()
  return Promise.all(["afc-ro.exe", "idevice_id.exe", "ideviceinfo.exe", "idevicepair.exe", "openssl-legacy.cnf"].map((n) => exists(path.join(root, n))))
    .then((results) => results.every(Boolean))
}


function nativeEnvironment(): NodeJS.ProcessEnv {
  const config = path.join(nativeRoot(), "openssl-legacy.cnf")
  return { ...process.env, OPENSSL_CONF: config, OPENSSL_MODULES: path.join(nativeRoot(), "ossl-modules") }
}

async function run(tool: string, args: string[], timeoutMs = 30_000): Promise<CommandResult> {
  const command = await resolveTool(tool)
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: nativeEnvironment() })
    let stdout = ""
    let stderr = ""
    const timer = setTimeout(() => { child.kill(); reject(new Error(`${path.basename(command)} timed out.`)) }, timeoutMs)
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk) => { stdout += chunk })
    child.stderr.on("data", (chunk) => { stderr += chunk })
    child.on("error", (error) => { clearTimeout(timer); reject(error) })
    child.on("close", (code) => { clearTimeout(timer); resolve({ code: code ?? -1, stdout, stderr }) })
  })
}

async function appleServiceState(): Promise<DiagnosticResult["appleService"]> {
  if (process.platform !== "win32") return "unknown"
  try {
    const result = await new Promise<CommandResult>((resolve, reject) => {
      const child = spawn("sc.exe", ["query", "Apple Mobile Device Service"], { windowsHide: true })
      let stdout = ""; let stderr = ""
      child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8")
      child.stdout.on("data", (d) => { stdout += d }); child.stderr.on("data", (d) => { stderr += d })
      child.on("error", reject); child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }))
    })
    const text = `${result.stdout}\n${result.stderr}`
    if (/RUNNING/i.test(text)) return "running"
    if (/STOPPED/i.test(text)) return "stopped"
    if (/1060|does not exist/i.test(text)) return "missing"
    return "unknown"
  } catch { return "unknown" }
}

export async function listDevices(): Promise<string[]> {
  const result = await run("idevice_id", ["-l"], 15_000)
  if (result.code !== 0) throw new Error(cleanError(result, "Could not enumerate Apple devices."))
  return result.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
}

async function infoValue(udid: string, key: string, simple = false): Promise<string> {
  const args = [...(simple ? ["-s"] : []), "-u", udid, "-k", key]
  const result = await run("ideviceinfo", args, 20_000)
  if (result.code !== 0) return ""
  return result.stdout.trim()
}

export async function getIdentity(udid: string, simple = false): Promise<DeviceIdentity> {
  const [deviceName, productType, productVersion, serialNumber] = await Promise.all([
    infoValue(udid, "DeviceName", simple),
    infoValue(udid, "ProductType", simple),
    infoValue(udid, "ProductVersion", simple),
    infoValue(udid, "SerialNumber", simple),
  ])
  return {
    udid,
    deviceName: deviceName || "iPod",
    productType: productType || "Unknown",
    productVersion: productVersion || "Unknown",
    serialNumber: serialNumber || undefined,
  }
}

export async function validatePairing(udid: string): Promise<boolean> {
  const result = await run("idevicepair", ["-u", udid, "validate"], 20_000)
  return result.code === 0
}

export async function pairDevice(udid: string): Promise<void> {
  const result = await run("idevicepair", ["-u", udid, "pair"], 65_000)
  if (result.code !== 0) throw new Error(cleanError(result, "Pairing failed. Unlock the iPod and approve Trust/Pair if prompted, then retry."))
  if (!(await validatePairing(udid))) throw new Error("The pairing command completed but the pairing record could not be validated.")
}

export async function diagnose(): Promise<DiagnosticResult> {
  const tools = await nativeToolsReady()
  const appleService = await appleServiceState()
  if (process.platform !== "win32") {
    return { platform: process.platform, nativeToolsReady: tools, appleService, devices: [], message: "This first desktop build targets Windows x64." }
  }
  if (!tools) {
    return { platform: process.platform, nativeToolsReady: false, appleService, devices: [], message: "Native iPod support files are missing from this build. Use a packaged Windows release, not the raw source folder." }
  }
  let devices: string[] = []
  try { devices = await listDevices() } catch (error) {
    return { platform: process.platform, nativeToolsReady: true, appleService, devices: [], message: `${errorMessage(error)} Apple Mobile Device Support may be missing or stopped.` }
  }
  if (!devices.length) {
    return { platform: process.platform, nativeToolsReady: true, appleService, devices, message: "No Apple mobile device was detected. Connect the iPod by USB and unlock it if possible." }
  }
  const udid = devices[0]!
  const identity = await getIdentity(udid, true)
  const paired = await validatePairing(udid)
  return { platform: process.platform, nativeToolsReady: true, appleService, devices, identity, paired, message: paired ? "Device detected and pairing is valid." : "Device detected. Pairing/trust is required before AFC media access can start." }
}

export async function connect(): Promise<DeviceIdentity> {
  if (!(await nativeToolsReady())) throw new Error("Native iPod support files are missing from this build.")
  const devices = await listDevices()
  if (!devices.length) throw new Error("No Apple mobile device detected. Connect the iPod by USB and try again.")
  if (devices.length > 1) throw new Error("More than one Apple device is connected. Disconnect the others during recovery so the correct iPod cannot be confused with another device.")
  const udid = devices[0]!
  const preflight = await getIdentity(udid, true)
  if (preflight.productType !== "Unknown" && !supportedDeviceName(preflight.productType)) {
    throw new Error(`This first desktop release supports iPod touch 1st–7th generation. Detected ${preflight.productType}. Traditional iPod Classic/Nano/Mini/Photo/Video support requires the separate Disk Mode backend planned for a later release.`)
  }
  if (!(await validatePairing(udid))) await pairDevice(udid)
  const identity = await getIdentity(udid, false)
  const friendly = supportedDeviceName(identity.productType)
  if (!friendly) {
    throw new Error(`This first desktop release supports iPod touch 1st–7th generation. Detected ${identity.productType || "an unsupported Apple device"}. Traditional iPod Classic/Nano/Mini/Photo/Video support requires the separate Disk Mode backend planned for a later release.`)
  }
  return { ...identity, deviceName: identity.deviceName || friendly }
}

export async function afcList(udid: string, remotePath: string): Promise<AfcEntry[]> {
  const safe = normalizeRemote(remotePath)
  const result = await run("afc-ro", ["list", udid, safe], 30_000)
  if (result.code !== 0) throw new Error(cleanError(result, `Could not list ${safe}.`))
  try { return JSON.parse(result.stdout) as AfcEntry[] } catch { throw new Error(`Invalid response while listing ${safe}.`) }
}

export async function afcPull(udid: string, remotePath: string, localPath: string): Promise<{ bytes: number; sha256: string }> {
  const safe = normalizeRemote(remotePath)
  const result = await run("afc-ro", ["pull", udid, safe, localPath], 30 * 60_000)
  if (result.code !== 0) throw new Error(cleanError(result, `Could not read ${safe}.`))
  try { return JSON.parse(result.stdout) as { bytes: number; sha256: string } } catch { throw new Error(`Invalid response while reading ${safe}.`) }
}

function normalizeRemote(value: string): string {
  const normalized = `/${value.replaceAll("\\", "/")}`.replace(/\/{2,}/g, "/")
  const parts = normalized.split("/").filter(Boolean)
  if (parts.some((part) => part === "..")) throw new Error("Unsafe remote path.")
  return `/${parts.join("/")}`
}

function cleanError(result: CommandResult, fallback: string): string {
  const text = `${result.stderr}\n${result.stdout}`.trim().replace(/\s+/g, " ")
  return text ? `${fallback} ${text}` : fallback
}

export function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error) }
