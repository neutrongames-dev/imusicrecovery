import { appendFile, copyFile, mkdir, readFile, rename, rm, stat, writeFile, readdir } from "node:fs/promises"
import path from "node:path"
import { createHash } from "node:crypto"
import { afcList, afcPull } from "./native-device.js"
import { buildMusicPath, buildVideoPath, extension, normalizeRelativePath } from "./names.js"
import { readTrackMetadata } from "./metadata.js"
import type { DeviceIdentity, InventoryFile, InventoryResult, RecoveryOptions, RecoveryProgress, RecoverySummary } from "./types.js"

const AUDIO_EXT = new Set([".mp3", ".m4a", ".m4p", ".m4b", ".m4r", ".aac", ".wav", ".aif", ".aiff", ".alac"])
const VIDEO_EXT = new Set([".m4v", ".mp4", ".mov"])
const RAW_HEADER = ["remote_path", "raw_path", "size", "sha256", "status", "error"]
const ORG_HEADER = ["raw_path", "organized_path", "media_kind", "sha256", "status", "error"]

export class RecoveryController {
  private cancelled = false
  private inventoryCache: InventoryResult | null = null

  cancel(): void { this.cancelled = true }
  resetCancel(): void { this.cancelled = false }
  resetSession(): void { this.cancelled = false; this.inventoryCache = null }

  async inventory(identity: DeviceIdentity, onProgress?: (message: string) => void): Promise<InventoryResult> {
    const files: InventoryFile[] = []
    const roots = [
      { root: "/iTunes_Control/Music", label: "iTunes_Control" as const, rawBase: "RAW/iTunes_Control/Music" },
      { root: "/Purchases", label: "Purchases" as const, rawBase: "RAW/Purchases" },
    ]
    const sourceRoots: string[] = []

    for (const source of roots) {
      this.throwIfCancelled()
      let rootEntries
      try { rootEntries = await afcList(identity.udid, source.root) } catch { continue }
      sourceRoots.push(source.root)
      const queue: Array<{ dir: string; entries?: Awaited<ReturnType<typeof afcList>> }> = [{ dir: source.root, entries: rootEntries }]
      while (queue.length) {
        this.throwIfCancelled()
        const item = queue.shift()!
        onProgress?.(`Scanning ${item.dir}`)
        const entries = item.entries ?? await afcList(identity.udid, item.dir)
        for (const entry of entries) {
          if (entry.kind === "directory") {
            queue.push({ dir: entry.path })
            continue
          }
          if (entry.kind !== "file") continue
          const relative = entry.path.startsWith(source.root) ? entry.path.slice(source.root.length).replace(/^\/+/, "") : entry.name
          const ext = extension(entry.path)
          const mediaKind: InventoryFile["mediaKind"] = AUDIO_EXT.has(ext) ? "audio" : VIDEO_EXT.has(ext) ? "video" : "other"
          files.push({ ...entry, sourceRoot: source.root, sourceLabel: source.label, rawRelative: normalizeRelativePath(`${source.rawBase}/${relative}`), mediaKind })
        }
      }
    }

    const result: InventoryResult = {
      files,
      totalFiles: files.length,
      totalBytes: files.reduce((n, f) => n + f.size, 0),
      audioFiles: files.filter((f) => f.mediaKind === "audio").length,
      videoFiles: files.filter((f) => f.mediaKind === "video").length,
      mediaBytes: files.filter((f) => f.mediaKind !== "other").reduce((n, f) => n + f.size, 0),
      sourceRoots,
    }
    this.inventoryCache = result
    return result
  }

  async recover(
    identity: DeviceIdentity,
    options: RecoveryOptions,
    onProgress: (progress: RecoveryProgress) => void,
    onLog: (line: string) => void,
  ): Promise<RecoverySummary> {
    this.resetCancel()
    const startedAt = new Date().toISOString()
    const summary: RecoverySummary = {
      outputRoot: options.outputRoot, rawCopied: 0, rawReused: 0, rawFailed: 0, organized: 0, organizedSkipped: 0,
      organizedFailed: 0, drmFiles: 0, bytesRecovered: 0, completed: false, cancelled: false, startedAt, finishedAt: "",
    }

    await mkdir(options.outputRoot, { recursive: true })
    await bindOutputRoot(options.outputRoot, identity)
    const inventory = this.inventoryCache ?? await this.inventory(identity, (message) => onLog(message))
    if (!inventory.files.length) throw new Error("No regular files were found under iTunes_Control/Music or Purchases.")

    const reportDir = path.join(options.outputRoot, "Reports")
    await mkdir(reportDir, { recursive: true })
    const rawReport = path.join(reportDir, "raw_manifest.csv")
    const orgReport = path.join(reportDir, "organized_manifest.csv")
    await ensureCsv(rawReport, RAW_HEADER)
    await ensureCsv(orgReport, ORG_HEADER)
    const previous = await loadRawManifest(rawReport)
    const verified = new Map<string, { local: string; sha256: string; file: InventoryFile }>()

    let bytesDone = 0
    for (let i = 0; i < inventory.files.length; i++) {
      if (this.cancelled) { summary.cancelled = true; break }
      const file = inventory.files[i]!
      const local = safeJoin(options.outputRoot, file.rawRelative)
      const partial = `${local}.part`
      onProgress({ phase: "raw", current: i + 1, total: inventory.totalFiles, bytesDone, bytesTotal: inventory.totalBytes, currentPath: file.path, message: `Preserving ${file.path}` })
      try {
        await mkdir(path.dirname(local), { recursive: true })
        const old = previous.get(file.path)
        if (old && old.size === file.size && await fileExists(local)) {
          const localStat = await stat(local)
          if (localStat.size === file.size) {
            const localHash = await sha256File(local)
            if (localHash === old.sha256) {
              summary.rawReused++
              summary.bytesRecovered += file.size
              bytesDone += file.size
              verified.set(file.path, { local, sha256: localHash, file })
              onLog(`Resume verified: ${file.path}`)
              continue
            }
          }
        }

        await rm(partial, { force: true })
        const pulled = await afcPull(identity.udid, file.path, partial)
        const localStat = await stat(partial)
        if (pulled.bytes !== file.size || localStat.size !== file.size) {
          throw new Error(`Size verification failed (device ${file.size}, transfer ${pulled.bytes}, local ${localStat.size}).`)
        }
        const localHash = await sha256File(partial)
        if (localHash !== pulled.sha256.toLowerCase()) throw new Error("SHA-256 verification failed between device read and local RAW file.")
        await rm(local, { force: true })
        await rename(partial, local)
        summary.rawCopied++
        summary.bytesRecovered += file.size
        bytesDone += file.size
        verified.set(file.path, { local, sha256: localHash, file })
        await appendCsv(rawReport, [file.path, file.rawRelative, file.size, localHash, "verified", ""])
        onLog(`RAW verified: ${file.path}`)
      } catch (error) {
        summary.rawFailed++
        await rm(partial, { force: true }).catch(() => undefined)
        const message = errorMessage(error)
        await appendCsv(rawReport, [file.path, file.rawRelative, file.size, "", "failed", message])
        onLog(`RAW failed: ${file.path} — ${message}`)
      }
    }

    if (!summary.cancelled && options.mode === "full") {
      const media = [...verified.values()].filter(({ file }) => file.mediaKind !== "other")
      for (let i = 0; i < media.length; i++) {
        if (this.cancelled) { summary.cancelled = true; break }
        const item = media[i]!
        const ext = extension(item.local)
        if (ext === ".m4p") summary.drmFiles++
        onProgress({ phase: "organize", current: i + 1, total: media.length, bytesDone: i, bytesTotal: media.length, currentPath: item.file.path, message: `Organizing ${path.basename(item.local)}` })
        try {
          const metadata = await readTrackMetadata(item.local, ext)
          const relative = item.file.mediaKind === "video" ? buildVideoPath(item.local, metadata) : buildMusicPath(item.local, metadata)
          const desired = safeJoin(options.outputRoot, relative)
          const destination = await resolveDestination(desired, item.sha256)
          if (destination.reused) {
            summary.organizedSkipped++
            await appendCsv(orgReport, [path.relative(options.outputRoot, item.local), path.relative(options.outputRoot, destination.path), item.file.mediaKind, item.sha256, "reused", ""])
            continue
          }
          await mkdir(path.dirname(destination.path), { recursive: true })
          await copyFile(item.local, destination.path)
          const destHash = await sha256File(destination.path)
          if (destHash !== item.sha256) {
            await rm(destination.path, { force: true })
            throw new Error("Organized copy SHA-256 verification failed.")
          }
          summary.organized++
          await appendCsv(orgReport, [path.relative(options.outputRoot, item.local), path.relative(options.outputRoot, destination.path), item.file.mediaKind, item.sha256, "verified", ""])
        } catch (error) {
          summary.organizedFailed++
          await appendCsv(orgReport, [path.relative(options.outputRoot, item.local), "", item.file.mediaKind, item.sha256, "failed", errorMessage(error)])
          onLog(`Organization failed: ${item.file.path} — ${errorMessage(error)}`)
        }
      }
    }

    summary.finishedAt = new Date().toISOString()
    summary.completed = !summary.cancelled && summary.rawFailed === 0 && summary.organizedFailed === 0
    await writeFile(path.join(reportDir, "summary.json"), JSON.stringify({ identity, inventory: { ...inventory, files: undefined }, summary }, null, 2), "utf8")
    onProgress({ phase: summary.cancelled ? "cancelled" : "complete", current: 1, total: 1, bytesDone: summary.bytesRecovered, bytesTotal: inventory.totalBytes, message: summary.cancelled ? "Recovery cancelled. Verified RAW files already completed were kept." : "Recovery finished." })
    return summary
  }

  private throwIfCancelled(): void { if (this.cancelled) throw new Error("Operation cancelled.") }
}

async function bindOutputRoot(root: string, identity: DeviceIdentity): Promise<void> {
  const bindingPath = path.join(root, "device_identity.json")
  if (await fileExists(bindingPath)) {
    const existing = JSON.parse(await readFile(bindingPath, "utf8")) as DeviceIdentity
    if (existing.udid !== identity.udid) throw new Error("This recovery folder is already bound to a different Apple device. Choose a different folder.")
    return
  }
  const entries = (await readdir(root)).filter((name) => !["desktop.ini", ".DS_Store"].includes(name))
  if (entries.length) throw new Error("Choose an empty recovery folder, or a folder previously created for this same iPod.")
  await writeFile(bindingPath, JSON.stringify({ ...identity, boundAt: new Date().toISOString() }, null, 2), "utf8")
}

async function resolveDestination(desired: string, expectedHash: string): Promise<{ path: string; reused: boolean }> {
  if (!(await fileExists(desired))) return { path: desired, reused: false }
  if ((await sha256File(desired)) === expectedHash) return { path: desired, reused: true }
  const parsed = path.parse(desired)
  for (let i = 2; i < 10000; i++) {
    const candidate = path.join(parsed.dir, `${parsed.name} (${i})${parsed.ext}`)
    if (!(await fileExists(candidate))) return { path: candidate, reused: false }
    if ((await sha256File(candidate)) === expectedHash) return { path: candidate, reused: true }
  }
  throw new Error("Too many destination name collisions.")
}

function safeJoin(root: string, relative: string): string {
  const normalized = normalizeRelativePath(relative)
  const full = path.resolve(root, ...normalized.split("/"))
  const base = `${path.resolve(root)}${path.sep}`.toLowerCase()
  if (!`${full}${path.sep}`.toLowerCase().startsWith(base) && full.toLowerCase() !== path.resolve(root).toLowerCase()) throw new Error("Unsafe destination path.")
  return full
}

async function sha256File(file: string): Promise<string> {
  const handle = await import("node:fs").then(({ createReadStream }) => createReadStream(file))
  const hash = createHash("sha256")
  for await (const chunk of handle) hash.update(chunk as Buffer)
  return hash.digest("hex")
}

async function fileExists(file: string): Promise<boolean> { try { await stat(file); return true } catch { return false } }
async function ensureCsv(file: string, header: string[]): Promise<void> { if (!(await fileExists(file))) await writeFile(file, `${header.map(csv).join(",")}\n`, "utf8") }
async function appendCsv(file: string, values: Array<string | number>): Promise<void> { await appendFile(file, `${values.map(csv).join(",")}\n`, "utf8") }
function csv(value: string | number): string { const text = String(value ?? ""); return `"${text.replaceAll('"', '""')}"` }

async function loadRawManifest(file: string): Promise<Map<string, { size: number; sha256: string }>> {
  const result = new Map<string, { size: number; sha256: string }>()
  if (!(await fileExists(file))) return result
  const lines = (await readFile(file, "utf8")).split(/\r?\n/).slice(1).filter(Boolean)
  for (const line of lines) {
    const cols = parseCsvLine(line)
    if (cols.length >= 6 && cols[4] === "verified" && cols[0] && cols[3]) result.set(cols[0], { size: Number(cols[2]) || 0, sha256: cols[3] })
  }
  return result
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []; let cur = ""; let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (quoted) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ } else if (ch === '"') quoted = false; else cur += ch }
    else if (ch === '"') quoted = true
    else if (ch === ',') { out.push(cur); cur = "" }
    else cur += ch
  }
  out.push(cur); return out
}

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error) }
