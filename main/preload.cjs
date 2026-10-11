const {contextBridge,ipcRenderer}=require('electron');
const invoke=(channel,...args)=>ipcRenderer.invoke(channel,...args);
const listen=(channel,callback)=>{const fn=(_event,...args)=>callback(...args);ipcRenderer.on(channel,fn);return ()=>ipcRenderer.removeListener(channel,fn);};
contextBridge.exposeInMainWorld('clearCapture',Object.freeze({
  load:()=>invoke('app:load'),saveSettings:patch=>invoke('settings:save',patch),saveProject:project=>invoke('project:save',project),
  sources:()=>invoke('capture:sources'),selectSource:(id,audio)=>invoke('capture:select',id,audio),cancelGrant:()=>invoke('capture:cancel'),
  recordBegin:()=>invoke('record:begin'),recordWrite:(id,sequence,arrayBuffer)=>invoke('record:write',id,sequence,arrayBuffer),
  recordFinish:(id,duration)=>invoke('record:finish',id,duration),recordAbort:id=>invoke('record:abort',id),
  recordings:()=>invoke('recordings:list'),openRecording:id=>invoke('recordings:open',id),revealRecording:id=>invoke('recordings:reveal',id),revealOutput:()=>invoke('output:reveal'),
  chooseDirectory:()=>invoke('dialog:directory'),chooseFFmpeg:()=>invoke('dialog:ffmpeg'),exportProject:()=>invoke('project:export'),importProject:()=>invoke('project:import'),
  setBusy:busy=>invoke('app:busy',busy),minimize:()=>invoke('app:minimize'),closeReady:()=>invoke('app:closeReady'),
  onShortcut:fn=>listen('app:shortcut',fn),onCloseRequest:fn=>listen('app:closeRequest',fn)
}));
