const RESERVED = new Set([
  "CON", "PRN", "AUX", "NUL",
  ...Array.from({ length: 9 }, (_, i) => `COM${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `LPT${i + 1}`),
])

export function safeComponent(value: unknown, fallback = "Unknown", maxLength = 80): string {
  let text = value == null ? "" : String(value).trim()
  text = text.replace(/[<>:"/\\|?*]/g, "-")
  text = text.replace(/[\x00-\x1f\x7f]/g, "")
  text = text.replace(/\s+/g, " ").replace(/^[ .]+|[ .]+$/g, "")
  if (RESERVED.has(text.toUpperCase())) text = `_${text}`
  if (text.length > maxLength) text = text.slice(0, maxLength).replace(/[ .]+$/g, "")
  return text || fallback
}

export function basename(path: string): string {
  const normalized = path.replaceAll("\\", "/").replace(/\/+$/, "")
  return normalized.slice(normalized.lastIndexOf("/") + 1)
}

export function extension(path: string): string {
  const name = basename(path)
  const dot = name.lastIndexOf(".")
  return dot > 0 ? name.slice(dot).toLowerCase() : ""
}

export function stem(path: string): string {
  const name = basename(path)
  const dot = name.lastIndexOf(".")
  return dot > 0 ? name.slice(0, dot) : name
}

export function buildMusicPath(
  sourcePath: string,
  metadata: { artist?: string | null; album?: string | null; title?: string | null; track?: number | null; disc?: number | null },
): string {
  const artist = safeComponent(metadata.artist, "Unknown Artist")
  const album = safeComponent(metadata.album, "Unknown Album")
  const title = safeComponent(metadata.title, safeComponent(stem(sourcePath), "track"), 100)
  const ext = extension(sourcePath)
  let prefix = metadata.disc ? `${metadata.disc}-` : ""
  if (metadata.track) prefix += `${String(metadata.track).padStart(2, "0")} - `
  return `Music/${artist}/${album}/${prefix}${title}${ext}`
}

export function normalizeRelativePath(path: string): string {
  const parts = path.replaceAll("\\", "/").split("/").filter((part) => part && part !== ".")
  if (parts.some((part) => part === "..")) throw new Error(`Unsafe relative path: ${path}`)
  return parts.join("/")
}

export function buildVideoPath(
  sourcePath: string,
  metadata: { artist?: string | null; title?: string | null; show?: string | null; season?: number | null; episode?: number | null },
): string {
  const title = safeComponent(metadata.title, safeComponent(stem(sourcePath), "video"), 100)
  const ext = extension(sourcePath)
  if (metadata.show) {
    const show = safeComponent(metadata.show, "Unknown Show")
    const seasonDir = metadata.season != null ? `Season ${String(metadata.season).padStart(2, "0")}` : "Unsorted"
    let prefix = ""
    if (metadata.season != null && metadata.episode != null) prefix = `S${String(metadata.season).padStart(2, "0")}E${String(metadata.episode).padStart(2, "0")} - `
    else if (metadata.episode != null) prefix = `E${String(metadata.episode).padStart(2, "0")} - `
    return `Video/${show}/${seasonDir}/${prefix}${title}${ext}`
  }
  const folder = metadata.artist ? safeComponent(metadata.artist, "Movies") : "Movies"
  return `Video/${folder}/${title}${ext}`
}

export function isSafeOrganizedPath(path: string): boolean {
  try {
    const normalized = normalizeRelativePath(path)
    return normalized === "Music" || normalized.startsWith("Music/") || normalized === "Video" || normalized.startsWith("Video/")
  } catch {
    return false
  }
}

// Retained for source compatibility with older tests/imports.
export const isSafeMusicPath = isSafeOrganizedPath
