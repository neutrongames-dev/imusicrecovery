import "./styles.css"
import { CORPOREAL_STEAM_URL, GUARDIANS_STEAM_URL, NEUTRON_SITE_URL, getPromoState, guardiansLaunchCopy } from "./promo"

const app = document.querySelector<HTMLDivElement>("#app")!

app.innerHTML = `
  <header class="topbar">
    <div class="brand"><span class="brand-mark">♫</span><span class="brand-stack"><span>iMusicRecovery</span><span class="studio-credit">a free recovery tool from Neutron Studios</span></span></div>
    <div class="local-pill"><span class="dot"></span>Windows desktop • local only</div>
  </header>
  <main class="page-shell">
    <section class="hero">
      <div>
        <p class="eyebrow">PRESERVATION-FIRST IPOD RECOVERY</p>
        <h1>Recover music and video from an old iPod without syncing, restoring, or uploading it.</h1>
        <p class="hero-copy">This desktop edition uses Windows' normal Apple device stack instead of browser WebUSB. It creates a RAW preservation copy first, verifies each device read with SHA-256, then reconstructs Music and Video folders from the verified local copy.</p>
      </div>
      <div class="privacy-card">
        <strong>Your recovered media stays on this computer.</strong>
        <span>No account. No cloud storage. No server-side file processing.</span>
      </div>
    </section>

    <section id="systemNotice" class="notice warning">
      <strong>Windows x64 desktop release.</strong> Connect the iPod with its normal Apple USB driver. WinUSB/Zadig is not required.
    </section>

    <section class="support-card" aria-label="Device compatibility">
      <div class="support-copy">
        <p class="eyebrow compact">DEVICE COMPATIBILITY</p>
        <h2>Initial target: iPod touch 1st–7th generation</h2>
        <p>The native AFC path is designed for the iPod touch family and uses Apple Mobile Device Support on Windows. Traditional iPod classic/nano/mini/photo/shuffle models use a different Disk Mode backend and are planned separately.</p>
      </div>
      <div class="support-groups">
        <div class="support-group experimental"><span class="support-icon">!</span><div><strong>Hardware validation still required</strong><span>Start with your 1st-generation iPod touch, then broaden model testing.</span></div></div>
        <div class="support-group supported"><span class="support-icon">✓</span><div><strong>No custom USB driver replacement</strong><span>Uses the normal Windows Apple device service already used by Apple-compatible desktop software.</span></div></div>
      </div>
      <p class="support-note">If Apple Mobile Device Support is missing, install Apple's Windows device software and reconnect the iPod. <button id="appleSupportBtn" class="inline-link">Open Apple support</button></p>
    </section>

    <section class="before-card">
      <div><span class="checkmark">✓</span><p><strong>Keep the iPod connected and powered.</strong><span>Do not sync, restore, erase, or update it during recovery.</span></p></div>
      <div><span class="checkmark">✓</span><p><strong>Choose an empty recovery folder.</strong><span>The folder is bound to this iPod's UDID to prevent cross-device resume mistakes.</span></p></div>
      <div><span class="checkmark">✓</span><p><strong>RAW comes first.</strong><span>Organized Music and Video folders are created only from verified local RAW files.</span></p></div>
    </section>

    <section class="house-promo" aria-label="From Neutron Studios">
      <div id="promoArt" class="house-art guardians-art" role="img" aria-label="Neutron Studios game artwork"></div>
      <div class="house-promo-copy">
        <p class="house-label">FROM NEUTRON STUDIOS</p>
        <h3 id="promoTitle">The Guardians</h3>
        <p><span id="promoLead" class="release">Releases October 15.</span> <span id="promoCopy">Cinematic carrier-based aerial combat from the developer of this free recovery tool.</span></p>
      </div>
      <button id="guardiansBtn" class="house-cta">Wishlist on Steam →</button>
    </section>

    <section class="workflow-grid">
      <article class="panel step-panel">
        <div class="step-heading"><span class="step-number">1</span><div><h2>Connect your iPod</h2><p>Check Windows device support and pair safely</p></div></div>
        <div id="deviceDetails" class="details empty">No device connected.</div>
        <div class="button-row">
          <button id="diagnosticBtn" class="secondary">Check connection</button>
          <button id="connectBtn" class="primary">Connect iPod</button>
          <button id="disconnectBtn" class="ghost" disabled>Disconnect</button>
        </div>
        <p class="microcopy">The connection check does not copy media. Pairing may create/update the normal host pairing record used by Apple device software.</p>
      </article>

      <article class="panel step-panel">
        <div class="step-heading"><span class="step-number">2</span><div><h2>Choose where to save</h2><p>Use an empty folder with enough free space</p></div></div>
        <div id="folderDetails" class="details empty">No folder selected.</div>
        <div class="button-row"><button id="folderBtn" class="secondary">Choose recovery folder</button></div>
        <p class="microcopy">RAW + Organized mode can require roughly twice the recoverable media size.</p>
      </article>

      <article class="panel step-panel">
        <div class="step-heading"><span class="step-number">3</span><div><h2>Preview recovery</h2><p>Inventory Music and Purchases before copying</p></div></div>
        <div id="inventoryDetails" class="details empty">Connect the iPod first.</div>
        <div class="button-row"><button id="inventoryBtn" class="secondary" disabled>Scan iPod</button></div>
      </article>
    </section>

    <section class="panel recovery-panel">
      <div class="step-heading"><span class="step-number">4</span><div><h2>Recover your media</h2><p>Device read → RAW file → SHA-256 verification → optional organization</p></div></div>
      <div class="mode-row">
        <label><input type="radio" name="mode" value="full" checked><span><strong>RAW + Organized Media <em class="recommended-badge">Recommended</em></strong><small>Preserve first, then create Music/Artist/Album and Video folders.</small></span></label>
        <label><input type="radio" name="mode" value="raw"><span><strong>RAW Preservation Only</strong><small>Keep the exact device-side file layout without a second organized library.</small></span></label>
      </div>
      <div class="recovery-consent">
        <label class="terms-check"><input id="termsCheck" type="checkbox"><span>I understand recovery cannot be guaranteed and I will keep the original iPod unchanged until I verify the recovered files.</span></label>
        <p class="consent-copy">The recovery component is built without device write, delete, or rename operations. Hardware failure, pre-existing corruption, cable interruption, or storage errors can still prevent recovery.</p>
      </div>
      <div class="recovery-actions">
        <button id="recoverBtn" class="primary large" disabled>Start recovery</button>
        <button id="cancelBtn" class="danger" disabled>Cancel</button>
      </div>
      <div id="progressArea" class="progress-area" hidden>
        <div class="progress-top"><strong id="progressMessage">Preparing…</strong><span id="progressPercent">0%</span></div>
        <div class="progress-track"><div id="progressFill" class="progress-fill"></div></div>
        <div id="currentPath" class="current-path"></div>
      </div>
      <div id="summaryArea" class="summary-area" hidden></div>
    </section>

    <details class="panel advanced-panel">
      <summary>Advanced details and recovery log</summary>
      <div class="log-tools"><button id="clearLogBtn" class="ghost small">Clear log</button></div>
      <pre id="logPanel" class="log-panel">iMusicRecovery desktop ready.</pre>
    </details>

    <section id="postPromo" class="after-success" hidden>
      <div class="after-success-head"><div><p class="house-label">MORE FROM NEUTRON STUDIOS</p><h2 id="postPromoHeading">The games help support free tools like iMusicRecovery.</h2></div><button id="studioBtn" class="ghost small">Neutron Studios ↗</button></div>
      <div class="game-grid">
        <article class="game-card"><div class="game-visual corporeal" role="img" aria-label="CORPOREAL artwork"></div><div class="game-body"><strong>CORPOREAL</strong><span>Available now on Steam.</span><button id="corporealBtn" class="game-link">View on Steam →</button></div></article>
        <article class="game-card"><div class="game-visual guardians-art" role="img" aria-label="The Guardians artwork"></div><div class="game-body"><strong>The Guardians</strong><span id="guardiansAfterStatus">Releases October 15.</span><button id="guardiansAfterBtn" class="game-link">Wishlist on Steam →</button></div></article>
      </div>
    </section>
  </main>
`

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const deviceDetails = $("deviceDetails")
const folderDetails = $("folderDetails")
const inventoryDetails = $("inventoryDetails")
const diagnosticBtn = $("diagnosticBtn") as HTMLButtonElement
const connectBtn = $("connectBtn") as HTMLButtonElement
const disconnectBtn = $("disconnectBtn") as HTMLButtonElement
const folderBtn = $("folderBtn") as HTMLButtonElement
const inventoryBtn = $("inventoryBtn") as HTMLButtonElement
const recoverBtn = $("recoverBtn") as HTMLButtonElement
const cancelBtn = $("cancelBtn") as HTMLButtonElement
const termsCheck = $("termsCheck") as HTMLInputElement
const progressArea = $("progressArea")
const progressMessage = $("progressMessage")
const progressPercent = $("progressPercent")
const progressFill = $("progressFill")
const currentPath = $("currentPath")
const summaryArea = $("summaryArea")
const logPanel = $("logPanel")
const postPromo = $("postPromo")

let connected = false
let folder: string | null = null
let inventory: Awaited<ReturnType<typeof window.iMusicRecovery.inventory>> | null = null
let recovering = false

function log(line: string): void {
  const stamp = new Date().toLocaleTimeString()
  logPanel.textContent += `\n[${stamp}] ${line}`
  logPanel.scrollTop = logPanel.scrollHeight
}

function updateReady(): void {
  inventoryBtn.disabled = !connected || recovering
  folderBtn.disabled = recovering
  diagnosticBtn.disabled = recovering
  connectBtn.disabled = connected || recovering
  disconnectBtn.disabled = !connected || recovering
  recoverBtn.disabled = recovering || !connected || !folder || !inventory || !termsCheck.checked
}

function showDetails(target: HTMLElement, html: string, status: "good" | "warning" | "error" | "neutral" = "neutral"): void {
  target.className = `details ${status === "neutral" ? "" : status}`.trim()
  target.innerHTML = html
}

function escapeHtml(text: unknown): string {
  return String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]!)
}

function humanBytes(bytes: number): string {
  let value = bytes
  for (const unit of ["B", "KB", "MB", "GB", "TB"]) {
    if (value < 1024 || unit === "TB") return unit === "B" ? `${Math.round(value)} ${unit}` : `${value.toFixed(1)} ${unit}`
    value /= 1024
  }
  return `${value.toFixed(1)} TB`
}

async function runDiagnostic(): Promise<void> {
  diagnosticBtn.disabled = true
  showDetails(deviceDetails, "Checking Windows Apple device support…")
  try {
    const result = await window.iMusicRecovery.diagnose()
    const service = result.appleService === "running" ? "Apple Mobile Device Service running" : `Apple service: ${result.appleService}`
    const identity = result.identity ? `<br><strong>${escapeHtml(result.identity.deviceName)}</strong> · ${escapeHtml(result.identity.productType)} · iOS ${escapeHtml(result.identity.productVersion)}` : ""
    showDetails(deviceDetails, `<strong>${escapeHtml(result.message)}</strong><br>${escapeHtml(service)}${identity}`, result.devices.length ? (result.paired ? "good" : "warning") : "warning")
    log(`Diagnostic: ${result.message}`)
  } catch (error) {
    showDetails(deviceDetails, `<strong>Diagnostic failed.</strong><br>${escapeHtml(errorMessage(error))}`, "error")
    log(`Diagnostic failed: ${errorMessage(error)}`)
  } finally { updateReady() }
}

async function connectDevice(): Promise<void> {
  connectBtn.disabled = true
  showDetails(deviceDetails, "Connecting through the Windows Apple device service…")
  try {
    const identity = await window.iMusicRecovery.connect()
    connected = true
    inventory = null
    showDetails(deviceDetails, `<strong>${escapeHtml(identity.deviceName)}</strong><br>${escapeHtml(identity.productType)} · iOS ${escapeHtml(identity.productVersion)}<br><span class="technical-id">UDID ${escapeHtml(identity.udid)}</span>`, "good")
    inventoryDetails.className = "details empty"
    inventoryDetails.textContent = "Ready to scan the iPod."
    log(`Connected: ${identity.deviceName} (${identity.productType}, iOS ${identity.productVersion})`)
  } catch (error) {
    showDetails(deviceDetails, `<strong>Connection failed.</strong><br>${escapeHtml(errorMessage(error))}`, "error")
    log(`Connection failed: ${errorMessage(error)}`)
  } finally { updateReady() }
}

async function disconnectDevice(): Promise<void> {
  await window.iMusicRecovery.disconnect()
  connected = false; inventory = null
  deviceDetails.className = "details empty"; deviceDetails.textContent = "No device connected."
  inventoryDetails.className = "details empty"; inventoryDetails.textContent = "Connect the iPod first."
  log("Disconnected.")
  updateReady()
}

async function chooseFolder(): Promise<void> {
  const selected = await window.iMusicRecovery.chooseFolder()
  if (!selected) return
  folder = selected
  showDetails(folderDetails, `<strong>Recovery folder selected</strong><br><span class="mono">${escapeHtml(selected)}</span>`, "good")
  log(`Recovery folder: ${selected}`)
  updateReady()
}

async function scanInventory(): Promise<void> {
  inventoryBtn.disabled = true
  showDetails(inventoryDetails, "Scanning iTunes_Control/Music and Purchases…")
  try {
    inventory = await window.iMusicRecovery.inventory()
    const estimatedFull = inventory.totalBytes + inventory.mediaBytes
    showDetails(inventoryDetails, `
      <div class="inventory-stats">
        <span><strong>${inventory.audioFiles.toLocaleString()}</strong><small>audio files</small></span>
        <span><strong>${inventory.videoFiles.toLocaleString()}</strong><small>video files</small></span>
        <span><strong>${humanBytes(inventory.totalBytes)}</strong><small>RAW source</small></span>
        <span><strong>${humanBytes(estimatedFull)}</strong><small>approx. RAW + organized</small></span>
      </div>
      <p class="microcopy">Sources found: ${escapeHtml(inventory.sourceRoots.join(", ") || "none")}</p>
    `, inventory.totalFiles ? "good" : "warning")
    log(`Inventory: ${inventory.totalFiles} files, ${inventory.audioFiles} audio, ${inventory.videoFiles} video, ${humanBytes(inventory.totalBytes)} RAW.`)
  } catch (error) {
    inventory = null
    showDetails(inventoryDetails, `<strong>Scan failed.</strong><br>${escapeHtml(errorMessage(error))}`, "error")
    log(`Scan failed: ${errorMessage(error)}`)
  } finally { updateReady() }
}

async function startRecovery(): Promise<void> {
  if (!folder || !inventory) return
  recovering = true
  postPromo.hidden = true
  summaryArea.hidden = true
  progressArea.hidden = false
  cancelBtn.disabled = false
  updateReady()
  const mode = (document.querySelector<HTMLInputElement>('input[name="mode"]:checked')?.value ?? "full") as "full" | "raw"
  log(`Starting ${mode === "full" ? "RAW + Organized" : "RAW-only"} recovery.`)
  try {
    const summary = await window.iMusicRecovery.recover({ outputRoot: folder, mode })
    const status = summary.cancelled ? "Recovery cancelled" : summary.completed ? "Recovery completed" : "Recovery completed with file errors"
    summaryArea.hidden = false
    summaryArea.className = `summary-area ${summary.completed ? "success" : summary.cancelled ? "warning" : "error"}`
    summaryArea.innerHTML = `
      <h3>${escapeHtml(status)}</h3>
      <div class="summary-grid">
        <span><strong>${summary.rawCopied}</strong><small>RAW copied</small></span>
        <span><strong>${summary.rawReused}</strong><small>RAW resumed</small></span>
        <span><strong>${summary.rawFailed}</strong><small>RAW failed</small></span>
        <span><strong>${summary.organized}</strong><small>organized</small></span>
        <span><strong>${summary.organizedFailed}</strong><small>organize failed</small></span>
        <span><strong>${summary.drmFiles}</strong><small>DRM-tagged .m4p</small></span>
        <span><strong>${humanBytes(summary.bytesRecovered)}</strong><small>verified RAW</small></span>
      </div>
      <p>Keep the original iPod unchanged until you have checked the recovered library.</p>
      <button id="revealBtn" class="secondary">Open recovery folder</button>
    `
    document.getElementById("revealBtn")?.addEventListener("click", () => void window.iMusicRecovery.revealFolder(summary.outputRoot))
    if (summary.completed) postPromo.hidden = false
    log(status)
  } catch (error) {
    summaryArea.hidden = false
    summaryArea.className = "summary-area error"
    summaryArea.innerHTML = `<h3>Recovery stopped</h3><p>${escapeHtml(errorMessage(error))}</p><p>Any RAW files already verified remain in the recovery folder.</p>`
    log(`Recovery failed: ${errorMessage(error)}`)
  } finally {
    recovering = false; cancelBtn.disabled = true; updateReady()
  }
}

window.iMusicRecovery.onProgress((progress) => {
  progressArea.hidden = false
  progressMessage.textContent = progress.message
  currentPath.textContent = progress.currentPath ?? ""
  const denom = Math.max(1, progress.bytesTotal || progress.total)
  const num = progress.bytesTotal ? progress.bytesDone : progress.current
  const pct = Math.max(0, Math.min(100, Math.round((num / denom) * 100)))
  progressPercent.textContent = `${pct}%`
  progressFill.style.width = `${pct}%`
})
window.iMusicRecovery.onLog(log)

diagnosticBtn.addEventListener("click", () => void runDiagnostic())
connectBtn.addEventListener("click", () => void connectDevice())
disconnectBtn.addEventListener("click", () => void disconnectDevice())
folderBtn.addEventListener("click", () => void chooseFolder())
inventoryBtn.addEventListener("click", () => void scanInventory())
recoverBtn.addEventListener("click", () => void startRecovery())
cancelBtn.addEventListener("click", () => { cancelBtn.disabled = true; void window.iMusicRecovery.cancelRecovery(); log("Cancellation requested. The current device read will finish before the recovery loop stops.") })
termsCheck.addEventListener("change", updateReady)
$("clearLogBtn").addEventListener("click", () => { logPanel.textContent = "Log cleared." })
$("appleSupportBtn").addEventListener("click", () => void window.iMusicRecovery.openExternal("https://support.apple.com/guide/devices-windows/welcome/windows"))
const promoState = getPromoState()
const promoButton = $("guardiansBtn") as HTMLButtonElement
$("promoTitle").textContent = promoState.title
$("promoLead").textContent = promoState.lead
$("promoCopy").textContent = promoState.copy
$("promoArt").className = `house-art ${promoState.artClass}`
promoButton.textContent = promoState.cta
promoButton.dataset.url = promoState.url
const guardiansState = guardiansLaunchCopy()
$("guardiansAfterStatus").textContent = guardiansState.text
$("guardiansAfterBtn").textContent = guardiansState.cta
if (promoState.phase === "support") $("postPromoHeading").textContent = "If this free tool helped, support the developer by checking out our games on Steam."

promoButton.addEventListener("click", () => void window.iMusicRecovery.openExternal(promoButton.dataset.url || GUARDIANS_STEAM_URL))
$("guardiansAfterBtn").addEventListener("click", () => void window.iMusicRecovery.openExternal(GUARDIANS_STEAM_URL))
$("corporealBtn").addEventListener("click", () => void window.iMusicRecovery.openExternal(CORPOREAL_STEAM_URL))
$("studioBtn").addEventListener("click", () => void window.iMusicRecovery.openExternal(NEUTRON_SITE_URL))

updateReady()
void runDiagnostic()

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error) }
