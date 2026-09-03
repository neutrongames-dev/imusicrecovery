# Native read-only AFC helper

`afc_ro.c` is intentionally narrow. It exposes only:

- directory listing + file metadata (`list`)
- read-only file extraction (`pull`)

It does not compile any AFC write, delete, rename, mkdir, restore, erase, firmware, or sync command into the application helper. `pull` opens the remote file with `AFC_FOPEN_RDONLY`, writes the local destination in binary mode, and computes SHA-256 over the bytes read from the device. The Electron layer hashes the completed local file again and requires both hashes to match before accepting a RAW file.

The Windows CI workflow builds this helper against the MSYS2 `mingw-w64-x86_64-libimobiledevice` package and stages only its runtime DLL dependencies plus `idevice_id`, `ideviceinfo`, and `idevicepair`.
