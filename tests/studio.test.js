import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateStudio,MASTER_PRESETS} from '../studio.js';
function config(){return {version:1,edits:{vocal:{trim_start:0,trim_end:4,position:0},backing:{trim_start:0,trim_end:4,position:0}},mix:{genre:'pop',vocal_db:0,backing_db:-6,harmony_db:0},master:{preset:'natural',intensity:'normal'}};}
test('nine master options including unprocessed and eight sound categories',()=>assert.equal(MASTER_PRESETS.length,9));
test('non destructive waveform edit limits',()=>{assert.ok(validateStudio(config()));const a=config();a.edits.vocal.trim_start=5;assert.throws(()=>validateStudio(a));const b=config();b.edits.vocal.position=-1;assert.throws(()=>validateStudio(b));});
test('mix and master reject invalid settings',()=>{const a=config();a.master.preset='unknown';assert.throws(()=>validateStudio(a));const b=config();b.mix.backing_db=-60;assert.throws(()=>validateStudio(b));});
