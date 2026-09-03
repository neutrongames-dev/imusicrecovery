import fs from "node:fs"

const source = fs.readFileSync(new URL("../native/afc_ro.c", import.meta.url), "utf8")
const forbidden = [
  "afc_file_write(",
  "afc_remove_path(",
  "afc_remove_path_and_contents(",
  "afc_rename_path(",
  "afc_make_directory(",
  "afc_make_link(",
  "afc_set_file_time(",
  "AFC_FOPEN_WRONLY",
  "AFC_FOPEN_RW",
  "AFC_FOPEN_WR",
  "AFC_FOPEN_APPEND",
]
const found = forbidden.filter((token) => source.includes(token))
if (found.length) {
  console.error(`Read-only safety check failed: ${found.join(", ")}`)
  process.exit(1)
}
if (!source.includes("AFC_FOPEN_RDONLY")) {
  console.error("Read-only safety check failed: AFC_FOPEN_RDONLY not found")
  process.exit(1)
}
console.log("Native read-only AFC safety check passed.")
