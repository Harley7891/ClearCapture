# Third-party notices

ClearCapture application code is GPL-3.0-only. Copyright (c) 2026 ClearCapture contributors. No OBS source, branding, assets or plugins are incorporated.

The Windows runtime redistributes Electron 44.7.0 (MIT) and its Chromium/Node.js components under their respective licenses. The full Electron license and Chromium notices accompany the application in `assets/ELECTRON-LICENSE` and `assets/CHROMIUM-NOTICES.html`; Electron's packaged root LICENSE and LICENSES.chromium.html are also retained by electron-builder. See https://www.electronjs.org and https://github.com/electron/electron.

Development/build dependencies are pinned in package-lock.json: Electron, electron-builder (MIT), Playwright (Apache-2.0) and their transitive packages. They are development tools, not dependencies loaded by application code. npm package metadata and dependency license files are available in a source checkout after npm install.

FFmpeg is **not bundled**. The app can use a separately installed ffmpeg.exe for MP4 H.264/AAC conversion and seekable WebM finalization. Each FFmpeg build has its own licensing/configuration; local verification used the existing system installation. Do not copy a binary into a redistributed release without preserving that build's license, source and provenance. See https://www.ffmpeg.org/legal.html.

Built-in UI shapes, logo and layout are original project code. No remote fonts, stock media or paid assets are required. Test-pattern images, tones and synthetic camera fixtures are generated in the test script.
