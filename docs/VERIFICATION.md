# ClearCapture 0.1 verification

Date: 2026-10-11. Platform: Windows x64, Windows build 26200; Node 24.19.0, Electron 44.7.0. This is local engineering verification, not public-release approval or physical-hardware certification.

## Verified scope

- 12 model/filesystem tests pass: bounded settings/geometry, project normalization, safe image resources, atomic persistence/corrupt preferences recovery, ordered recording writes, session isolation, preserved originals on conversion error, real closed-file write failure, and bounded partial discovery/history persistence.
- Syntax checks cover 14 modules. Five dictionaries share 160 keys: Simplified Chinese, English, Japanese, German, Spanish.
- Native desktop integration covers 22 checks, with saved-media probing and decoded-frame inspection: real Windows window capture; system loopback (440 Hz); synthetic microphone (880 Hz); camera/image/text composition; scenes; five languages; themes; settings; pause/resume; final chunk ordering; seekable WebM; H.264/AAC MP4; countdown cancellation; timed stop; mic mute preserving system sound; invalid output path recovery; early source lock; permission denial rollback; partial visibility; partial history surviving reload.
- Decoded output contains the intended window test pattern, camera overlay, image and text. No private desktop window was the intended capture source.
- Independent read-only review found a start-preflight race and hidden partial-file recovery. Both were repaired in one targeted pass and checked with delayed microphone initialization, denied permission and an injected write failure after a real first chunk. This is parent verification of repairs, not a second independent review.
- npm audit reports zero known dependency advisories after pinning the build tool's global-agent to 4.1.3. Application runtime has no npm production dependencies.

## Evidence

`artifacts/smoke-report.json` records codec/stream/duration/size, tone amplitudes, test names and renderer errors. `artifacts/recorded-frame.png` is decoded from actual WebM. `artifacts/studio-final-zh.png`, `studio-light.png`, `studio-recovery-zh.png` are desktop screenshots. Per-run clips are in `artifacts/recordings/`. Generated artifacts are excluded from the source archive.

Camera/microphone fixtures replace only getUserMedia inside the test. Screen capture and Windows output loopback use the production path. Physical hardware enumeration occurred; physical microphone/camera signal quality remains NOT VERIFIED.

## NOT VERIFIED

Physical microphone/camera quality; exhaustive Windows compatibility; output-device changes; hour-long recordings; unexpected power loss; 4K/60 performance; capture hardware; separate audio tracks; hardware encoding; streaming; OBS plugins; Linux/macOS; code signing; public CI execution; formal security/legal/commercial review. Cursor hiding depends on the capture backend. FPS is a target rather than a performance guarantee.

Without FFmpeg, WebM seeking/duration metadata depend on the player. MP4 requires installed FFmpeg and retains its original WebM. Partial recordings are explicitly incomplete and may require recovery; the app does not promise every interrupted file will play.
