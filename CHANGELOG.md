# Changelog

## 1.0.1 — Release packaging + date-aware studio promotion

- Switched Windows CI/release dependency installs to `npm ci` for lockfile-reproducible builds.
- Added stable installer and portable artifact names.
- Added date-aware Neutron Studios promotion: The Guardians wishlist before October 15, launch promotion through November, and a general Steam support CTA starting December 1, 2026.
- Added official Steam/Neutron promotional artwork with gradient fallbacks when offline.
- Kept all recovery-device code unchanged.

## 1.0.0 — Desktop conversion

- Replaced browser WebUSB transport with native Windows libimobiledevice/libusbmuxd transport.
- Added Electron desktop shell using the existing iMusicRecovery visual language.
- Added Windows Apple Mobile Device Service diagnostics and normal device pairing.
- Added explicit iPod touch 1st–7th generation compatibility gate.
- Added a custom C AFC helper with directory listing and binary read operations only.
- Added Unicode-safe Windows output paths in the native helper.
- Added legacy TLS compatibility scoped to the native Apple-device processes for early iPod touch firmware.
- Preserved RAW-first recovery from both iTunes_Control/Music and Purchases.
- Preserved SHA-256 device-read verification, crash/resume manifests, device-bound output folders, audio metadata reconstruction, video metadata reconstruction, duplicate handling, and DRM flagging.
- Added native runtime dependency/license staging through MSYS2 UCRT64.
- Added GitHub Actions Windows installer + portable build.
- Added Electron sandbox/context-isolation hardening and a narrow CommonJS preload bridge.
- Added Neutron Studios house promotion without third-party advertising.
