export {}

type DeviceIdentity = { udid: string; deviceName: string; productType: string; productVersion: string; serialNumber?: string }
type DiagnosticResult = { platform: string; nativeToolsReady: boolean; appleService: "running" | "stopped" | "missing" | "unknown"; devices: string[]; identity?: DeviceIdentity; paired?: boolean; message: string }
type InventoryResult = { totalFiles: number; totalBytes: number; audioFiles: number; videoFiles: number; mediaBytes: number; sourceRoots: string[] }
type RecoveryProgress = { phase: "raw" | "organize" | "complete" | "cancelled"; current: number; total: number; bytesDone: number; bytesTotal: number; currentPath?: string; message: string }
type RecoverySummary = { outputRoot: string; rawCopied: number; rawReused: number; rawFailed: number; organized: number; organizedSkipped: number; organizedFailed: number; drmFiles: number; bytesRecovered: number; completed: boolean; cancelled: boolean; startedAt: string; finishedAt: string }

declare global {
  interface Window {
    iMusicRecovery: {
      diagnose(): Promise<DiagnosticResult>
      connect(): Promise<DeviceIdentity>
      disconnect(): Promise<void>
      chooseFolder(): Promise<string | null>
      inventory(): Promise<InventoryResult>
      recover(options: { outputRoot: string; mode: "full" | "raw" }): Promise<RecoverySummary>
      cancelRecovery(): Promise<void>
      openExternal(url: string): Promise<void>
      revealFolder(folder: string): Promise<void>
      onProgress(callback: (progress: RecoveryProgress) => void): () => void
      onLog(callback: (line: string) => void): () => void
    }
  }
}
