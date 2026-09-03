import { open, stat } from "node:fs/promises"

export interface TrackMetadata {
  artist: string | null
  album: string | null
  title: string | null
  track: number | null
  disc: number | null
  show: string | null
  season: number | null
  episode: number | null
}

const EMPTY: TrackMetadata = { artist: null, album: null, title: null, track: null, disc: null, show: null, season: null, episode: null }

interface NodeFileSource { path: string; size: number }
interface BoxHeader { type: string; start: number; dataStart: number; end: number }

export async function readTrackMetadata(path: string, extension: string): Promise<TrackMetadata> {
  const file: NodeFileSource = { path, size: (await stat(path)).size }
  const ext = extension.toLowerCase()
  try {
    if (ext === ".mp3") return await readId3(file)
    if ([".m4a", ".m4p", ".m4b", ".m4r", ".mp4", ".m4v", ".alac"].includes(ext)) return await readMp4Metadata(file)
  } catch {
    // Metadata failure never blocks preservation/recovery.
  }
  return { ...EMPTY }
}

async function readRange(file: NodeFileSource, start: number, end: number): Promise<Uint8Array> {
  const safeStart = Math.max(0, Math.min(file.size, start))
  const safeEnd = Math.max(safeStart, Math.min(file.size, end))
  const length = safeEnd - safeStart
  if (length <= 0) return new Uint8Array()
  const handle = await open(file.path, "r")
  try {
    const buffer = Buffer.alloc(length)
    const { bytesRead } = await handle.read(buffer, 0, length, safeStart)
    return new Uint8Array(buffer.buffer, buffer.byteOffset, bytesRead)
  } finally {
    await handle.close()
  }
}

async function readId3(file: NodeFileSource): Promise<TrackMetadata> {
  const fallback = await readId3v1(file)
  const header = await readRange(file, 0, 10)
  if (header.length < 10 || ascii(header, 0, 3) !== "ID3") return fallback
  const version = header[3]!
  const tagSize = syncSafe(header.subarray(6, 10))
  const readSize = Math.min(file.size, 10 + tagSize, 8 * 1024 * 1024)
  const bytes = await readRange(file, 0, readSize)
  const result: TrackMetadata = { ...EMPTY }

  if (version === 2) {
    let offset = 10
    while (offset + 6 <= bytes.length) {
      const id = ascii(bytes, offset, 3)
      if (!id.trim() || /^\x00+$/.test(id)) break
      const size = (bytes[offset + 3]! << 16) | (bytes[offset + 4]! << 8) | bytes[offset + 5]!
      const start = offset + 6
      const end = Math.min(bytes.length, start + size)
      if (size <= 0 || start >= end) break
      assignId3(result, id, bytes.subarray(start, end))
      offset = start + size
    }
    return mergeMetadata(result, fallback)
  }

  if (version !== 3 && version !== 4) return fallback
  let offset = 10
  while (offset + 10 <= bytes.length) {
    const id = ascii(bytes, offset, 4)
    if (!/^[A-Z0-9\u00a9]{4}$/.test(id)) break
    const sizeBytes = bytes.subarray(offset + 4, offset + 8)
    const size = version === 4 ? syncSafe(sizeBytes) : new DataView(sizeBytes.buffer, sizeBytes.byteOffset, 4).getUint32(0, false)
    const start = offset + 10
    const end = Math.min(bytes.length, start + size)
    if (size <= 0 || start >= end) break
    assignId3(result, id, bytes.subarray(start, end))
    offset = start + size
  }
  return mergeMetadata(result, fallback)
}

async function readId3v1(file: NodeFileSource): Promise<TrackMetadata> {
  if (file.size < 128) return { ...EMPTY }
  const bytes = await readRange(file, file.size - 128, file.size)
  if (ascii(bytes, 0, 3) !== "TAG") return { ...EMPTY }
  const decode = (start: number, length: number): string | null => {
    const text = new TextDecoder("windows-1252").decode(bytes.subarray(start, start + length)).replace(/\0/g, "").trim()
    return text || null
  }
  const track = bytes[125] === 0 && bytes[126]! > 0 ? bytes[126]! : null
  return { title: decode(3, 30), artist: decode(33, 30), album: decode(63, 30), track, disc: null, show: null, season: null, episode: null }
}

function mergeMetadata(primary: TrackMetadata, fallback: TrackMetadata): TrackMetadata {
  return {
    artist: primary.artist ?? fallback.artist,
    album: primary.album ?? fallback.album,
    title: primary.title ?? fallback.title,
    track: primary.track ?? fallback.track,
    disc: primary.disc ?? fallback.disc,
    show: primary.show ?? fallback.show,
    season: primary.season ?? fallback.season,
    episode: primary.episode ?? fallback.episode,
  }
}

function assignId3(result: TrackMetadata, id: string, payload: Uint8Array): void {
  const map: Record<string, "artist" | "album" | "title"> = {
    TPE1: "artist", TPE2: "artist", TP1: "artist", TALB: "album", TAL: "album", TIT2: "title", TT2: "title",
  }
  const textKey = map[id]
  if (textKey && !result[textKey]) result[textKey] = decodeId3Text(payload)
  if ((id === "TRCK" || id === "TRK") && !result.track) result.track = parseLeadingInt(decodeId3Text(payload))
  if ((id === "TPOS" || id === "TPA") && !result.disc) result.disc = parseLeadingInt(decodeId3Text(payload))
}

function decodeId3Text(payload: Uint8Array): string | null {
  if (payload.length < 2) return null
  const encoding = payload[0]!
  const body = payload.subarray(1)
  let text = ""
  try {
    if (encoding === 0) text = new TextDecoder("windows-1252").decode(body)
    else if (encoding === 3) text = new TextDecoder("utf-8").decode(body)
    else if (encoding === 1) text = decodeUtf16(body)
    else if (encoding === 2) text = decodeUtf16Be(body)
  } catch {
    text = new TextDecoder("utf-8", { fatal: false }).decode(body)
  }
  return text.replace(/\0/g, "").trim() || null
}

function decodeUtf16(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2))
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return decodeUtf16Be(bytes.subarray(2))
  return new TextDecoder("utf-16le").decode(bytes)
}

function decodeUtf16Be(bytes: Uint8Array): string {
  const swapped = new Uint8Array(bytes.length - (bytes.length % 2))
  for (let i = 0; i + 1 < swapped.length; i += 2) { swapped[i] = bytes[i + 1]!; swapped[i + 1] = bytes[i]! }
  return new TextDecoder("utf-16le").decode(swapped)
}

async function readMp4Metadata(file: NodeFileSource): Promise<TrackMetadata> {
  const result: TrackMetadata = { ...EMPTY }
  const moov = await findBox(file, 0, file.size, new Set(["moov"]))
  if (!moov) return result
  const ilst = await findDescendant(file, moov.dataStart, moov.end, ["udta", "meta", "ilst"])
    ?? await findDescendant(file, moov.dataStart, moov.end, ["meta", "ilst"])
  if (!ilst) return result
  let offset = ilst.dataStart
  while (offset + 8 <= ilst.end) {
    const item = await readBoxHeader(file, offset, ilst.end)
    if (!item) break
    const data = await findBox(file, item.dataStart, item.end, new Set(["data"]))
    if (data) {
      if (["©ART", "aART"].includes(item.type) && !result.artist) result.artist = await readMp4DataText(file, data)
      else if (item.type === "©alb" && !result.album) result.album = await readMp4DataText(file, data)
      else if (item.type === "©nam" && !result.title) result.title = await readMp4DataText(file, data)
      else if (item.type === "trkn" && !result.track) result.track = await readMp4DataNumber(file, data)
      else if (item.type === "disk" && !result.disc) result.disc = await readMp4DataNumber(file, data)
      else if (item.type === "tvsh" && !result.show) result.show = await readMp4DataText(file, data)
      else if (item.type === "tvsn" && !result.season) result.season = await readMp4DataInteger(file, data)
      else if (item.type === "tves" && !result.episode) result.episode = await readMp4DataInteger(file, data)
    }
    offset = item.end
  }
  return result
}

async function findDescendant(file: NodeFileSource, start: number, end: number, path: string[]): Promise<BoxHeader | null> {
  if (!path.length) return null
  const target = await findBox(file, start, end, new Set([path[0]!]))
  if (!target) return null
  if (path.length === 1) return target
  const childStart = target.type === "meta" ? Math.min(target.end, target.dataStart + 4) : target.dataStart
  return findDescendant(file, childStart, target.end, path.slice(1))
}

async function findBox(file: NodeFileSource, start: number, end: number, wanted: Set<string>): Promise<BoxHeader | null> {
  let offset = start
  while (offset + 8 <= end) {
    const box = await readBoxHeader(file, offset, end)
    if (!box) return null
    if (wanted.has(box.type)) return box
    if (box.end <= offset) return null
    offset = box.end
  }
  return null
}

async function readBoxHeader(file: NodeFileSource, offset: number, limit: number): Promise<BoxHeader | null> {
  if (offset < 0 || offset + 8 > limit || offset + 8 > file.size) return null
  const first = await readRange(file, offset, Math.min(file.size, offset + 16))
  if (first.length < 8) return null
  const view = new DataView(first.buffer, first.byteOffset, first.byteLength)
  let size = view.getUint32(0, false)
  const type = fourcc(first.subarray(4, 8))
  let header = 8
  if (size === 1) {
    if (first.length < 16) return null
    const big = view.getBigUint64(8, false)
    if (big > BigInt(Number.MAX_SAFE_INTEGER)) return null
    size = Number(big); header = 16
  } else if (size === 0) size = limit - offset
  if (size < header) return null
  const boxEnd = Math.min(limit, offset + size)
  if (boxEnd <= offset + header) return null
  return { type, start: offset, dataStart: offset + header, end: boxEnd }
}

async function readMp4DataText(file: NodeFileSource, box: BoxHeader): Promise<string | null> {
  const valueStart = Math.min(box.end, box.dataStart + 8)
  if (valueStart >= box.end) return null
  const bytes = await readRange(file, valueStart, Math.min(box.end, valueStart + 512 * 1024))
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/\0/g, "").trim() || null
}

async function readMp4DataInteger(file: NodeFileSource, box: BoxHeader): Promise<number | null> {
  const valueStart = Math.min(box.end, box.dataStart + 8)
  const bytes = await readRange(file, valueStart, Math.min(box.end, valueStart + 16))
  if (!bytes.length) return null
  const tail = bytes.subarray(Math.max(0, bytes.length - 4))
  let value = 0
  for (const byte of tail) value = (value << 8) | byte
  return value > 0 ? value >>> 0 : null
}

async function readMp4DataNumber(file: NodeFileSource, box: BoxHeader): Promise<number | null> {
  const valueStart = Math.min(box.end, box.dataStart + 8)
  const bytes = await readRange(file, valueStart, Math.min(box.end, valueStart + 16))
  if (bytes.length < 4) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const candidates = [view.getUint16(2, false), view.getUint16(0, false)]
  return candidates.find((n) => n > 0) ?? null
}

function syncSafe(bytes: Uint8Array): number { let value = 0; for (const byte of bytes) value = (value << 7) | (byte & 0x7f); return value >>> 0 }
function parseLeadingInt(value: string | null): number | null { const match = value?.match(/^\s*(\d+)/); const n = match ? Number(match[1]) : 0; return Number.isInteger(n) && n > 0 ? n : null }
function ascii(bytes: Uint8Array, start: number, length: number): string { return String.fromCharCode(...bytes.subarray(start, start + length)) }
function fourcc(bytes: Uint8Array): string { return new TextDecoder("latin1").decode(bytes) }
