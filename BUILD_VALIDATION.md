# Build validation

Validation performed in the artifact-generation environment on 2026-09-02:

- Native AFC read-only source policy: PASS
- Desktop recovery invariant tests: PASS
- Windows-safe path / traversal / organized naming tests: PASS
- ID3 metadata reconstruction test: PASS
- Electron preload isolation invariant: PASS
- Renderer TypeScript strict check: PASS
- Electron TypeScript syntax/emission check (`--noCheck`, dependencies unavailable locally): PASS
- Sandboxed preload output verified as CommonJS `preload.cjs`: PASS
- Native staging shell syntax: PASS
- GitHub Actions workflow YAML parse: PASS
- Branded Windows `.ico` generation: PASS

The artifact-generation environment cannot install the npm dependency graph or run a Windows/MSYS2 toolchain, so it cannot produce or execute the final Windows `.exe` here. The included Windows GitHub Actions workflow performs the full npm installation, UCRT64/libimobiledevice native compilation, runtime DLL staging, TypeScript build, Electron packaging, and artifact upload on `windows-latest`.

Physical-device validation is still required, especially for the target 1st-generation iPod touch / iPhone OS 3.1.3. The app scopes the same legacy OpenSSL compatibility policy used by the v5 recovery baseline to its bundled native Apple-device child processes.
