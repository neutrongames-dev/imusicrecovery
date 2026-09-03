# Compatibility

## Current desktop backend

The first Windows build is intentionally restricted to the iPod touch family because these devices use Apple's lockdown/usbmux/AFC service stack.

| ProductType | Model | Status |
|---|---|---|
| iPod1,1 | iPod touch 1st gen | Primary validation target |
| iPod2,1 | iPod touch 2nd gen | Supported architecture; hardware test recommended |
| iPod3,1 | iPod touch 3rd gen | Supported architecture; hardware test recommended |
| iPod4,1 | iPod touch 4th gen | Supported architecture; hardware test recommended |
| iPod5,1 | iPod touch 5th gen | Supported architecture; hardware test recommended |
| iPod7,1 | iPod touch 6th gen | Supported architecture; hardware test recommended |
| iPod9,1 | iPod touch 7th gen | Supported architecture; hardware test recommended |

The app rejects other Apple ProductType values rather than attempting recovery from an unvalidated device family.

## Traditional iPods

Classic, Nano, Mini, Photo, Video, and Shuffle models are not handled by lockdown/AFC. They require a separate disk-mode/mass-storage backend. The recovery and organization layers were designed so that a future disk source can feed the same RAW/hash/metadata pipeline.

## Very old TLS

Early iPod touch firmware may use TLS 1.0, SHA-1-era certificates, small RSA keys, or legacy renegotiation. The packaged native Apple-device processes receive a private OpenSSL configuration allowing those legacy parameters at security level 0. The setting is not applied globally to Windows or to the Electron renderer.
