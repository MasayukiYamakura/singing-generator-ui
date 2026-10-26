import {test} from 'node:test';import assert from 'node:assert/strict';
import {validateSettings,fileCheck,safeRepo,encodeJSON,decodeJSON,GitHub} from '../core.js';
test('Japanese JSON roundtrip',()=>assert.deepEqual(decodeJSON(encodeJSON({title:'歌声'})),{title:'歌声'}));
test('settings constraints',()=>{const s={key:0,scale:'major',strength:'standard',offset_seconds:0,balance:.55,notes:[]};assert.equal(validateSettings(s),s);assert.throws(()=>validateSettings({...s,key:12}));assert.throws(()=>validateSettings({...s,notes:[{start:2,end:1,midi:60}]}));});
test('file and repository guard',()=>{assert.throws(()=>fileCheck({name:'x.wav',size:101*1024*1024}));assert.throws(()=>safeRepo('a/b?token=x'));assert.equal(safeRepo('a/b'),'a/b');});
test('GitHub authentication stays in headers and fetch is called unbound',async()=>{let seen;globalThis.fetch=async(url,options)=>{seen={url,options};return {ok:true,status:204}};await new GitHub('a/b','test-secret').dispatch('project','request');assert.ok(!seen.url.includes('test-secret'));assert.equal(seen.options.headers.Authorization,'Bearer test-secret');assert.equal(JSON.parse(seen.options.body).inputs.request,'request');});
