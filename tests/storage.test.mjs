import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,writeFile,rm,readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../main/storage.mjs';
test('serialized settings and project writes survive a fresh app instance', async () => {
  const dir=await mkdtemp(join(tmpdir(),'clearcapture-store-'));
  try {
    const store=await new Store(dir).init();
    await Promise.all([store.saveSettings({language:'en',width:1280}),store.saveProject({scenes:[{id:'s',name:'Demo',layers:[]}],activeSceneId:'s'})]);
    const fresh=await new Store(dir).init();
    assert.equal(fresh.settings.language,'en'); assert.equal(fresh.settings.width,1280); assert.equal(fresh.project.scenes[0].name,'Demo');
    assert.equal(JSON.parse(await readFile(join(dir,'state.json'),'utf8')).settings.language,'en');
  } finally {await rm(dir,{recursive:true,force:true});}
});
test('corrupt preferences are retained for recovery and replaced with defaults', async () => {
  const dir=await mkdtemp(join(tmpdir(),'clearcapture-corrupt-'));
  try {await writeFile(join(dir,'state.json'),'{oops');const store=await new Store(dir).init();assert.equal(store.settings.fps,30);assert.ok((await readdir(dir)).some(n=>n.startsWith('state.corrupt-')));} finally {await rm(dir,{recursive:true,force:true});}
});
test('restart recovery discovers only bounded app-named WebM partials and persists their status', async()=>{
  const dir=await mkdtemp(join(tmpdir(),'clearcapture-recover-'));
  try{const name='Test_2026-10-11T12-30-00-000Z_1234abcd.partial.webm';await writeFile(join(dir,name),Buffer.from([0x1a,0x45,0xdf,0xa3,0x00]));await writeFile(join(dir,'unrelated.partial.webm'),'personal');await writeFile(join(dir,'Bad_2026-10-11T12-30-00-000Z_87654321.partial.webm'),'not WebM');const store=await new Store(dir).init();await store.recoverPartials(dir);assert.equal(store.recordings.length,1);assert.equal(store.recordings[0].incomplete,true);assert.equal(store.recordings[0].format,'partial');const fresh=await new Store(dir).init();await fresh.recoverPartials(dir);assert.equal(fresh.recordings.length,1);assert.equal(fresh.recordings[0].path,join(dir,name));}finally{await rm(dir,{recursive:true,force:true});}
});
