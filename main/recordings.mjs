import {mkdir,open,rename,stat,unlink} from 'node:fs/promises';
import {join,basename} from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {normalizeSettings} from '../shared/model.mjs';
export function runFFmpeg(executable,args,timeout=20*60*1000){return new Promise((resolve,reject)=>{
  const process=spawn(executable,args,{windowsHide:true,stdio:['ignore','ignore','pipe']});let tail='';
  process.stderr.on('data',d=>{tail=(tail+d.toString()).slice(-6000);});
  const timer=setTimeout(()=>{process.kill();reject(new Error('FFmpeg conversion timed out'));},timeout);
  process.once('error',e=>{clearTimeout(timer);reject(e);});process.once('exit',code=>{clearTimeout(timer);code===0?resolve(tail):reject(new Error(`FFmpeg exited ${code}: ${tail.slice(-1200)}`));});
});}
export class RecordingWriter {
  constructor(){this.active=null;this.opening=false;this.failed=null;}
  async begin(options){
    if(this.active||this.opening)throw new Error('A recording is already active');this.opening=true;
    try {const settings=normalizeSettings(options);if(!settings.outputDirectory)throw new Error('Output directory is required');
      await mkdir(settings.outputDirectory,{recursive:true});const id=randomUUID(),stamp=new Date().toISOString().replace(/[:.]/g,'-');
      const path=join(settings.outputDirectory,`${settings.filenamePrefix}_${stamp}_${id.slice(0,8)}.webm`),partial=path.replace(/\.webm$/,'.partial.webm');
      const handle=await open(partial,'wx');this.active={id,settings,path,partial,handle,queue:Promise.resolve(),sequence:0,bytes:0,error:null,finishing:false};return {id,path,partial};
    }finally{this.opening=false;}
  }
  session(id){if(!this.active||this.active.id!==id)throw new Error('Unknown recording session');return this.active;}
  async append(id,sequence,data){
    const s=this.session(id);if(s.finishing)throw new Error('Session is finalizing');if(sequence!==s.sequence)throw new Error('Invalid chunk sequence');
    if(!(data instanceof Uint8Array)||!data.byteLength||data.byteLength>32*1024*1024)throw new Error('Invalid recording chunk');
    s.sequence++;const buffer=Buffer.from(data);const task=s.queue.then(async()=>{if(s.error)throw s.error;let offset=0;while(offset<buffer.length){const {bytesWritten}=await s.handle.write(buffer,offset,buffer.length-offset,null);if(!bytesWritten)throw new Error('Recording write made no progress');offset+=bytesWritten;}s.bytes+=buffer.length;return {bytes:s.bytes};});
    s.queue=task.catch(e=>{s.error=e;throw e;});s.queue.catch(()=>{});return task;
  }
  async finish(id,{duration=0,ffmpegPath=''}={}){
    const s=this.session(id);if(s.finishing)throw new Error('Session is already finalizing');s.finishing=true;
    try {await s.queue;if(s.error)throw s.error;await s.handle.sync();await s.handle.close();s.handle=null;if(s.bytes===0)throw new Error('Recording has no media data');
      let resultPath=s.path,warning='',format='webm';
      if(s.settings.container==='webm'&&ffmpegPath){
        const indexed=s.path.replace(/\.webm$/,'.indexing.webm');
        try {await runFFmpeg(ffmpegPath,['-nostdin','-hide_banner','-loglevel','error','-n','-i',s.partial,'-c','copy','-f','webm',indexed]);await rename(indexed,s.path);await unlink(s.partial).catch(()=>{});}
        catch(e){await rename(s.partial,s.path);warning=`WebM saved without a seek index. ${e.message}`;}
      }else await rename(s.partial,s.path);
      if(s.settings.container==='mp4'){
        const target=s.path.replace(/\.webm$/,'.mp4'),partial=target.replace(/\.mp4$/,'.partial.mp4');
        try {if(!ffmpegPath)throw new Error('FFmpeg is unavailable');await runFFmpeg(ffmpegPath,['-nostdin','-hide_banner','-loglevel','error','-n','-i',s.path,'-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a',`${s.settings.audioBitrateKbps}k`,'-movflags','+faststart','-f','mp4',partial]);await rename(partial,target);resultPath=target;format='mp4';}
        catch(e){warning=`MP4 conversion failed; original WebM preserved. ${e.message}`;}
      }
      return {id:s.id,path:resultPath,name:basename(resultPath),size:(await stat(resultPath)).size,duration:Number.isFinite(duration)?Math.max(0,duration):0,createdAt:new Date().toISOString(),format,warning,originalPath:s.path};
    }catch(error){this.failed={id:s.id,partial:s.partial,size:await stat(s.partial).then(s=>s.size).catch(()=>0)};throw error;}
    finally {if(s.handle)await s.handle.close().catch(()=>{});this.active=null;}
  }
  async abort(id){if(!this.active&&this.failed?.id===id)return this.failed;const s=this.session(id);s.finishing=true;await s.queue.catch(()=>{});if(s.handle)await s.handle.close().catch(()=>{});this.active=null;this.failed={id:s.id,partial:s.partial,size:await stat(s.partial).then(s=>s.size).catch(()=>0)};return this.failed;}
}
