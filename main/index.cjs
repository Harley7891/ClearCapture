const {app,BrowserWindow,ipcMain,desktopCapturer,session,dialog,shell,globalShortcut}=require('electron');
const path=require('node:path');const fs=require('node:fs/promises');const {execFile}=require('node:child_process');const {pathToFileURL}=require('node:url');
let win,store,writer,model,grant=null,busy=false,allowClose=false,shortcutsRegistered=[],approvedFFmpeg=new Set();
let capabilities={platform:process.platform,ffmpegAvailable:false,ffmpegPath:''};
const testProfile=process.env.CLEARCAPTURE_TEST_PROFILE;
if(testProfile)app.setPath('userData',testProfile);
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
const entry=path.join(__dirname,'..','renderer','index.html');
const trustedUrl=url=>url===pathToFileURL(entry).href;
function validateSender(event){if(!win||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||!trustedUrl(event.senderFrame.url))throw new Error('Untrusted application request');}
function handle(name,fn){ipcMain.handle(name,async(event,...args)=>{validateSender(event);return fn(...args);});}
const text= (zh,en)=>store?.settings.language==='zh-CN'?zh:en;
function probe(executable){return new Promise(resolve=>execFile(executable,['-version'],{windowsHide:true,timeout:5000,maxBuffer:64*1024},(err,stdout)=>resolve(!err&&/^ffmpeg version /.test(stdout))));}
async function detectFFmpeg(){
  const chosen=store.settings.ffmpegPath;
  if(chosen&&path.basename(chosen).toLowerCase()==='ffmpeg.exe')approvedFFmpeg.add(chosen);
  for(const candidate of [chosen,process.platform==='win32'?'ffmpeg.exe':'ffmpeg'].filter(Boolean)){
    if(await probe(candidate)){approvedFFmpeg.add(candidate);capabilities={...capabilities,ffmpegAvailable:true,ffmpegPath:candidate};return;}
  }
  capabilities={...capabilities,ffmpegAvailable:false,ffmpegPath:''};
}
function registerShortcuts(settings){
  const pairs=[['record',settings.hotkeyRecord],['pause',settings.hotkeyPause]].filter(([,key])=>key);
  if(pairs.length===2&&pairs[0][1]===pairs[1][1])throw new Error(text('两项快捷键不能相同','Recording and pause shortcuts must differ'));
  const old=shortcutsRegistered;old.forEach(key=>globalShortcut.unregister(key));const registered=[];
  try {for(const [action,key]of pairs){if(!globalShortcut.register(key,()=>win?.webContents.send('app:shortcut',action)))throw new Error(text(`快捷键不可用：${key}`,`Shortcut unavailable: ${key}`));registered.push(key);}shortcutsRegistered=registered;}
  catch(e){registered.forEach(key=>globalShortcut.unregister(key));for(const [action,key]of [['record',store.settings.hotkeyRecord],['pause',store.settings.hotkeyPause]])if(old.includes(key))globalShortcut.register(key,()=>win?.webContents.send('app:shortcut',action));shortcutsRegistered=old;throw e;}
}
async function installIPC(){
  handle('app:load',async()=>({settings:store.settings,project:store.project,capabilities,recordings:await store.listRecordings(),version:app.getVersion()}));
  handle('settings:save',async patch=>{
    if(!patch||typeof patch!=='object'||Array.isArray(patch))throw new Error('Invalid preferences');
    if(busy){const mutable=['language','theme','systemGain','micGain'];if(Object.keys(patch).some(k=>!mutable.includes(k)&&patch[k]!==store.settings[k]))throw new Error(text('停止录制后再修改此设置','Stop recording before changing this setting'));}
    const normalized=model.normalizeSettings({...store.settings,...patch});
    if(normalized.ffmpegPath&&normalized.ffmpegPath!==store.settings.ffmpegPath&&!approvedFFmpeg.has(normalized.ffmpegPath))throw new Error('Choose FFmpeg through the file picker');
    const keysChanged=normalized.hotkeyRecord!==store.settings.hotkeyRecord||normalized.hotkeyPause!==store.settings.hotkeyPause;
    const ffmpegChanged=normalized.ffmpegPath!==store.settings.ffmpegPath;
    if(keysChanged)registerShortcuts(normalized);await store.saveSettings(normalized);if(ffmpegChanged)await detectFFmpeg();return {settings:store.settings,capabilities};
  });
  handle('project:save',async project=>{if(JSON.stringify(project).length>24*1024*1024)throw new Error('Scene project is too large');return store.saveProject(project);});
  handle('capture:sources',async()=>{
    const sources=await desktopCapturer.getSources({types:['screen','window'],thumbnailSize:{width:300,height:168},fetchWindowIcons:false});
    return sources.filter(s=>s.id!==`window:${win.getMediaSourceId().split(':')[1]}:0`&&s.id!==win.getMediaSourceId()).map(s=>({id:s.id,name:s.name,thumbnail:s.thumbnail.toDataURL(),kind:s.id.startsWith('screen:')?'screen':'window'}));
  });
  handle('capture:select',async(id,audio)=>{if(busy)throw new Error('Cannot change capture while recording');if(typeof id!=='string'||id.length>200)throw new Error('Invalid capture source');grant={id,audio:audio===true,expires:Date.now()+15000};return true;});
  handle('capture:cancel',()=>{grant=null;});
  handle('record:begin',async()=>{if(writer.active)throw new Error('Recording already active');if(store.settings.container==='mp4'&&!capabilities.ffmpegAvailable)throw new Error(text('MP4 需要 FFmpeg，请在输出设置中选择它','MP4 needs FFmpeg. Choose it in Output settings.'));const result=await writer.begin(store.settings);busy=true;return result;});
  handle('record:write',async(id,sequence,data)=>{if(!(data instanceof ArrayBuffer))throw new Error('Invalid chunk payload');return writer.append(id,sequence,new Uint8Array(data));});
  handle('record:finish',async(id,duration)=>{try{const r=await writer.finish(id,{duration,ffmpegPath:capabilities.ffmpegPath});await store.addRecording(r);return r;}finally{busy=false;}});
  handle('record:abort',async id=>{try{const partial=await writer.abort(id);if(partial.size&&!store.recordings.some(r=>r.path===partial.partial))await store.addRecording({id:partial.id,path:partial.partial,name:path.basename(partial.partial),size:partial.size,duration:0,createdAt:new Date().toISOString(),format:'partial',incomplete:true});return partial;}finally{busy=false;}});
  handle('recordings:list',()=>store.listRecordings());
  handle('recordings:open',async id=>{const r=store.recording(id);await fs.access(r.path);const error=await shell.openPath(r.path);if(error)throw new Error(error);});
  handle('recordings:reveal',async id=>{const r=store.recording(id);await fs.access(r.path);shell.showItemInFolder(r.path);});
  handle('output:reveal',async()=>{await fs.mkdir(store.settings.outputDirectory,{recursive:true});const error=await shell.openPath(store.settings.outputDirectory);if(error)throw new Error(error);});
  handle('dialog:directory',async()=>{const r=await dialog.showOpenDialog(win,{title:text('选择录制文件夹','Choose recording folder'),defaultPath:store.settings.outputDirectory,properties:['openDirectory','createDirectory']});return r.canceled?null:r.filePaths[0];});
  handle('dialog:ffmpeg',async()=>{const r=await dialog.showOpenDialog(win,{title:text('选择 ffmpeg.exe','Choose ffmpeg.exe'),properties:['openFile'],filters:[{name:'FFmpeg',extensions:['exe']}]});if(r.canceled)return null;const p=r.filePaths[0];if(path.basename(p).toLowerCase()!=='ffmpeg.exe'||!await probe(p))throw new Error('Choose a working ffmpeg.exe');approvedFFmpeg.add(p);return p;});
  handle('project:export',async()=>{const r=await dialog.showSaveDialog(win,{defaultPath:'ClearCapture-scenes.json',filters:[{name:'ClearCapture Scenes',extensions:['json']}]});if(r.canceled)return null;await fs.writeFile(r.filePath,JSON.stringify(store.project,null,2),'utf8');return r.filePath;});
  handle('project:import',async()=>{if(busy)throw new Error('Stop recording before importing');const r=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'ClearCapture Scenes',extensions:['json']}]});if(r.canceled)return null;if((await fs.stat(r.filePaths[0])).size>24*1024*1024)throw new Error('Project exceeds 24 MiB');return model.normalizeProject(JSON.parse(await fs.readFile(r.filePaths[0],'utf8')));});
  handle('app:busy',value=>{busy=value===true||Boolean(writer.active);});handle('app:minimize',()=>win.minimize());
  handle('app:closeReady',()=>{if(writer.active)throw new Error('Recording not finalized');allowClose=true;win.close();});
}
app.whenReady().then(async()=>{
  model=await import('./../shared/model.mjs');const {Store}=await import('./storage.mjs');const {RecordingWriter}=await import('./recordings.mjs');
  store=await new Store(app.getPath('userData')).init();writer=new RecordingWriter();
  if(!store.settings.outputDirectory)await store.saveSettings({outputDirectory:path.join(app.getPath('videos'),'ClearCapture')});
  await store.recoverPartials(store.settings.outputDirectory);
  await detectFFmpeg();
  win=new BrowserWindow({width:1440,height:900,minWidth:1120,minHeight:760,title:'ClearCapture',icon:path.join(__dirname,'..','assets','icon.png'),backgroundColor:'#10111a',autoHideMenuBar:true,show:false,
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,backgroundThrottling:false}});
  const ses=session.defaultSession;
  ses.setPermissionCheckHandler((webContents,permission,requestingOrigin,details)=>webContents===win.webContents&&details.isMainFrame&&trustedUrl(details.requestingUrl??webContents.getURL())&&['media','display-capture'].includes(permission));
  ses.setPermissionRequestHandler((webContents,permission,callback,details)=>callback(webContents===win.webContents&&details.isMainFrame&&trustedUrl(details.requestingUrl??webContents.getURL())&&['media','display-capture'].includes(permission)));
  ses.setDisplayMediaRequestHandler(async(request,callback)=>{
    const chosen=grant;grant=null;
    if(!chosen||chosen.expires<Date.now()||request.frame!==win.webContents.mainFrame||!trustedUrl(request.frame.url)){callback({});return;}
    try {const sources=await desktopCapturer.getSources({types:['screen','window'],thumbnailSize:{width:0,height:0}});const source=sources.find(s=>s.id===chosen.id);if(!source){callback({});return;}callback({video:source,...(chosen.audio&&process.platform==='win32'?{audio:'loopback'}:{})});}catch{callback({});}
  });
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(event,url)=>{if(!trustedUrl(url))event.preventDefault();});
  await installIPC();try{registerShortcuts(store.settings);}catch(e){capabilities.shortcutWarning=e.message;}
  win.on('close',async event=>{
    if(allowClose||(!busy&&!writer.active))return;event.preventDefault();
    if(win._closingPrompt)return;win._closingPrompt=true;
    try {const r=await dialog.showMessageBox(win,{type:'question',title:'ClearCapture',message:text('录制尚未完成。停止并保存后退出？','Recording is active. Stop, save and quit?'),buttons:[text('继续录制','Keep recording'),text('保存并退出','Save and quit')],defaultId:0,cancelId:0});if(r.response===1)win.webContents.send('app:closeRequest');}finally{win._closingPrompt=false;}
  });
  await win.loadFile(entry);win.show();
}).catch(error=>{dialog.showErrorBox('ClearCapture',error.stack||error.message);app.quit();});
app.on('window-all-closed',()=>app.quit());app.on('will-quit',()=>globalShortcut.unregisterAll());
