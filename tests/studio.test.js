import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateStudio,MASTER_PRESETS} from '../studio.js';
function config(){return {version:1,edits:{vocal:{trim_start:0,trim_end:4,position:0},backing:{trim_start:0,trim_end:4,position:0}},mix:{genre:'pop',vocal_db:0,backing_db:-6,harmony_db:0},master:{preset:'natural',intensity:'normal'}};}
test('nine master options including unprocessed and eight sound categories',()=>assert.equal(MASTER_PRESETS.length,9));
test('non destructive waveform edit limits',()=>{assert.ok(validateStudio(config()));const a=config();a.edits.vocal.trim_start=5;assert.throws(()=>validateStudio(a));const b=config();b.edits.vocal.position=-1;assert.throws(()=>validateStudio(b));});
test('mix and master reject invalid settings',()=>{const a=config();a.master.preset='unknown';assert.throws(()=>validateStudio(a));const b=config();b.mix.backing_db=-60;assert.throws(()=>validateStudio(b));});

test('touch editor restores trim and project position', async()=>{
 const {mountStudio}=await import('../studio.js');
 const ctx={clearRect(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){},arc(){},fill(){}};
 const ids=['studioRuler','vocalWaveStatus','backingWaveStatus','vocalTrimStart','vocalTrimEnd','vocalPosition','backingTrimStart','backingTrimEnd','backingPosition','vocalWave','backingWave','vocalCurve','backingCurve','studioViewStart','studioZoom','studioGenre','studioAutoMix','studioVocalGain','studioBackingGain','studioHarmony','studioHarmonyInterval','studioHarmonyGain','studioMaster','studioIntensity','studioInputGain','studioLufs','studioPreview','studioStop','studioUndo','studioRedo','studioLoopStart','studioLoopEnd','studioLoop','studioHint','addVocalPoint','addBackingPoint','removeCurvePoint','curveTime','curveDb'];
 const elements=Object.fromEntries(ids.map(id=>[id,{value:0,checked:false,handlers:{},getContext:()=>ctx,replaceChildren(){},append(){},addEventListener(type,fn){this.handlers[type]=fn}}]));
 for(const [id,value] of Object.entries({studioZoom:30,studioGenre:'manual',studioVocalGain:0,studioBackingGain:0,studioHarmonyInterval:7,studioHarmonyGain:-18,studioMaster:'none',studioIntensity:'normal',studioInputGain:0,studioLufs:-14}))elements[id].value=value;
 const prior=globalThis.document;globalThis.document={getElementById:id=>elements[id],createElement:()=>({style:{},className:'',textContent:''})};
 try{const editor=mountStudio();editor.fill({edits:{vocal:{trim_start:1,trim_end:3,position:2}}});
  assert.equal(editor.read().edits.vocal.position,2);
  elements.vocalPosition.value=4;elements.vocalPosition.handlers.change();
  assert.equal(editor.read().edits.vocal.position,4);
  elements.studioUndo.onclick();assert.equal(editor.read().edits.vocal.position,2);
  editor.attachOverview('backing',{duration:3,peaks:[0.1,0.5,0.2]});
  assert.equal(editor.read().edits.backing.trim_end,3);
  editor.fill({});assert.equal(editor.read().edits.vocal.trim_start,0);
 }finally{globalThis.document=prior;}
});

