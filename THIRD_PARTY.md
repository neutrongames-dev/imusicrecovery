# Third-party components

## Electron

Project: Electron
License: MIT
Website: https://www.electronjs.org/

## Vite

Project: Vite
License: MIT
Website: https://vite.dev/

## libimobiledevice

Project: libimobiledevice
License: LGPL-2.1-or-later
Website: https://libimobiledevice.org/
Repository: https://github.com/libimobiledevice/libimobiledevice

The Windows build obtains libimobiledevice and its runtime dependencies from MSYS2. The resulting application expects Apple Mobile Device Support on Windows for the Apple-provided usbmux service.

## libusbmuxd and related libimobiledevice ecosystem libraries

Runtime dependencies may include libusbmuxd, libplist, libimobiledevice-glue, OpenSSL/GnuTLS-related libraries, and other packages pulled by the MSYS2 dependency graph. Their licenses remain their respective upstream licenses.

Before a public binary release, archive the exact CI dependency inventory and ship all license texts/notices required by the staged runtime. LGPL libraries must remain replaceable/relinkable as required by their license; do not statically absorb them into proprietary code in a way that removes those rights.

## Apple components

Apple Mobile Device Support / Apple Devices is not bundled by this repository. Users obtain Apple software through Apple's supported Windows distribution channels. Apple names and iPod are trademarks of Apple Inc.; iMusicRecovery is not affiliated with or endorsed by Apple.
