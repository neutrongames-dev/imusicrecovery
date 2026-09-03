# Security and recovery-safety model

## Native device boundary

The native helper `native/afc_ro.c` intentionally exposes only:

- list a directory
- inspect returned AFC metadata
- open a device file with `AFC_FOPEN_RDONLY`
- stream bytes from that file to a local binary destination
- compute SHA-256 over the bytes received

It does not expose or link application logic for AFC file writes, path removal, path rename, directory creation, restore, erase, firmware update, or sync operations.

`scripts/check-native-safety.mjs` and `tests/run-tests.mjs` fail builds if forbidden AFC write primitives appear in the helper source.

## Electron boundary

- `contextIsolation: true`
- `nodeIntegration: false`
- renderer sandbox enabled
- renderer receives only a narrow preload API
- external HTTPS links are opened in the system browser
- recovery/device commands execute only in the Electron main process

## Output binding

The first recovery into an empty folder writes `device_identity.json`. A folder already bound to a different UDID is rejected. A populated unbound folder is also rejected. This reduces the chance of mixing libraries from different devices.

## Transfer verification

Every new RAW transfer must satisfy all of the following before it is accepted:

1. native helper byte count equals AFC-reported size;
2. local `.part` file size equals AFC-reported size;
3. SHA-256 generated from source bytes by the helper equals SHA-256 generated from the completed local file.

Only then is the partial file renamed into the RAW tree. Organized copies are hashed again against the verified RAW hash.

## Reporting a security issue

Do not include recovered media or personal device identifiers in a public issue. Provide reproduction steps and redacted logs only.
