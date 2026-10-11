# ClearCapture

An open-source local recording studio for creators. Windows x64 first; GPL-3.0-only. Choose a screen/window, compose camera/image/text layers into scenes, mix Windows system output and microphone, then record, pause, resume and save locally. No account or upload is required.

**v0.1.0 preview** · [Download Windows app and corresponding source](https://github.com/Harley7891/ClearCapture/releases/tag/v0.1.0) · [简体中文](README.md) · [Report a bug](https://github.com/Harley7891/ClearCapture/issues)

Five UI languages: Simplified Chinese, English, Japanese, German and Spanish. Settings cover canvas size, frame rate, bitrate, codec, audio devices/processors/gains, output format/location, countdown/limits, shortcuts, theme and scene transitions. Scenes share one screen/window input and one camera input. The local library opens and reveals files; scene projects import/export as JSON.

Native recording uses WebM VP8/VP9 + Opus. A separately installed FFmpeg enables MP4 H.264/AAC conversion and seekable WebM finalization. FFmpeg is not downloaded or bundled. MP4 preserves its WebM original. System audio is the entire Windows output, not per-window audio. Use headphones to avoid microphone feedback.

Default folder: `Videos/ClearCapture`. Default shortcuts: Ctrl+Shift+R record/stop; Ctrl+Shift+P pause/resume. Output and shortcuts are configurable. Run `ClearCapture.exe` from the unpacked distribution or the single portable executable.

Development requires Node 22+ and Windows x64. Run `npm install`, `npm run setup`, `npm start`. Validate with `npm test`, `npm run check`, `npm run test:e2e` (FFmpeg/FFprobe required). Package with `npm run package` or `npm run release`. Tests create an owned pattern window and recording fixtures under `artifacts/`; native display/system-audio paths are exercised, while camera/microphone are synthetic test fixtures.

0.1 does not include live streaming, OBS plugins, capture cards, separate audio tracks, hardware encoder selection or non-Windows distribution. Physical hardware quality, long-duration stability and 4K/60 performance are not yet verified. FPS is a target, not a performance guarantee. Cursor hiding depends on the capture backend. Animated GIFs are drawn as still images. Unsigned packages may trigger Windows publisher warnings.

See `docs/VERIFICATION.md`, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE` and `THIRD_PARTY_NOTICES.md` for evidence, contributions and licensing.
