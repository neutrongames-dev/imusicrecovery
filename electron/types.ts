export interface DeviceIdentity {
  udid: string
  deviceName: string
  productType: string
  productVersion: string
  serialNumber?: string
}

export interface DiagnosticResult {
  platform: string
  nativeToolsReady: boolean
  appleService: "running" | "stopped" | "missing" | "unknown"
  devices: string[]
  identity?: DeviceIdentity
  paired?: boolean
  message: string
}

export interface AfcEntry {
  name: string
  path: string
  kind: "file" | "directory" | "other"
  size: number
  mtime: number
}

export interface InventoryFile extends AfcEntry {
  sourceRoot: string
  sourceLabel: "iTunes_Control" | "Purchases"
  rawRelative: string
  mediaKind: "audio" | "video" | "other"
}

export interface InventoryResult {
  files: InventoryFile[]
  totalFiles: number
  totalBytes: number
  audioFiles: number
  videoFiles: number
  mediaBytes: number
  sourceRoots: string[]
}

export interface RecoveryOptions {
  outputRoot: string
  mode: "full" | "raw"
}

export interface RecoveryProgress {
  phase: "raw" | "organize" | "complete" | "cancelled"
  current: number
  total: number
  bytesDone: number
  bytesTotal: number
  currentPath?: string
  message: string
}

export interface RecoverySummary {
  outputRoot: string
  rawCopied: number
  rawReused: number
  rawFailed: number
  organized: number
  organizedSkipped: number
  organizedFailed: number
  drmFiles: number
  bytesRecovered: number
  completed: boolean
  cancelled: boolean
  startedAt: string
  finishedAt: string
}
