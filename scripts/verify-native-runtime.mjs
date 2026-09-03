import { access, readdir } from "node:fs/promises"
import path from "node:path"

const root = path.resolve("vendor/native")
const required = ["afc-ro.exe", "idevice_id.exe", "ideviceinfo.exe", "idevicepair.exe", "openssl-legacy.cnf"]
for (const name of required) {
  await access(path.join(root, name)).catch(() => {
    throw new Error(`Missing native runtime file: vendor/native/${name}`)
  })
}
const entries = await readdir(root)
const dlls = entries.filter((n) => n.toLowerCase().endsWith(".dll"))
if (!dlls.length) throw new Error("No native runtime DLLs were staged.")
console.log(`Native runtime verified: ${required.length} executables, ${dlls.length} DLLs.`)
