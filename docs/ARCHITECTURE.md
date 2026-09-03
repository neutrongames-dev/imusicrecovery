# Desktop architecture

```text
Electron renderer (HTML/CSS/TypeScript)
        |
        | isolated preload IPC
        v
Electron main process
        |
        +-- device identity/pairing --> idevice_id / ideviceinfo / idevicepair
        |
        +-- read-only AFC -----------> afc-ro.exe
                                         |
                                         v
                               libimobiledevice/libusbmuxd
                                         |
                                         v
                              Apple Mobile Device Support
                                         |
                                         v
                                      iPod touch
```

The renderer cannot invoke arbitrary native commands. The preload bridge exposes only diagnostic, connection, folder selection, inventory, recovery, cancellation, and safe shell-link operations.

The recovery engine runs in the Electron main process and never organizes directly from the iPod. It first verifies RAW preservation, then creates user-friendly copies from verified RAW data.
