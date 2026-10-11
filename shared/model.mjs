export const DEFAULT_SETTINGS = Object.freeze({
  language:'zh-CN',theme:'dark',width:1920,height:1080,fps:30,videoBitrateMbps:8,codec:'auto',
  audioBitrateKbps:192,sampleRate:48000,systemEnabled:true,micEnabled:false,micDeviceId:'default',cameraDeviceId:'default',
  systemGain:1,micGain:1,echoCancellation:false,noiseSuppression:true,autoGainControl:false,
  container:'webm',outputDirectory:'',filenamePrefix:'ClearCapture',countdownSeconds:3,maxMinutes:0,maxSizeMB:0,
  autoMinimize:false,showCursor:true,backgroundColor:'#101520',transitionMs:250,
  hotkeyRecord:'CommandOrControl+Shift+R',hotkeyPause:'CommandOrControl+Shift+P',ffmpegPath:''
});
const obj = v => v && typeof v==='object' && !Array.isArray(v) ? v : {};
const text = (v,fallback='',max=200) => typeof v==='string' ? v.slice(0,max) : fallback;
export const clamp = (v,lo,hi,fallback=lo) => Number.isFinite(Number(v)) ? Math.min(hi,Math.max(lo,Number(v))) : fallback;
const choice = (v,choices,fallback) => choices.includes(v) ? v : fallback;
const hex = (v,fallback) => /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
export const uid = () => globalThis.crypto.randomUUID();
export function normalizeSettings(value={}) {
  const v=obj(value),d=DEFAULT_SETTINGS,s={...d};
  s.language=choice(v.language,['zh-CN','en','ja','de','es'],d.language);s.theme=choice(v.theme,['dark','light'],d.theme);
  s.width=Math.round(clamp(v.width??d.width,320,3840,d.width)/2)*2;s.height=Math.round(clamp(v.height??d.height,320,2160,d.height)/2)*2;
  s.fps=choice(Number(v.fps),[15,24,30,60],d.fps);s.videoBitrateMbps=clamp(v.videoBitrateMbps??d.videoBitrateMbps,1,50,d.videoBitrateMbps);
  s.codec=choice(v.codec,['auto','vp8','vp9'],d.codec);s.audioBitrateKbps=choice(Number(v.audioBitrateKbps),[64,96,128,160,192,256,320],d.audioBitrateKbps);
  s.sampleRate=choice(Number(v.sampleRate),[44100,48000],d.sampleRate);
  for(const k of ['systemEnabled','micEnabled','echoCancellation','noiseSuppression','autoGainControl','autoMinimize','showCursor'])s[k]=typeof v[k]==='boolean'?v[k]:d[k];
  for(const k of ['micDeviceId','cameraDeviceId'])s[k]=text(v[k],d[k],500);
  for(const k of ['systemGain','micGain'])s[k]=clamp(v[k]??d[k],0,2,d[k]);
  s.container=choice(v.container,['webm','mp4'],d.container);s.outputDirectory=text(v.outputDirectory,d.outputDirectory,1000).replace(/\0/g,'');
  s.filenamePrefix=text(v.filenamePrefix,d.filenamePrefix,80).replace(/[<>:"/\\|?*\x00-\x1f]/g,'').replace(/^\.+|\.+$/g,'').trim()||d.filenamePrefix;
  s.countdownSeconds=Math.round(clamp(v.countdownSeconds??d.countdownSeconds,0,10,d.countdownSeconds));
  s.maxMinutes=clamp(v.maxMinutes??0,0,1440,0);s.maxSizeMB=clamp(v.maxSizeMB??0,0,102400,0);
  s.backgroundColor=hex(v.backgroundColor,d.backgroundColor);s.transitionMs=Math.round(clamp(v.transitionMs??d.transitionMs,0,1000,d.transitionMs));
  for(const k of ['hotkeyRecord','hotkeyPause'])s[k]=text(v[k],d[k],100);
  s.ffmpegPath=text(v.ffmpegPath,'',1000).replace(/\0/g,'');return s;
}
export function normalizeLayer(value={}) {
  const v=obj(value),type=choice(v.type,['display','camera','image','text'],null);if(!type)return null;
  if(type==='image'&&(!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v.dataUrl??'')||(v.dataUrl??'').length>7*1024*1024))return null;
  const x=clamp(v.x??0,0,0.99,0),y=clamp(v.y??0,0,0.99,0);
  const layer={id:text(v.id,uid(),100),type,name:text(v.name,type,100),visible:typeof v.visible==='boolean'?v.visible:true,
    opacity:clamp(v.opacity??1,0,1,1),x,y,w:clamp(v.w??1,0.01,1-x,1-x),h:clamp(v.h??1,0.01,1-y,1-y),
    fit:choice(v.fit,['contain','cover','stretch'],'contain'),mirror:v.mirror===true};
  if(type==='text')Object.assign(layer,{text:text(v.text,'Your title',2000),fontSize:clamp(v.fontSize??52,10,240,52),color:hex(v.color,'#ffffff')});
  if(type==='image')layer.dataUrl=v.dataUrl;return layer;
}
export function defaultProject(){return {version:1,activeSceneId:'scene-main',scenes:[{id:'scene-main',name:'Scene 1',layers:[normalizeLayer({id:'display-main',type:'display',name:'Screen / Window'})]}]};}
export function normalizeProject(value={}) {
  const v=obj(value),seen=new Set(),layerIds=new Set();
  const scenes=(Array.isArray(v.scenes)?v.scenes:[]).slice(0,20).map((scene,i)=>{
    const s=obj(scene);let id=text(s.id,uid(),100);if(!id||seen.has(id))id=uid();seen.add(id);
    const layers=(Array.isArray(s.layers)?s.layers:[]).slice(0,30).map(normalizeLayer).filter(Boolean).map(l=>{if(layerIds.has(l.id))l.id=uid();layerIds.add(l.id);return l;});
    return {id,name:text(s.name,`Scene ${i+1}`,100),layers};
  });
  if(!scenes.length)return defaultProject();return {version:1,scenes,activeSceneId:scenes.some(s=>s.id===v.activeSceneId)?v.activeSceneId:scenes[0].id};
}
