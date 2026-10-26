import {test} from 'node:test';import assert from 'node:assert/strict';
import {parseMidi,melodyNotes} from '../midi.js';import {validatePhrases} from '../phrases.js';
const bytes=s=>Array.from(new TextEncoder().encode(s));
const u32=n=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255];
const track=data=>[...bytes('MTrk'),...u32(data.length),...data];
function midi(tracks){return new Uint8Array([...bytes('MThd'),0,0,0,6,0,1,0,tracks.length,1,224,...tracks.flatMap(track)]).buffer;}
test('MIDI tempo changes and track selection',()=>{const tempo=[0,255,81,3,7,161,32,131,96,255,81,3,15,66,64,0,255,47,0];const melody=[0,144,60,100,131,96,128,60,0,0,144,62,100,131,96,128,62,0,0,255,47,0];const result=parseMidi(midi([tempo,melody]));assert.equal(result.length,1);assert.equal(result[0].index,1);assert.deepEqual(result[0].notes,[{start:0,end:.5,midi:60},{start:.5,end:1.5,midi:62}]);assert.equal(melodyNotes(result[0].notes,-7)[0].midi,53);});
test('MIDI running status and invalid/polyphonic rejection',()=>{const melody=[0,144,60,100,131,96,60,0,0,255,47,0];assert.equal(parseMidi(midi([melody]))[0].notes[0].end,.5);assert.throws(()=>parseMidi(new Uint8Array([1,2,3]).buffer));assert.throws(()=>melodyNotes([{start:0,end:2,midi:60},{start:1,end:3,midi:64}]));});
test('phrase edits reject destination overlap and support off',()=>{const plan=[{id:'a',start:0,end:1,strength:'off',shift_ms:0,stretch:1},{id:'b',start:1,end:2,strength:'strong',shift_ms:0,stretch:1}];assert.equal(validatePhrases(plan),plan);assert.throws(()=>validatePhrases([{...plan[0],shift_ms:100},plan[1]]));assert.throws(()=>validatePhrases([{...plan[0],stretch:1.2}]));});

test('hard mode, manual take and grid candidates',async()=>{const {gridSuggestions,presets}=await import('../mixing.js');const plan=[{id:'one',start:.12,end:.8,strength:'hard',shift_ms:0,stretch:1,take_id:'take3'}];assert.equal(validatePhrases(plan),plan);const q=gridSuggestions(plan,120,8);assert.equal(q[0].shift_ms,-120);assert.equal(q[0].take_id,'take3');assert.throws(()=>gridSuggestions(plan,0));assert.equal(presets.robotic.strength,'hard');assert.ok(presets.pop.effects.doubler>0);});
