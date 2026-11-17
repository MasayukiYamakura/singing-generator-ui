import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateGuide,readGuide,fillGuide} from '../guide.js';

test('AI guide is opt-in and rejects invalid transpose and processing choices',()=>{
 const input={version:1,enabled:true,transpose:-7,pitch:true,dynamics:'gentle',noise:'auto'};
 assert.deepEqual(validateGuide(input),input);
 assert.throws(()=>validateGuide({...input,transpose:-13}));
 assert.throws(()=>validateGuide({...input,noise:'strong'}));
});

test('three-source controls restore saved project settings',()=>{
 const ids=['guideEnabled','guideTranspose','guidePitch','guideDynamics','guideNoise'];
 const elements=Object.fromEntries(ids.map(id=>[id,{value:'',checked:false}]));
 const before=globalThis.document;globalThis.document={getElementById:id=>elements[id]};
 try{
  fillGuide({enabled:true,transpose:-7,pitch:true,dynamics:'standard',noise:'on'});
  assert.deepEqual(readGuide(),{version:1,enabled:true,transpose:-7,pitch:true,dynamics:'standard',noise:'on'});
  fillGuide({});assert.equal(readGuide().enabled,false);
 }finally{globalThis.document=before;}
});
