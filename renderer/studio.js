import {normalizeSettings,normalizeProject,normalizeLayer,uid} from '../shared/model.mjs';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function makeVideo(stream){const video=document.createElement('video');video.muted=true;video.playsInline=true;video.srcObject=stream;return video.play().then(()=>video);}
function stopStream(stream){stream?.getTracks().forEach(t=>t.stop());}
export async function createStudio(canvas){const studio=new Studio(canvas);await studio.init();return studio;}

class Studio {
  constructor(canvas){
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.bridge=window.clearCapture;this.listeners=new Set();this.images=new Map();
    this.status='idle';this.elapsed=0;this.bytes=0;this.countdown=0;this.error='';this.message='';this.sourceId='';this.sourceName='';
    this.captureReady=false;this.cameraReady=false;this.micReady=false;this.selectedLayerId=null;this.meters={system:0,mic:0};
    this.devices={audioInputs:[],videoInputs:[]};this.audioNodes={};this.countdownToken=0;this.disposing=false;
  }
  async init(){
    const data=await this.bridge.load();this.settings=normalizeSettings(data.settings);this.project=normalizeProject(data.project);this.capabilities=data.capabilities;this.recordings=data.recordings;
    this.canvas.width=this.settings.width;this.canvas.height=this.settings.height;this.selectedLayerId=this.scene.layers[0]?.id??null;
    await this.loadImages();await this.refreshDevices();this.restartDrawLoop();
    this.uiTimer=setInterval(()=>{this.updateMeters();this.elapsed=this.recordElapsed();this.emit();
      if(this.status==='recording'&&((this.settings.maxMinutes&&this.elapsed>=this.settings.maxMinutes*60)||(this.settings.maxSizeMB&&this.bytes>=this.settings.maxSizeMB*1024*1024)))this.stop().catch(e=>this.notice(e.message));
    },200);
    this.bridge.onShortcut(action=>{(action==='record'?this.toggleRecording():this.togglePause()).catch(e=>this.notice(e.message));});
    this.bridge.onCloseRequest(async()=>{try{await this.stop();this.dispose();await this.bridge.closeReady();}catch(e){this.notice(e.message);}});
    navigator.mediaDevices.addEventListener('devicechange',()=>this.refreshDevices().catch(e=>this.notice(e.message)));
    window.addEventListener('beforeunload',()=>this.dispose());
  }
  get scene(){return this.project.scenes.find(s=>s.id===this.project.activeSceneId)??this.project.scenes[0];}
  snapshot(){return {settings:this.settings,project:this.project,status:this.status,elapsed:this.elapsed,bytes:this.bytes,countdown:this.countdown,error:this.error,message:this.message,
    selectedLayerId:this.selectedLayerId,sourceId:this.sourceId,sourceName:this.sourceName,meters:{...this.meters},capabilities:this.capabilities,devices:this.devices,recordings:this.recordings,
    cameraReady:this.cameraReady,micReady:this.micReady,captureReady:this.captureReady};}
  subscribe(fn){this.listeners.add(fn);fn(this.snapshot());return ()=>this.listeners.delete(fn);}
  emit(){const state=this.snapshot();for(const fn of this.listeners){try{fn(state);}catch(e){console.error('UI update failed',e);}}}
  notice(message){this.error=String(message);this.emit();}
  clearNotice(){this.error='';this.message='';this.emit();}
  translated(zh,en){return this.settings.language==='zh-CN'?zh:en;}
  ensureIdle(){if(this.status!=='idle')throw new Error(this.translated('请先停止录制','Stop recording first'));}
  guardSceneChange(){if(this.status==='starting')throw new Error(this.translated('请等待设备准备完成','Wait for device preparation to finish'));}
  async refreshSources(){return this.bridge.sources();}
  async refreshDevices(){const devices=await navigator.mediaDevices.enumerateDevices();this.devices={audioInputs:devices.filter(d=>d.kind==='audioinput').map((d,i)=>({deviceId:d.deviceId,label:d.label||`Microphone ${i+1}`})),videoInputs:devices.filter(d=>d.kind==='videoinput').map((d,i)=>({deviceId:d.deviceId,label:d.label||`Camera ${i+1}`}))};this.emit();return this.devices;}
  async ensureAudio(){
    if(!this.audioContext){this.audioContext=new AudioContext({sampleRate:this.settings.sampleRate});this.audioDestination=this.audioContext.createMediaStreamDestination();}
    if(this.audioContext.state==='suspended')await this.audioContext.resume();
  }
  disconnectAudio(kind){const node=this.audioNodes[kind];if(node){node.input.disconnect();node.analyser.disconnect();node.gain.disconnect();delete this.audioNodes[kind];}this.meters[kind]=0;}
  async connectAudio(kind,stream){this.disconnectAudio(kind);if(!stream?.getAudioTracks().length)return;await this.ensureAudio();const input=this.audioContext.createMediaStreamSource(stream),analyser=this.audioContext.createAnalyser(),gain=this.audioContext.createGain();analyser.fftSize=512;input.connect(analyser);analyser.connect(gain);gain.connect(this.audioDestination);this.audioNodes[kind]={input,analyser,gain,buffer:new Float32Array(analyser.fftSize)};this.applyGains();}
  applyGains(){for(const kind of ['system','mic'])if(this.audioNodes[kind])this.audioNodes[kind].gain.gain.setTargetAtTime(this.settings[`${kind}Enabled`]?this.settings[`${kind}Gain`]:0,this.audioContext.currentTime,0.015);}
  updateMeters(){for(const kind of ['system','mic']){const node=this.audioNodes[kind];if(!node||!this.settings[`${kind}Enabled`]){this.meters[kind]=0;continue;}node.analyser.getFloatTimeDomainData(node.buffer);let power=0;for(const sample of node.buffer)power+=sample*sample;this.meters[kind]=Math.min(1,Math.sqrt(power/node.buffer.length)*this.settings[`${kind}Gain`]*3);}}
  async selectSource(id,name=''){
    if(this.sourcePending||this.startPending)throw new Error(this.translated('来源或录制正在准备','Capture or recording is being prepared'));
    this.sourcePending=true;try{return await this.captureSource(id,name);}finally{this.sourcePending=false;}
  }
  async captureSource(id,name=''){
    this.ensureIdle();await this.releaseCapture();await this.bridge.selectSource(id,this.settings.systemEnabled);
    let stream;
    try {stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:this.settings.fps,max:this.settings.fps},cursor:this.settings.showCursor?'always':'never'},audio:this.settings.systemEnabled});
      if(this.settings.systemEnabled&&!stream.getAudioTracks().length)throw new Error(this.translated('所选来源未提供系统声音。可关闭系统声音后重试','The source returned no system audio. Disable system audio or choose another source.'));
      const video=await makeVideo(stream);await stream.getVideoTracks()[0].applyConstraints({advanced:[{cursor:this.settings.showCursor?'always':'never'}]}).catch(()=>{});
      this.displayStream=stream;this.displayVideo=video;this.sourceId=id;this.sourceName=name||id;this.captureReady=true;
      await this.connectAudio('system',stream);stream.getVideoTracks()[0].addEventListener('ended',()=>this.deviceLost('display'));
      this.error='';this.emit();
    }catch(e){stopStream(stream);await this.bridge.cancelGrant();throw e;}
  }
  async releaseCapture(){this.ensureIdle();this.disconnectAudio('system');stopStream(this.displayStream);this.displayStream=null;this.displayVideo=null;this.captureReady=false;this.sourceId='';this.sourceName='';this.emit();}
  async ensureMicrophone(){
    if(this.micReady)return;const device=this.settings.micDeviceId;
    const stream=await navigator.mediaDevices.getUserMedia({audio:{...(device&&device!=='default'?{deviceId:{exact:device}}:{}),sampleRate:{ideal:this.settings.sampleRate},echoCancellation:this.settings.echoCancellation,noiseSuppression:this.settings.noiseSuppression,autoGainControl:this.settings.autoGainControl},video:false});
    try {await this.connectAudio('mic',stream);this.micStream=stream;this.micReady=true;stream.getAudioTracks()[0].addEventListener('ended',()=>this.deviceLost('mic'));await this.refreshDevices();this.emit();}catch(e){stopStream(stream);throw e;}
  }
  async ensureCamera(){
    if(this.cameraReady)return;const device=this.settings.cameraDeviceId;
    const stream=await navigator.mediaDevices.getUserMedia({video:{...(device&&device!=='default'?{deviceId:{exact:device}}:{}),width:{ideal:1280},height:{ideal:720},frameRate:{ideal:this.settings.fps}},audio:false});
    try {this.cameraVideo=await makeVideo(stream);this.cameraStream=stream;this.cameraReady=true;stream.getVideoTracks()[0].addEventListener('ended',()=>this.deviceLost('camera'));await this.refreshDevices();this.emit();}catch(e){stopStream(stream);throw e;}
  }
  async deviceLost(kind){if(this.disposing)return;if(kind==='display'){this.captureReady=false;this.displayVideo=null;this.disconnectAudio('system');}if(kind==='mic'){this.micReady=false;this.disconnectAudio('mic');}if(kind==='camera'){this.cameraReady=false;this.cameraVideo=null;}
    this.notice(this.translated(`${kind==='display'?'屏幕来源':kind==='mic'?'麦克风':'摄像头'}已断开；录制将保存后停止`,`${kind} source disconnected; recording will be saved and stopped.`));
    if(['recording','paused','countdown'].includes(this.status))await this.stop().catch(e=>this.notice(e.message));
  }
  async setSettings(patch){
    const old=this.settings,newSettings=normalizeSettings({...old,...patch});
    const response=await this.bridge.saveSettings(patch);this.settings=response.settings;this.capabilities=response.capabilities;
    if(old.width!==newSettings.width||old.height!==newSettings.height){this.canvas.width=this.settings.width;this.canvas.height=this.settings.height;}
    if(old.fps!==newSettings.fps)this.restartDrawLoop();
    if(old.sampleRate!==newSettings.sampleRate){this.disconnectAudio('system');this.disconnectAudio('mic');await this.audioContext?.close();this.audioContext=null;await this.ensureAudio();await this.connectAudio('system',this.displayStream);if(this.micStream)await this.connectAudio('mic',this.micStream);}
    const micChanged=['micDeviceId','echoCancellation','noiseSuppression','autoGainControl'].some(k=>old[k]!==newSettings[k]);
    if(!newSettings.micEnabled||micChanged){this.disconnectAudio('mic');stopStream(this.micStream);this.micStream=null;this.micReady=false;}
    if(newSettings.micEnabled&&(micChanged||!old.micEnabled))await this.ensureMicrophone();
    if(old.cameraDeviceId!==newSettings.cameraDeviceId&&this.cameraReady){stopStream(this.cameraStream);this.cameraReady=false;await this.ensureCamera();}
    if((old.systemEnabled!==newSettings.systemEnabled||old.showCursor!==newSettings.showCursor||old.fps!==newSettings.fps)&&this.captureReady){const id=this.sourceId,name=this.sourceName;await this.selectSource(id,name);}
    this.applyGains();this.emit();return this.settings;
  }
  async loadImages(){for(const scene of this.project.scenes)for(const layer of scene.layers)if(layer.type==='image'&&!this.images.has(layer.id)){const image=new Image();image.src=layer.dataUrl;await image.decode();this.images.set(layer.id,image);}}
  async saveProject(){this.project=await this.bridge.saveProject(this.project);this.emit();}
  async replaceProject(project){this.ensureIdle();this.project=normalizeProject(project);this.selectedLayerId=this.scene.layers[0]?.id??null;this.images.clear();await this.loadImages();await this.saveProject();}
  async addScene(name){this.guardSceneChange();if(this.project.scenes.length>=20)throw new Error('Maximum 20 scenes');const scene={id:uid(),name:name||`Scene ${this.project.scenes.length+1}`,layers:[]};this.project.scenes.push(scene);await this.activateScene(scene.id);}
  async duplicateScene(){this.guardSceneChange();if(this.project.scenes.length>=20)throw new Error('Maximum 20 scenes');const scene=structuredClone(this.scene);scene.id=uid();scene.name+=' (copy)';scene.layers.forEach(l=>l.id=uid());this.project.scenes.push(scene);await this.loadImages();await this.activateScene(scene.id);}
  async renameScene(id,name){this.guardSceneChange();const scene=this.project.scenes.find(s=>s.id===id);if(scene)scene.name=String(name).slice(0,100)||scene.name;await this.saveProject();}
  async deleteScene(id){this.guardSceneChange();if(this.project.scenes.length<=1)throw new Error(this.translated('至少保留一个场景','Keep at least one scene'));this.project.scenes=this.project.scenes.filter(s=>s.id!==id);if(this.project.activeSceneId===id)this.project.activeSceneId=this.project.scenes[0].id;this.selectedLayerId=this.scene.layers[0]?.id??null;await this.saveProject();}
  async activateScene(id){this.guardSceneChange();if(!this.project.scenes.some(s=>s.id===id))return;this.transitionCanvas=document.createElement('canvas');this.transitionCanvas.width=this.canvas.width;this.transitionCanvas.height=this.canvas.height;this.transitionCanvas.getContext('2d').drawImage(this.canvas,0,0);this.transitionStarted=performance.now();this.project.activeSceneId=id;this.selectedLayerId=this.scene.layers[0]?.id??null;await this.saveProject();}
  async addLayer(type,options={}){
    this.guardSceneChange();if(type==='camera')this.ensureIdle();
    if(this.scene.layers.length>=30)throw new Error('Maximum 30 layers');if(type==='camera')await this.ensureCamera();
    const defaults=type==='camera'?{x:0.71,y:0.66,w:0.26,h:0.3,fit:'cover',mirror:true}:type==='text'?{x:0.06,y:0.08,w:0.7,h:0.18,fontSize:52}:{};
    const layer=normalizeLayer({type,name:type,...defaults,...options});if(!layer)throw new Error('Invalid layer / image');this.scene.layers.push(layer);this.selectedLayerId=layer.id;await this.loadImages();await this.saveProject();return layer;
  }
  selectLayer(id){this.selectedLayerId=id;this.emit();}
  async updateLayer(id,patch){this.guardSceneChange();const index=this.scene.layers.findIndex(l=>l.id===id);if(index<0)return;const layer=normalizeLayer({...this.scene.layers[index],...patch,id,type:this.scene.layers[index].type});if(!layer)throw new Error('Invalid layer');this.scene.layers[index]=layer;await this.saveProject();}
  async removeLayer(id){this.guardSceneChange();this.scene.layers=this.scene.layers.filter(l=>l.id!==id);this.images.delete(id);this.selectedLayerId=this.scene.layers.at(-1)?.id??null;if(!this.project.scenes.some(s=>s.layers.some(l=>l.type==='camera'))){stopStream(this.cameraStream);this.cameraReady=false;this.cameraVideo=null;}await this.saveProject();}
  async moveLayer(id,delta){this.guardSceneChange();const index=this.scene.layers.findIndex(l=>l.id===id),target=index+Math.sign(delta);if(index<0||target<0||target>=this.scene.layers.length)return;[this.scene.layers[index],this.scene.layers[target]]=[this.scene.layers[target],this.scene.layers[index]];await this.saveProject();}
  restartDrawLoop(){clearInterval(this.drawTimer);this.drawTimer=setInterval(()=>this.draw(),1000/this.settings.fps);this.draw();}
  drawMedia(media,layer){
    const {width:W,height:H}=this.canvas,ctx=this.ctx,x=layer.x*W,y=layer.y*H,w=layer.w*W,h=layer.h*H;
    const mw=media.videoWidth||media.naturalWidth,mh=media.videoHeight||media.naturalHeight;if(!mw||!mh)return;
    ctx.save();ctx.globalAlpha=layer.opacity;ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
    if(layer.mirror){ctx.translate(x+w,y);ctx.scale(-1,1);}else ctx.translate(x,y);
    let dw=w,dh=h,dx=0,dy=0;if(layer.fit!=='stretch'){const scale=layer.fit==='cover'?Math.max(w/mw,h/mh):Math.min(w/mw,h/mh);dw=mw*scale;dh=mh*scale;dx=(w-dw)/2;dy=(h-dh)/2;}
    ctx.drawImage(media,dx,dy,dw,dh);ctx.restore();
  }
  draw(){
    const ctx=this.ctx,{width:W,height:H}=this.canvas;ctx.fillStyle=this.settings.backgroundColor;ctx.fillRect(0,0,W,H);
    for(const layer of this.scene.layers){if(!layer.visible||!layer.opacity)continue;
      const media=layer.type==='display'?this.displayVideo:layer.type==='camera'?this.cameraVideo:layer.type==='image'?this.images.get(layer.id):null;
      if(media){this.drawMedia(media,layer);continue;}
      if(layer.type==='text'){ctx.save();ctx.globalAlpha=layer.opacity;ctx.fillStyle=layer.color;ctx.font=`600 ${layer.fontSize}px "Segoe UI", sans-serif`;ctx.textBaseline='top';ctx.beginPath();ctx.rect(layer.x*W,layer.y*H,layer.w*W,layer.h*H);ctx.clip();let y=layer.y*H;for(const line of layer.text.split('\n')){ctx.fillText(line,layer.x*W,y,layer.w*W);y+=layer.fontSize*1.25;}ctx.restore();}
    }
    if(this.transitionCanvas){const fraction=(performance.now()-this.transitionStarted)/Math.max(1,this.settings.transitionMs);if(fraction>=1)this.transitionCanvas=null;else{ctx.save();ctx.globalAlpha=1-fraction;ctx.drawImage(this.transitionCanvas,0,0,W,H);ctx.restore();}}
  }
  recordElapsed(){if(['recording','paused'].includes(this.status)){const until=this.status==='paused'?this.pauseStarted:performance.now();return Math.max(0,(until-this.startedAt-this.pausedMs)/1000);}return this.elapsed;}
  async start(){
    if(this.startPending||this.sourcePending)throw new Error(this.translated('录制或来源正在启动','Recording or capture is starting'));
    this.ensureIdle();this.startPending=true;const token=++this.countdownToken;
    this.status='starting';this.countdown=0;this.emit();
    try{await this.bridge.setBusy(true);return await this.beginRecording(token);}
    catch(e){if(!this.sessionId){this.status='idle';await this.bridge.setBusy(false);this.emit();}throw e;}
    finally{this.startPending=false;}
  }
  async beginRecording(token){
    this.error='';this.message='';this.bytes=0;this.elapsed=0;
    if(this.scene.layers.some(l=>l.visible&&l.type==='display')&&!this.captureReady)throw new Error(this.translated('请先选择屏幕或窗口','Choose a screen or window first'));
    if(this.settings.systemEnabled&&!this.displayStream?.getAudioTracks().length)throw new Error(this.translated('系统声音需要选择屏幕或窗口','System audio needs an active screen/window source'));
    if(this.settings.micEnabled)await this.ensureMicrophone();
    if(token!==this.countdownToken)return;
    if(this.project.scenes.some(s=>s.layers.some(l=>l.visible&&l.type==='camera')))await this.ensureCamera();
    if(token!==this.countdownToken)return;
    await this.ensureAudio();if(token!==this.countdownToken)return;this.status='countdown';this.emit();
    for(let i=this.settings.countdownSeconds;i>0;i--){this.countdown=i;this.emit();await sleep(1000);if(token!==this.countdownToken)return;}
    this.countdown=0;
    let session;
    try {
      const desired=this.settings.codec==='auto'?['vp9','vp8']:[this.settings.codec];const audio=this.settings.systemEnabled||this.settings.micEnabled;
      const mime=desired.map(codec=>`video/webm;codecs=${codec}${audio?',opus':''}`).find(type=>MediaRecorder.isTypeSupported(type));
      if(!mime)throw new Error(this.translated('当前环境不支持所选编码器','The selected video codec is unavailable'));
      this.canvasStream=this.canvas.captureStream(this.settings.fps);this.outputStream=new MediaStream([...this.canvasStream.getVideoTracks(),...(audio?this.audioDestination.stream.getAudioTracks():[])]);
      this.recorder=new MediaRecorder(this.outputStream,{mimeType:mime,videoBitsPerSecond:Math.round(this.settings.videoBitrateMbps*1000000),audioBitsPerSecond:this.settings.audioBitrateKbps*1000});
      session=await this.bridge.recordBegin();this.sessionId=session.id;this.chunkSequence=0;this.pendingBytes=0;this.chunkChain=Promise.resolve();this.recordError=null;
      this.done=new Promise((resolve,reject)=>{this.resolveDone=resolve;this.rejectDone=reject;});this.done.catch(()=>{});
      this.recorder.ondataavailable=event=>{
        if(!event.data.size)return;const blob=event.data,sequence=this.chunkSequence++;this.pendingBytes+=blob.size;this.bytes+=blob.size;
        this.chunkChain=this.chunkChain.then(async()=>{const data=await blob.arrayBuffer();await this.bridge.recordWrite(this.sessionId,sequence,data);this.pendingBytes-=blob.size;});
        this.chunkChain.catch(error=>{this.recordError??=error;if(this.recorder?.state!=='inactive')this.stop().catch(()=>{});});
        if(this.pendingBytes>64*1024*1024){this.recordError=new Error(this.translated('磁盘写入跟不上录制，请降低码率','Disk writes are too slow; reduce recording bitrate'));this.stop().catch(()=>{});}
      };
      this.recorder.onerror=event=>{this.recordError=event.error||new Error('Media recorder failed');this.stop().catch(()=>{});};
      this.recorder.onstop=()=>this.finalizeRecording();this.startedAt=performance.now();this.pausedMs=0;this.recorder.start(1000);this.status='recording';this.emit();
      if(this.settings.autoMinimize)await this.bridge.minimize();
    }catch(e){if(session)await this.bridge.recordAbort(session.id).catch(()=>{});stopStream(this.canvasStream);this.status='idle';await this.bridge.setBusy(false);this.emit();throw e;}
  }
  async finalizeRecording(){
    try {await this.chunkChain;if(this.recordError)throw this.recordError;const result=await this.bridge.recordFinish(this.sessionId,this.elapsed);this.message=result.warning||this.translated(`已保存：${result.name}`,`Saved: ${result.name}`);this.recordings=await this.bridge.recordings();this.resolveDone(result);}
    catch(e){const partial=await this.bridge.recordAbort(this.sessionId).catch(()=>null);this.error=e.message+(partial?.size?this.translated(`；可恢复的部分文件：${partial.partial}`,`; recoverable partial file: ${partial.partial}`):'');this.recordings=await this.bridge.recordings().catch(()=>this.recordings);this.rejectDone(e);}
    finally{stopStream(this.canvasStream);this.canvasStream=null;this.recorder=null;this.sessionId=null;this.status='idle';await this.bridge.setBusy(false);this.emit();}
  }
  async stop(){
    if(['starting','countdown'].includes(this.status)){this.countdownToken++;this.countdown=0;this.status='idle';await this.bridge.setBusy(false);this.emit();return;}
    if(this.status==='stopping')return this.done;if(!['recording','paused'].includes(this.status))return;
    this.elapsed=this.recordElapsed();this.status='stopping';this.emit();if(this.recorder.state!=='inactive')this.recorder.stop();return this.done;
  }
  pause(){if(this.status!=='recording')return;this.elapsed=this.recordElapsed();this.pauseStarted=performance.now();this.recorder.pause();this.status='paused';this.emit();}
  resume(){if(this.status!=='paused')return;this.pausedMs+=performance.now()-this.pauseStarted;this.recorder.resume();this.status='recording';this.emit();}
  async toggleRecording(){if(this.status==='idle')return this.start();return this.stop();}
  async togglePause(){if(this.status==='recording')this.pause();else if(this.status==='paused')this.resume();}
  async refreshRecordings(){this.recordings=await this.bridge.recordings();this.emit();return this.recordings;}
  dispose(){this.disposing=true;clearInterval(this.drawTimer);clearInterval(this.uiTimer);stopStream(this.displayStream);stopStream(this.cameraStream);stopStream(this.micStream);this.audioContext?.close();}
}
