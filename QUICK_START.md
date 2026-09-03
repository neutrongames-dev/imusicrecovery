# Quick start: get the Windows application

1. Create a new GitHub repository for the desktop app.
2. Extract this ZIP and upload/paste its contents at the repository root. Keep `.github/workflows/build-windows.yml` in that exact path.
3. Push/commit to the `main` branch.
4. Open the repository's **Actions** tab and select **Build Windows Desktop**.
5. Open the successful run and download the **iMusicRecovery-Windows-x64** artifact.
6. Extract the artifact. It contains the Windows installer and portable build produced by electron-builder.
7. On the recovery PC, make sure Apple's Windows device support is installed, connect the iPod, and launch iMusicRecovery.

The workflow does not need Cloudflare credentials, Apple developer credentials, or a custom USB driver. Public releases should be code-signed before broad distribution.
