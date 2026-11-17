import {test} from 'node:test';
import assert from 'node:assert/strict';
import {adoptSeparated} from '../separation.js';

test('saved stems become guide and accompaniment without replacing personal vocal',()=>{
 const p='a'.repeat(32), id='b'.repeat(32), prefix=`singing-generator/outputs/${p}/${id}/`;
 const asset=name=>({type:'authenticated',format:'wav',public_id:prefix+name});
 const result={operation:'separate',storage:'saved',sources:{reference:asset('separated_vocal'),backing:asset('separated_backing')}};
 const own={public_id:'personal',type:'authenticated',format:'wav'};
 assert.deepEqual(adoptSeparated(result,p,{vocal:own}),{vocal:own,...result.sources});
 assert.throws(()=>adoptSeparated({...result,storage:'deleted'},p,{}));
 assert.throws(()=>adoptSeparated(result,'c'.repeat(32),{}));
});
