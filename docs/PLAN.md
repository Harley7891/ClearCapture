# ClearCapture implementation plan

**Goal:** a runnable Windows creator recording studio with local-only files and open-source delivery.
**Spec:** DESIGN.md.
**Architecture:** secure Electron host, browser capture/composition/mixing, serialized recording writer and independent UI module.

## Constraints

Windows x64 first. One shared capture input across scenes. WebM native; installed FFmpeg for MP4. Five languages. GPL-3.0-only. All implementation stays in this standalone folder; no formal project access or nested agents. External publication was excluded from the initial delivery; on 2026-10-11 the user explicitly authorized publication to their GitHub account.

## Review focus

1. Double start/stop, delayed final chunks and pause/close: exactly one finalized recording.
2. Permission/device denial or loss: no silently missing requested sound; clear recovery.
3. Disk/conversion errors: retain recoverable original and show actual outcome.
4. Malformed settings/projects and untrusted renderer arguments: normalize input and restrict native capabilities.
5. Capture preview recursion, camera loss, scenes and scaling: inspect a decoded frame of the actual output.

## Tasks

- [x] 1. Host and shared model. Write behavior tests first; validate defaults/geometry, persistence and sequential chunk output. Add isolated preload IPC, explicit source grants and global shortcuts. Check unit suite.
- [x] 2. UI (delegated, owns index.html/styles.css/app.js/i18n.js only). Five languages, preview/canvas, scenes/sources/inspector, audio mixer, library and full working settings dialog. Parent defines Studio API. Check syntax and real UI interaction.
- [x] 3. Studio media pipeline (main thread). Capture devices, canvas composition, audio mixing, meter, recording lifecycle and stream cleanup. Check capture integration, pause/resume, scenes and errors.
- [x] 4. Verify and deliver. Native integration, decode/inspect actual clips, targeted independent review, packaging, executable launch check, licenses/docs/source archive/manifest. Report physical-device and endurance unknowns honestly.

## Progress

2026-10-11: scope chosen by user (creator workbench). Read-only discovery started. Ordinary technical decisions autonomous as requested. No formal project access.

2026-10-11: Implementation and native media checks complete. One independent review; one targeted repair pass. 12 unit tests, 22 integration checks, five languages/160 keys. Packaging and archive readback are final delivery checks.

