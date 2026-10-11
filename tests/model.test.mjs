import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSettings, normalizeProject, defaultProject, normalizeLayer } from '../shared/model.mjs';

test('unsafe and malformed settings become bounded usable preferences', () => {
  const s = normalizeSettings({width:99999,height:-1,fps:NaN,systemGain:99,micGain:-9,filenamePrefix:'../bad:*name',language:'xx',maxMinutes:Infinity,container:'exe'});
  assert.equal(s.width,3840); assert.equal(s.height,320); assert.equal(s.fps,30);
  assert.equal(s.systemGain,2); assert.equal(s.micGain,0); assert.equal(s.filenamePrefix,'badname');
  assert.equal(s.language,'zh-CN'); assert.equal(s.maxMinutes,0); assert.equal(s.container,'webm');
});
test('saved scene preserves explicit hidden layers and constrains geometry', () => {
  const layer = normalizeLayer({type:'text',text:'A title',visible:false,x:0.95,w:0.8,h:0.2,y:-4,opacity:5});
  assert.equal(layer.visible,false); assert.equal(layer.x,0.95); assert.ok(Math.abs(layer.w-0.05)<0.0001); assert.equal(layer.y,0); assert.equal(layer.opacity,1);
});
test('invalid scene files always retain one scene and valid active identity', () => {
  const p = normalizeProject({scenes:[],activeSceneId:'missing'});
  assert.equal(p.scenes.length,1); assert.equal(p.activeSceneId,p.scenes[0].id);
  const q = normalizeProject({scenes:[{id:'a',layers:[]},{id:'a',layers:[]}],activeSceneId:'a'});
  assert.notEqual(q.scenes[0].id,q.scenes[1].id);
});
test('untrusted image URL and unknown layers never become executable resources', () => {
  const p = normalizeProject({scenes:[{id:'s',layers:[{type:'image',dataUrl:'https://remote/a.png'},{type:'script',text:'evil'}]}]});
  assert.equal(p.scenes[0].layers.length,0);
  assert.equal(defaultProject().scenes[0].layers[0].type,'display');
});
