import {mkdir,readFile,writeFile,rename,stat,readdir,open} from 'node:fs/promises';
import {join} from 'node:path';
import {normalizeSettings,normalizeProject} from '../shared/model.mjs';
export class Store {
  constructor(directory){this.directory=directory;this.path=join(directory,'state.json');this.queue=Promise.resolve();this.settings=normalizeSettings();this.project=normalizeProject();this.recordings=[];}
  async init(){
    await mkdir(this.directory,{recursive:true});
    try {
      if((await stat(this.path)).size>24*1024*1024)throw new Error('Preferences exceed size limit');
      const state=JSON.parse(await readFile(this.path,'utf8'));this.settings=normalizeSettings(state.settings);this.project=normalizeProject(state.project);
      this.recordings=(Array.isArray(state.recordings)?state.recordings:[]).filter(r=>typeof r.id==='string'&&typeof r.path==='string').slice(0,500);
    }catch(e){if(e.code!=='ENOENT')await rename(this.path,join(this.directory,`state.corrupt-${Date.now()}.json`)).catch(()=>{});}
    return this;
  }
  persist(){const task=this.queue.catch(()=>{}).then(async()=>{const data=JSON.stringify({version:1,settings:this.settings,project:this.project,recordings:this.recordings},null,2);const tmp=this.path+'.tmp';await writeFile(tmp,data,'utf8');await rename(tmp,this.path);});this.queue=task;return task;}
  async saveSettings(patch){this.settings=normalizeSettings({...this.settings,...patch});await this.persist();return this.settings;}
  async saveProject(project){this.project=normalizeProject(project);await this.persist();return this.project;}
  async addRecording(recording){this.recordings=[recording,...this.recordings].slice(0,500);await this.persist();return recording;}
  async recoverPartials(directory){
    const names=await readdir(directory).catch(()=>[]);let changed=false;
    for(const name of names.filter(n=>/_\d{4}-\d{2}-\d{2}T[\d-]+Z_[0-9a-f]{8}\.partial\.webm$/.test(n)).slice(0,50)){
      const path=join(directory,name);if(this.recordings.some(r=>r.path===path))continue;
      let handle;try{const info=await stat(path);if(info.size<4||!info.isFile())continue;handle=await open(path,'r');const signature=Buffer.alloc(4);await handle.read(signature,0,4,0);if(signature.toString('hex')!=='1a45dfa3')continue;
        this.recordings.unshift({id:`recovered:${name}`,path,name,size:info.size,duration:0,createdAt:info.mtime.toISOString(),format:'partial',incomplete:true});changed=true;
      }catch{}finally{await handle?.close().catch(()=>{});}
    }
    if(changed){this.recordings=this.recordings.slice(0,500);await this.persist();}return this.recordings;
  }
  async listRecordings(){const results=await Promise.all(this.recordings.map(async r=>{try{const s=await stat(r.path);return {...r,size:s.size,missing:false};}catch{return {...r,missing:true};}}));return results;}
  recording(id){const r=this.recordings.find(r=>r.id===id);if(!r)throw new Error('Unknown recording');return r;}
}
