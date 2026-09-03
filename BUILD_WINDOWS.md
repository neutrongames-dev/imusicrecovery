# Building iMusicRecovery for Windows

## Recommended: GitHub Actions

The repository contains `.github/workflows/build-windows.yml`. It uses a Windows runner plus MSYS2 UCRT64 so the native runtime and Electron package are built in the same job.

No Apple binaries are redistributed by the source repository. The runtime built in CI contains open-source libimobiledevice components and expects Apple's Mobile Device Support service to already be installed on the user's PC.

## Local Windows build

### 1. Install prerequisites

- Node.js 24
- Git
- MSYS2
- Apple Devices or another supported Apple package that installs Apple Mobile Device Support (required for real device testing)

### 2. Install JavaScript dependencies

From PowerShell:

```powershell
npm ci --no-audit --no-fund
```

### 3. Install MSYS2 native packages

Open **MSYS2 UCRT64**:

```bash
pacman -Syu
pacman -S --needed \
  mingw-w64-ucrt-x86_64-toolchain \
  mingw-w64-ucrt-x86_64-libimobiledevice \
  mingw-w64-ucrt-x86_64-pkgconf
```

### 4. Build/stage the native runtime

Still in UCRT64, from the repository directory:

```bash
./scripts/stage-msys2-runtime.sh
```

Verify:

```powershell
node scripts/verify-native-runtime.mjs
npm run verify
```

### 5. Package

```powershell
npm run dist:win
```

Artifacts are written to `release/`.

## Code signing

Development builds are intentionally produced unsigned. Before public release or Microsoft Store submission, sign the application/installer with an appropriate Windows code-signing identity or use the Store/MSIX signing path selected for distribution.
