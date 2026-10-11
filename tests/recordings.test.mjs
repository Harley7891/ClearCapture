import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,rm,readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RecordingWriter } from '../main/recordings.mjs';
test('concurrent chunks are ordered and finalize only after the last write', async () => {
  const dir=await mkdtemp(join(tmpdir(),'clearcapture-rec-'));
  try {
    const writer=new RecordingWriter();const {id}=await writer.begin({outputDirectory:dir,filenamePrefix:'Test',container:'webm'});
    await Promise.all([writer.append(id,0,new Uint8Array([1,2])),writer.append(id,1,new Uint8Array([3,4]))]);
    const result=await writer.finish(id,{duration:2});
    assert.deepEqual([...await readFile(result.path)],[1,2,3,4]);assert.equal(result.size,4);assert.equal(result.duration,2);assert.equal(result.format,'webm');
    assert.ok(!(await readdir(dir)).some(n=>n.endsWith('.partial.webm')));
  } finally {await rm(dir,{recursive:true,force:true});}
});
test('duplicate/out-of-order chunks reject and abort preserves partial data', async () => {
  const dir=await mkdtemp(join(tmpdir(),'clearcapture-abort-'));
  try {const w=new RecordingWriter();const {id}=await w.begin({outputDirectory:dir,filenamePrefix:'Test'});await w.append(id,0,new Uint8Array([7]));await assert.rejects(w.append(id,0,new Uint8Array([8])),/sequence/i);await w.abort(id);assert.deepEqual([...await readFile(join(dir,(await readdir(dir))[0]))],[7]);} finally {await rm(dir,{recursive:true,force:true});}
});
test('unknown session cannot append and an active recording cannot be overwritten', async () => {
  const dir=await mkdtemp(join(tmpdir(),'clearcapture-overlap-'));
  try {const w=new RecordingWriter();const {id}=await w.begin({outputDirectory:dir,filenamePrefix:'Test'});await assert.rejects(w.begin({outputDirectory:dir}),/active/i);await assert.rejects(w.append('unknown',0,new Uint8Array([1])),/session/i);await w.abort(id);} finally {await rm(dir,{recursive:true,force:true});}
});
test('failed MP4 conversion keeps the complete original with a reported warning', async () => {
  const dir=await mkdtemp(join(tmpdir(),'clearcapture-convert-'));
  try {const w=new RecordingWriter();const {id}=await w.begin({outputDirectory:dir,filenamePrefix:'Test',container:'mp4'});await w.append(id,0,new Uint8Array([1,2,3]));const r=await w.finish(id,{duration:1,ffmpegPath:join(dir,'missing-ffmpeg.exe')});assert.equal(r.format,'webm');assert.match(r.warning,/MP4/);assert.deepEqual([...await readFile(r.path)],[1,2,3]);} finally {await rm(dir,{recursive:true,force:true});}
});
test('a real write failure retains completed bytes and exposes recovery even after failed finish',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'clearcapture-writefailure-'));
  try{const w=new RecordingWriter(),{id}=await w.begin({outputDirectory:dir,filenamePrefix:'Test'});const data=new Uint8Array([0x1a,0x45,0xdf,0xa3,7]);await w.append(id,0,data);await w.active.handle.close();await assert.rejects(w.append(id,1,new Uint8Array([9])));await assert.rejects(w.finish(id));const partial=await w.abort(id);assert.equal(partial.size,5);assert.deepEqual([...await readFile(partial.partial)],[...data]);assert.equal(w.active,null);}finally{await rm(dir,{recursive:true,force:true});}
});
