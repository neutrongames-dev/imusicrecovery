# iMusicRecovery Desktop

A preservation-first Windows desktop application for recovering music and video from legacy iPod touch devices.

This repository is the native successor to the experimental browser/WebUSB build. The desktop app keeps the web-style interface but communicates through Apple's normal Windows device stack using libimobiledevice/libusbmuxd. It does **not** require replacing the Apple USB driver with WinUSB or Zadig.

## Current scope

Supported in this first Windows release:

- iPod touch 1st generation (`iPod1,1`)
- iPod touch 2nd generation (`iPod2,1`)
- iPod touch 3rd generation (`iPod3,1`)
- iPod touch 4th generation (`iPod4,1`)
- iPod touch 5th generation (`iPod5,1`)
- iPod touch 6th generation (`iPod7,1`)
- iPod touch 7th generation (`iPod9,1`)

Traditional iPod Classic, Nano, Mini, Photo, Video, and Shuffle models use a different storage/transport path and are intentionally not claimed as supported yet.

## Recovery design

The recovery engine is preservation-first:

1. Detect exactly one connected Apple device.
2. Validate or establish the normal Apple pairing record.
3. Inventory both `/iTunes_Control/Music` and `/Purchases` through AFC.
4. Copy every regular file into a `RAW/` preservation tree first.
5. Hash bytes while they are read from the iPod in the native helper.
6. Hash the completed local `.part` file again with Node.js.
7. Keep the RAW file only when source size, destination size, and SHA-256 agree.
8. Build organized `Music/` and `Video/` copies only from verified RAW files.
9. Generate CSV manifests and a JSON completion summary.

The native helper exposes only AFC directory/stat/read operations. It contains no AFC write, remove, rename, mkdir, restore, sync, erase, or firmware-update operation.

## Windows requirements

- Windows 10/11 x64
- Apple Mobile Device Support / Apple Devices installed and functioning
- USB cable
- Enough destination disk space for RAW preservation plus an organized copy when using the recommended mode

The application checks for the Apple Mobile Device Service and provides diagnostics when the service or device is unavailable.

## Build the Windows release

The easiest reproducible path is GitHub Actions:

1. Push this repository to GitHub.
2. Open **Actions → Build Windows Desktop**.
3. Run the workflow, or push to `main`.
4. Download the `iMusicRecovery-Windows-x64` artifact.

The workflow builds the read-only AFC helper against the current MSYS2 `libimobiledevice` package, stages its DLL dependencies, verifies the read-only API surface, builds Electron, and produces:

- NSIS installer `.exe`
- portable `.exe`

See [`BUILD_WINDOWS.md`](BUILD_WINDOWS.md) for local build details.

## Development

```bash
npm ci --no-audit --no-fund
npm run verify
```

Running the desktop app against a real iPod requires the Windows native runtime in `vendor/native/`. The GitHub workflow creates that runtime automatically. On a Windows MSYS2/UCRT64 environment, run:

```bash
./scripts/stage-msys2-runtime.sh
```

Then from PowerShell/cmd:

```bash
npm run dev
```

## Recovery output

A selected empty recovery directory becomes device-bound:

```text
Recovery Folder/
├── device_identity.json
├── RAW/
│   ├── iTunes_Control/
│   │   └── Music/
│   └── Purchases/
├── Music/
├── Video/
│   ├── Movies/
│   └── TV Shows/
└── Reports/
    ├── raw_manifest.csv
    ├── organized_manifest.csv
    └── summary.json
```

Do not erase, restore, sync, or discard the original iPod until you have independently checked that the recovered library contains what you need.

## Safety limitations

Recovery cannot be guaranteed. Aging flash storage, filesystem damage, a failing cable, sudden disconnect, hardware failure, Apple driver/service problems, or software defects can prevent files from being recovered. The application is designed not to intentionally modify or erase media on the iPod.

## Licensing

See [`THIRD_PARTY.md`](THIRD_PARTY.md). The packaged native runtime includes LGPL components from the libimobiledevice ecosystem. Distribution must preserve the applicable license notices and user relinking/replacement rights required by those licenses.


## Neutron Studios promotion

The application contains a restrained first-party promotion for Neutron Studios only; it does not embed an ad network or advertising SDK. The primary promo changes automatically:

- Before October 15, 2026: wishlist **The Guardians**.
- October 15 through November 30, 2026: **The Guardians** available-now promotion.
- December 1, 2026 onward: **Support Neutron Studios on Steam**.

Promotional artwork is requested from Neutron Studios/Steam when online. Recovery media, device identifiers, filenames, manifests, and logs are not included in those image requests. If the computer is offline, the promo keeps a local gradient fallback and recovery remains usable.
