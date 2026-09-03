import { readFile, access, mkdtemp, writeFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import assert from "node:assert/strict"
import { safeComponent, normalizeRelativePath, buildMusicPath, buildVideoPath } from "../dist-electron/names.js"
import { readTrackMetadata } from "../dist-electron/metadata.js"

const required = [
  "electron/main.ts",
  "electron/preload.cts",
  "electron/native-device.ts",
  "electron/recovery.ts",
  "native/afc_ro.c",
  "src/desktop-main.ts",
]
for (const file of required) await access(path.resolve(file))

const native = await readFile("native/afc_ro.c", "utf8")
const forbiddenNative = [
  "AFC_FOPEN_WRONLY",
  "AFC_FOPEN_RW",
  "AFC_FOPEN_WR",
  "AFC_FOPEN_APPEND",
  "afc_file_write(",
  "afc_remove_path(",
  "afc_rename_path(",
  "afc_make_directory(",
  "afc_truncate(",
]
for (const token of forbiddenNative) {
  if (native.includes(token)) throw new Error(`Native safety test failed: ${token}`)
}
assert.ok(native.includes("AFC_FOPEN_RDONLY"), "Native helper is missing AFC_FOPEN_RDONLY")

const recovery = await readFile("electron/recovery.ts", "utf8")
for (const requiredText of ["RAW/iTunes_Control/Music", "RAW/Purchases", "sha256File", "device_identity.json", "raw_manifest.csv", "organized_manifest.csv"]) {
  assert.ok(recovery.includes(requiredText), `Recovery invariant missing: ${requiredText}`)
}

const preload = await readFile("electron/preload.cts", "utf8")
assert.ok(preload.includes('contextBridge.exposeInMainWorld("iMusicRecovery"'), "Preload bridge missing")

assert.equal(safeComponent('Bad<Name>:"Track"?.mp3'), "Bad-Name---Track--.mp3")
assert.equal(safeComponent("CON"), "_CON")
assert.equal(normalizeRelativePath("RAW/F00/song.mp3"), "RAW/F00/song.mp3")
assert.throws(() => normalizeRelativePath("RAW/../escape.mp3"), /Unsafe relative path/)
assert.equal(
  buildMusicPath("ABCD.mp3", { artist: "Artist", album: "Album", title: "Song", track: 3, disc: null }),
  "Music/Artist/Album/03 - Song.mp3",
)
assert.equal(
  buildVideoPath("ABCD.m4v", { title: "Episode", artist: null, show: "Show", season: 2, episode: 5 }),
  "Video/Show/Season 02/S02E05 - Episode.m4v",
)
assert.equal(
  buildVideoPath("MOVI.m4v", { title: "Movie", artist: null, show: null, season: null, episode: null }),
  "Video/Movies/Movie.m4v",
)

const tmp = await mkdtemp(path.join(os.tmpdir(), "imusicrecovery-test-"))
try {
  const mp3 = path.join(tmp, "F001.mp3")
  const data = Buffer.alloc(256)
  const tag = data.subarray(128)
  tag.write("TAG", 0, "ascii")
  tag.write("Recovered Song", 3, "latin1")
  tag.write("Recovered Artist", 33, "latin1")
  tag.write("Recovered Album", 63, "latin1")
  tag[125] = 0
  tag[126] = 7
  await writeFile(mp3, data)
  const meta = await readTrackMetadata(mp3, ".mp3")
  assert.equal(meta.title, "Recovered Song")
  assert.equal(meta.artist, "Recovered Artist")
  assert.equal(meta.album, "Recovered Album")
  assert.equal(meta.track, 7)
} finally {
  await rm(tmp, { recursive: true, force: true })
}

console.log("Desktop recovery invariants: PASS")
console.log("Native AFC read-only surface: PASS")
console.log("Electron isolated preload bridge: PASS")
console.log("Windows path and library naming tests: PASS")
console.log("ID3 metadata reconstruction test: PASS")
