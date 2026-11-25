import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateStudio,MASTER_PRESETS,trimLeft} from '../studio.js';
function config(){return {version:1,edits:{vocal:{trim_start:0,trim_end:4,position:0},backing:{trim_start:0,trim_end:4,position:0}},mix:{genre:'pop',vocal_db:0,backing_db:-6,harmony_db:0},master:{preset:'natural',intensity:'normal'}};}
test('nine master options including unprocessed and eight sound categories',()=>assert.equal(MASTER_PRESETS.length,9));
test('non destructive waveform edit limits',()=>{assert.ok(validateStudio(config()));const a=config();a.edits.vocal.trim_start=5;assert.throws(()=>validateStudio(a));const b=config();b.edits.vocal.position=-1;assert.throws(()=>validateStudio(b));});
test('mix and master reject invalid settings',()=>{const a=config();a.master.preset='unknown';assert.throws(()=>validateStudio(a));const b=config();b.mix.backing_db=-60;assert.throws(()=>validateStudio(b));});
test('left trim keeps the same source time at the placed edge',()=>{const e={trim_start:1,trim_end:9,position:2};assert.deepEqual(trimLeft(e,1.25),{...e,trim_start:1.25,position:2.25});assert.deepEqual(trimLeft(e,-10),{...e,trim_start:0,position:1});assert.equal(trimLeft({trim_start:3,trim_end:8,position:0},1).trim_start,3);});

test('touch editor restores trim and project position', async()=>{
 const {mountStudio}=await import('../studio.js');
 const ctx={clearRect(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){},arc(){},fill(){}};
 const ids=['studioRuler','studioOverview','studioPlayheadTime','studioSelectedName','vocalInspector','backingInspector','studioMuteVocal','studioMuteBacking','studioSoloVocal','studioSoloBacking','vocalWaveStatus','backingWaveStatus','vocalTrimStart','vocalTrimEnd','vocalPosition','backingTrimStart','backingTrimEnd','backingPosition','vocalWave','backingWave','vocalCurve','backingCurve','studioViewStart','studioZoom','studioTrack','studioGenre','studioAutoMix','studioVocalGain','studioBackingGain','studioHarmony','studioHarmonyInterval','studioHarmonyGain','studioMaster','studioIntensity','studioInputGain','studioLufs','studioPreview','studioStop','studioUndo','studioRedo','studioLoopStart','studioLoopEnd','studioLoop','studioHint','addVocalPoint','addBackingPoint','removeCurvePoint','curveTime','curveDb'];
 const elements=Object.fromEntries(ids.map(id=>[id,{value:0,checked:false,width:900,height:115,handlers:{},getContext:()=>ctx,setAttribute(){},replaceChildren(){},append(){},addEventListener(type,fn){this.handlers[type]=fn}}]));
 for(const [id,value] of Object.entries({studioZoom:30,studioGenre:'manual',studioVocalGain:0,studioBackingGain:0,studioHarmonyInterval:7,studioHarmonyGain:-18,studioMaster:'none',studioIntensity:'normal',studioInputGain:0,studioLufs:-14}))elements[id].value=value;
 const prior=globalThis.document,priorAudio=globalThis.AudioContext,gains=[];
 globalThis.document={getElementById:id=>elements[id],querySelector:()=>null,createElement:()=>({style:{},className:'',textContent:''})};
 globalThis.AudioContext=class{currentTime=0;destination={};async resume(){}async decodeAudioData(){return {duration:2,getChannelData:()=>new Float32Array(48000)}}createBufferSource(){return {connect(){return this},start(){},stop(){}}}createGain(){const gain={gain:{value:1},connect(){return this}};gains.push(gain);return gain}};
 try{const editor=mountStudio();editor.fill({edits:{vocal:{trim_start:1,trim_end:3,position:2}}});
  assert.equal(editor.read().edits.vocal.position,2);
  elements.vocalPosition.value=4;elements.vocalPosition.handlers.change();
  assert.equal(editor.read().edits.vocal.position,4);
  elements.studioUndo.onclick();assert.equal(editor.read().edits.vocal.position,2);
  elements.vocalTrimStart.value=1.5;elements.vocalTrimStart.handlers.change();
  assert.equal(editor.read().edits.vocal.position,2.5);
  editor.attachOverview('backing',{duration:3,peaks:[0.1,0.5,0.2]});
  assert.equal(editor.read().edits.backing.trim_end,3);
  elements.studioMuteVocal.checked=true;elements.studioMuteVocal.handlers.change();
  assert.equal('mute' in editor.read(),false);
  editor.fill({});assert.equal(editor.read().edits.vocal.trim_start,0);
  assert.equal(elements.studioMuteVocal.checked,false);
  await editor.attach('vocal',{arrayBuffer:async()=>new ArrayBuffer(4)});
  await editor.attach('backing',{arrayBuffer:async()=>new ArrayBuffer(4)});
  elements.studioLoopStart.value=0;elements.studioLoopEnd.value=1;
  await editor.preview();assert.deepEqual(gains.map(g=>g.gain.value),[.7,.7]);
  elements.studioMuteVocal.checked=true;elements.studioMuteVocal.handlers.change();
  assert.deepEqual(gains.map(g=>g.gain.value),[0,.7]);
  elements.studioSoloVocal.checked=true;elements.studioSoloVocal.handlers.change();
  assert.deepEqual(gains.map(g=>g.gain.value),[0,0]);
  elements.studioMuteVocal.checked=false;elements.studioMuteVocal.handlers.change();
  assert.deepEqual(gains.map(g=>g.gain.value),[.7,0]);
  editor.stop();
 }finally{globalThis.document=prior;globalThis.AudioContext=priorAudio;}
});


