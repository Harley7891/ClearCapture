# UI / Studio contract

UI writer owns `renderer/index.html`, `renderer/styles.css`, `renderer/app.js`, `renderer/i18n.js` only. Main owns `studio.js`, shared model, native files, tests and all other docs. No bundler/framework: index.html loads app.js as module. CSP: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'. Use no remote content or user-controlled innerHTML.

`import { createStudio } from './studio.js'; const studio = await createStudio(document.querySelector('#preview-canvas'));`
`studio.subscribe(snapshot => ...)` returns unsubscribe. `studio.snapshot()` has:
- settings: language('zh-CN'|'en'|'ja'|'de'|'es'), theme('dark'|'light'), width,height,fps,videoBitrateMbps,codec('auto'|'vp8'|'vp9'), audioBitrateKbps,sampleRate,systemEnabled,micEnabled,micDeviceId,cameraDeviceId,systemGain,micGain,echoCancellation,noiseSuppression,autoGainControl,container('webm'|'mp4'),outputDirectory,filenamePrefix,countdownSeconds,maxMinutes,maxSizeMB,autoMinimize,showCursor,backgroundColor,transitionMs,hotkeyRecord,hotkeyPause,ffmpegPath.
- project: {activeSceneId, scenes:[{id,name,layers:[{id,type:'display'|'camera'|'image'|'text',name,visible,opacity,x,y,w,h,fit:'contain'|'cover'|'stretch',text?,fontSize?,color?,dataUrl?,mirror?}]}]}; x/y/w/h are normalized 0..1. Layers drawn in array order (last is top).
- selectedLayerId, status ('idle'|'countdown'|'recording'|'paused'|'stopping'), elapsed (seconds excluding pause), bytes, countdown, error (string), message (string), sourceId,sourceName, meters:{system,mic} normalized 0..1, capabilities:{platform,ffmpegAvailable,ffmpegPath}, devices:{audioInputs:[{deviceId,label}],videoInputs:[{deviceId,label}]}, recordings:[{id,path,name,size,duration,createdAt,format}], cameraReady,micReady,captureReady.

All actions may throw; UI handler catches and shows native Error.message. Errors/messages clearable with studio.clearNotice(). Only gains/language/theme/scene edits mutable during recording; disable other settings and device/source buttons while status is not idle.

Actions:
- `await studio.refreshSources()` => [{id,name,thumbnail,kind:'screen'|'window'}]. Source-picker dialog calls on open, choice button calls `await studio.selectSource(id,name)`. No capture at launch.
- `await studio.releaseCapture()`; `await studio.refreshDevices()`.
- `await studio.setSettings(patch)` => normalized saved settings; settings UI includes host folder choose and executable choose using `window.clearCapture.chooseDirectory()` / `.chooseFFmpeg()`, return string|null, then setSettings.
- `await studio.addScene(name)`; `await studio.duplicateScene()`; `await studio.renameScene(id,name)`; `await studio.deleteScene(id)` (must retain one); `await studio.activateScene(id)`.
- `await studio.addLayer(type,options={})`; `studio.selectLayer(id)`; `await studio.updateLayer(id,patch)`; `await studio.removeLayer(id)`; `await studio.moveLayer(id,delta)` where +1 raises; camera add activates camera. Image uses input FileReader dataUrl with MIME png/jpeg/webp/gif and max 5 MiB. Text layer add defaults to 'Your title'.
- `await studio.start()`; `await studio.stop()`; `studio.pause()`; `studio.resume()`; `await studio.toggleRecording()`; `await studio.togglePause()`.
- `await studio.refreshRecordings()`; `await window.clearCapture.openRecording(id)` / `.revealRecording(id)` / `.revealOutput()`.
- `await window.clearCapture.exportProject()` / `.importProject()`; import returns project|null, call `await studio.replaceProject(project)`.

UI design: sophisticated dark creator workstation with purple/teal accents, restrained typography, brand ClearCapture / 澄录, header with source/select + settings + language, 16:9 center preview, record/pause/timer transport, scenes and sources left, layer inspector right, bottom audio mixer and local library. Responsive within desktop 1120x760 minimum; settings modal with General/Video/Audio/Output/Hotkeys categories and descriptive hints. Full visible strings localized (including dialogs and labels); intentional product/source/file names need not translate. English/Chinese/Japanese/German/Spanish dictionaries share keys. Local data never upload. Interface must accurately describe current capabilities.

Optional accessibility: keyboard operable buttons/dialogs, focus restoration, title/aria labels, toast live region. Canvas mouse drag layer placement: UI calls updateLayer on pointer up with normalized bounds; do not write production controller code. Scope is one shared screen and one camera across scenes; no livestreaming button.
