export const uuid=()=>crypto.randomUUID().replaceAll('-','');
export const bytes64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s)};
export const from64=s=>Uint8Array.from(atob(s.replace(/\s/g,'')),c=>c.charCodeAt(0));
export const encodeJSON=x=>bytes64(new TextEncoder().encode(JSON.stringify(x,null,2)));
export const decodeJSON=s=>JSON.parse(new TextDecoder().decode(from64(s)));
export function validateSettings(s){
 if(!['off','weak','standard','strong'].includes(s.strength)||!['major','minor'].includes(s.scale))throw Error('補正設定が不正です');
 if(!Number.isInteger(s.key)||s.key<0||s.key>11||!Number.isFinite(s.offset_seconds)||Math.abs(s.offset_seconds)>30||!Number.isFinite(s.balance)||s.balance<0||s.balance>1.5)throw Error('キー・開始位置・音量を確認してください');
 if(s.reference_offset_seconds!==undefined&&(!Number.isFinite(s.reference_offset_seconds)||Math.abs(s.reference_offset_seconds)>30))throw Error('基準音符の開始位置を確認してください');
 let last=0;if(!Array.isArray(s.notes))throw Error('基準音符はJSON配列にしてください');
 for(const n of s.notes){if(![n.start,n.end,n.midi].every(Number.isFinite)||n.start<last||n.end<=n.start||n.midi<24||n.midi>96)throw Error('基準音符の時刻・音程を確認してください');last=n.end}
 return s;
}
export function fileCheck(file){if(!file||!file.size)throw Error('歌声と伴奏を選んでください');if(file.size>100*1024*1024)throw Error('音声ファイルは100MB以内にしてください');if(!/\.(wav|mp3|m4a|flac)$/i.test(file.name))throw Error('WAV・MP3・M4A・FLACを指定してください');}
export function safeRepo(repo){if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo))throw Error('リポジトリは所有者/名前で指定してください');return repo;}
export class GitHub{
 constructor(repo,token){this.repo=safeRepo(repo);this.token=token;}
 async call(path,{method='GET',body}={}){const response=await fetch(`https://api.github.com/repos/${this.repo}/${path}`,{method,headers:{Authorization:`Bearer ${this.token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});if(!response.ok){const e=Error(`GitHub HTTP ${response.status}。${response.status===401?'トークンを確認してください。':response.status===403?'権限・有効期限・利用枠を確認してください。':response.status===404?'対象リポジトリとトークンの許可対象を確認してください。':'再試行してください。'}`);e.status=response.status;throw e;}return response.status===204?null:response.json();}
 async get(path){try{const v=await this.call(`contents/${path}?ref=main`);return {value:decodeJSON(v.content),sha:v.sha};}catch(e){if(e.status===404)return {value:null,sha:null};throw e;}}
 async put(path,value,sha){return this.call(`contents/${path}`,{method:'PUT',body:{message:'Save S-Generator project [skip ci]',branch:'main',content:encodeJSON(value),...(sha?{sha}:{})}});}
 async dispatch(project,request){return this.call('actions/workflows/mobile.yml/dispatches',{method:'POST',body:{ref:'main',inputs:{project,request}}});}
 async findRun(project,request){const r=await this.call('actions/workflows/mobile.yml/runs?event=workflow_dispatch&per_page=100');return r.workflow_runs.find(r=>r.display_title===`mobile-${project}-${request}`);}
}
export async function decryptMailbox(envelope,privateKey){const rawKey=await crypto.subtle.decrypt({name:'RSA-OAEP'},privateKey,from64(envelope.key));const aes=await crypto.subtle.importKey('raw',rawKey,'AES-GCM',false,['decrypt']);const compressed=await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(envelope.iv)},aes,from64(envelope.data));const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));return JSON.parse(await new Response(stream).text());}
export async function deviceKeys(){const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('s-generator-keys',1);r.onupgradeneeded=()=>r.result.createObjectStore('keys');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});const stored=await new Promise((resolve,reject)=>{const r=db.transaction('keys').objectStore('keys').get('reply');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});if(stored){db.close();return stored;}const pair=await crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},false,['encrypt','decrypt']);const result={privateKey:pair.privateKey,publicKey:await crypto.subtle.exportKey('jwk',pair.publicKey)};await new Promise((resolve,reject)=>{const tx=db.transaction('keys','readwrite');tx.objectStore('keys').put(result,'reply');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close();return result;}
export function resolveJobState(job,run,active,now=Date.now()){
 const staleRetry=active.retry_at && (!job || job.updated_at*1000<active.retry_at);
 const oldRun=active.retry_at && (!run || Date.parse(run.created_at)<active.retry_at-2000);
 if(staleRetry&&oldRun&&now-active.retry_at<120000)return 'queued';
 if(run&&run.status!=='completed')return run.status==='in_progress'?'running':'queued';
 if(run?.status==='completed'&&run.conclusion!=='success')return run.conclusion==='cancelled'?'cancelled':'failed';
 return job?.status||'queued';
}
