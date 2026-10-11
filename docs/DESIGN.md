# ClearCapture 0.1 design

Date: 2026-10-11. User goal: a from-scratch open-source recorder with audio, languages and comprehensive settings. User chose a creator studio with camera, scenes and media composition. Windows x64 is the first delivery target, inferred from the working environment.

## Product and acceptance

Deliver a usable desktop executable and complete source in this independent directory. Provide screen/window choice, live composed preview, camera overlays, image and text layers, multiple scenes, layer visibility/order/geometry, separate system/microphone gain and meters, start/pause/resume/stop, countdown, recording limits, local library and output-folder controls. Five interface languages (Simplified Chinese, English, Japanese, German, Spanish), dark/light themes, video/audio/output/hotkey settings and persistence. No cloud account or upload. Screen capture is explicit; no automatic capture on app launch.

The initial compositor has one shared screen/window input and one camera input across scenes. Scene switching alters composition. Native Chromium MediaRecorder produces WebM (VP8/VP9 + Opus). Optional MP4 (H.264/AAC) conversion uses a user-installed FFmpeg, whose path/capability is detected. Do not bundle an untracked binary. MP4 conversion preserves the WebM original on failure. Native platform capture, professional hardware inputs, streaming services and OBS plugins are future work; never advertise those as implemented.

## Architecture

Electron 44.7.0 / Node 24.19.0, plain browser modules, Canvas2D compositor, Web Audio mixer, MediaRecorder. Electron main owns permission grants, dialogs, validated atomic preferences, output files, FFmpeg execution, global shortcuts, and close protection. Sandbox and context isolation remain enabled; preload exposes only a narrow typed bridge. Renderer owns UI and media devices, and never receives unrestricted filesystem access. Sources are picked explicitly, then a one-use display grant is consumed by getDisplayMedia.

`shared/model.mjs`: defaults, normalization, scenes and geometry. `main/storage.mjs`: atomic settings/project writes and indexed history. `main/recordings.mjs`: serialized chunk writes, finalized WebM and safe optional transcoding. `main/index.cjs` / `preload.cjs`: native boundary. `renderer/studio.js`: state, composition, audio, recorder, lifecycle. `renderer/app.js`, `styles.css`, `index.html`, `i18n.js`: UI (one delegated writer). Main thread owns all other files and verification.

## Failure handling

Recording lifecycle is idle/countdown/recording/paused/stopping. Prevent overlapping starts/stops. Write chunks sequentially with a bounded queue; failed output stops recording and retains partial evidence. Stop waits for final data and file completion. Window close while recording requests confirmation and finalization. Capture/device loss surfaces a clear error. Settings validate sizes, rates, gain and filenames. File actions accept only paths in recording history. Display capture and media permission requests from unrelated origins/frames are denied.

## Open-source delivery

GPL-3.0-only application source, full license text, dependency lockfile, Electron/Chromium notices in release, README in Chinese and English, contribution and security guidance, test commands, CI definition and explicit platform/feature limitations. The initial scope covered packaging and local Git history. On 2026-10-11 the user additionally authorized publication of this project to their GitHub account.

## Verification and scope controls

Automated tests cover input normalization, malformed persistence, file ordering/finalization and conversion failure. Electron integration tests exercise the real UI and capture an app-owned test-pattern window, mixed system tone and deterministic fake microphone/camera; inspect recordings with FFprobe/FFmpeg and actual decoded frames. Physical microphone/camera quality, long-duration stability, other platforms, signing and public release stay NOT VERIFIED until actually tested.

Production time target: 90 minutes for this first delivery, without broad exploratory research. One UI implementer and one final reviewer; no nested delegation, at most two targeted repair passes. This task creates software, not training assets; do not read or modify formal NeonBreach projects or training assets.
