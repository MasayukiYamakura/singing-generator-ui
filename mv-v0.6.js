import {uuid,deviceKeys,decryptMailbox} from './core-v0.5.3.js';

export function mountMV(context){
 const $=id=>document.getElementById(id);
 let active=null,permit=null,photo=null,busy=false,loadedProject=null;
 const status=message=>{$('mvStatus').textContent=message;};
 const current=()=>{const {api,project}=context();if(!api||!project)throw Error('先にGitHubへ接続し、プロジェクトを選択してください');return {api,project};};
 const path=(project,id,kind)=>`projects/${project.id}/mv/${kind}/${id}.json`;
 const store=project=>{localStorage.setItem(`sg-mv-active-${project.id}`,JSON.stringify(active));};
 const guarded=async task=>{if(busy)return;busy=true;try{await task();}catch(e){status(e.message);}finally{busy=false;}};
 async function history(){const {api,project}=current();let entries=[];try{entries=await api.call(`contents/projects/${project.id}/mv/results?ref=main`);}catch(e){if(e.status!==404)throw e;}const select=$('mvHistory'),previous=select.value;select.replaceChildren(new Option('保存済みMVを選択',''));for(const entry of entries.filter(x=>x.name.endsWith('.json')).reverse()){
   const {value}=await api.get(entry.path);if(value?.storage==='saved')select.add(new Option(`${new Date(value.created_at*1000).toLocaleString()} · ${value.variant==='hood'?'黒フード':'本人'} · ${value.mode==='smoke'?'CPU試験':'AI生成'}`,entry.name.slice(0,-5)));
  }select.value=previous;
 }
 async function request(operation,extra={}){
  const {api,project}=current(),keys=await deviceKeys(),id=uuid();
  await api.put(path(project,id,'requests'),{version:1,operation,reply_key:keys.publicKey,...extra});
  active={id,operation,source:extra.source_request||id,created_at:Date.now()};store(project);
  await api.call('actions/workflows/live-mv.yml/dispatches',{method:'POST',body:{ref:'main',inputs:{project:project.id,request:id}}});
  status(`MV要求を送信しました (${id.slice(0,8)})。GitHub Actionsで起動します。`);return id;
 }
 async function uploadPhoto(permit,file){
  const {project}=current();if(file.size>12*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('JPEG・PNG・WebP、12MB以内の写真を選んでください');
  const form=new FormData();for(const [key,value] of Object.entries(permit.upload))form.append(key,String(value));form.append('file',file);
  const response=await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(permit.cloud_name)}/image/upload`,{method:'POST',body:form});
  if(!response.ok)throw Error(`写真の非公開登録に失敗しました (HTTP ${response.status})`);
  const saved=await response.json();if(saved.type!=='authenticated'||saved.public_id!==permit.upload.public_id||!['jpg','jpeg','png','webp'].includes(saved.format))throw Error('写真の保存先・形式を確認できません');
  photo={public_id:saved.public_id,format:saved.format,type:saved.type};localStorage.setItem(`sg-mv-photo-${project.id}`,JSON.stringify(photo));status('写真を非公開で登録しました。');
 }
 async function poll(){if(!active)return;const {api,project}=current();
  const {value:job}=await api.get(path(project,active.id,'jobs'));
  let run;try{const page=await api.call('actions/workflows/live-mv.yml/runs?event=workflow_dispatch&per_page=100');run=page.workflow_runs.find(x=>x.display_title===`mv-${project.id}-${active.id}`);}catch{}
  if(run){$('mvRunLink').href=run.html_url;$('mvRunLink').hidden=false;}
  if(job?.status==='waiting'){status(`Kaggleで生成中・回収待ち (${job.kaggle_status||job.submission||'送信中'})。同じ版の回収を実行できます。`);return;}
  if(run?.status==='completed'&&run.conclusion!=='success'){status(`MV処理が失敗しました。${job?.error||'ActionsのログとKaggleの非公開Kernelを確認してください。'} 新規送信は自動で行いません。`);return;}
  if(job?.status==='failed'){status(job.error||'MV生成に失敗しました。');return;}
  if(job?.status!=='completed'){status(`MV処理中：${job?.stage||'Actionsの起動を待っています。'}`);return;}
  const {value:sealed}=await api.get(path(project,active.id,'responses'));
  if(!sealed)return;
  let response;try{response=await decryptMailbox(sealed,(await deviceKeys()).privateKey);}catch{throw Error('この端末の暗号化キーで応答を開けません。保存済みMVの試聴リンクを取り直してください。');}
  if(active.operation==='photo'){
   permit=response;const file=$('mvPhoto').files[0];if(file)await uploadPhoto(permit,file);else status('写真アップロードの準備ができました。写真を選んで登録ボタンを押してください。');
  }else if(active.operation==='playback'){
   $('mvPlayer').replaceChildren();const video=document.createElement('video');video.controls=true;video.playsInline=true;video.style.width='100%';video.src=response.url;
   const link=document.createElement('a');link.href=response.url;link.download='s-generator-live-mv.mp4';link.target='_blank';link.rel='noopener noreferrer';link.textContent='完成MP4を開く・ダウンロード';
   $('mvPlayer').append(video,link);status(`非公開リンクは${new Date(response.expires_at*1000).toLocaleTimeString()}まで有効です。映像と音声を確認してください。`);
  }else if(active.operation==='delete'){status('選択したMVを削除しました。Kaggleの実行履歴は別管理です。');$('mvPlayer').replaceChildren();await history();}
  else if(response.status==='waiting'){status('Kaggleで生成中です。後で同じ実行版の回収を行ってください。');}
  else {status('MVを保存しました。履歴から選んで非公開の試聴リンクを取得できます。');await history();$('mvHistory').value=active.source;}
  active=null;store(project);
 }
 async function load(){const {project}=current();if(loadedProject!==project.id){loadedProject=project.id;active=JSON.parse(localStorage.getItem(`sg-mv-active-${project.id}`)||'null');photo=JSON.parse(localStorage.getItem(`sg-mv-photo-${project.id}`)||'null');permit=null;$('mvPlayer').replaceChildren();$('mvRunLink').hidden=true;}await history();if(active)await poll();}
 $('mvUploadPhoto').onclick=()=>guarded(async()=>{const file=$('mvPhoto').files[0];if(!file)throw Error('写真を選んでください');current();if(permit&&permit.expires_at*1000>Date.now()+60000){await uploadPhoto(permit,file);permit=null;return;}await request('photo');});
 $('mvGenerate').onclick=()=>guarded(async()=>{
  const {api,project}=current(),audio=$('history').value,variant=$('mvVariant').value,seconds=Number($('mvSeconds').value),start=Number($('mvStart').value),mode=$('mvMode').value;
  if(!audio)throw Error('上の出力履歴から加工済みの実声音源を選んでください');
  const {value:result}=await api.get(`projects/${project.id}/results/${audio}.json`);
  if(!result||result.demo||result.storage!=='saved'||!result.assets?.some(x=>x.name==='mix_corrected')||!result.assets?.some(x=>x.name==='corrected'))throw Error('保存済みの実声音源（歌声と伴奏の完成版）を選んでください');
  if(variant==='face'&&!photo)throw Error('先に本人の写真を非公開で登録してください');
  if(![1,5,10,77].includes(seconds)||!Number.isFinite(start)||start<0||start+seconds>360)throw Error('長さと開始位置を確認してください');
  if(mode==='ai'&&seconds===77&&!confirm('77秒のGPU試験はKaggleの実行上限で失敗する可能性があります。続けますか？'))return;
  await request('submit',{audio_request:audio,variant,mode,seconds,start,...(variant==='face'?{photo}:{})});
 });
 $('mvRefresh').onclick=()=>guarded(async()=>{await history();await poll();});
 $('mvCollect').onclick=()=>guarded(async()=>{const {project}=current();if(!active||!['submit','collect'].includes(active.operation))throw Error('回収するMV依頼がありません。');const source=active.source;const {api}=current();const {value:job}=await api.get(path(project,source,'jobs'));if(!job?.version_ref)throw Error('Kaggleの確定版番号がありません。Actionsと非公開Kernelを確認してください');await request('collect',{source_request:source});});
 $('mvPlayback').onclick=()=>guarded(async()=>{const source=$('mvHistory').value;if(!source)throw Error('MV履歴から選択してください');await request('playback',{source_request:source});});
 $('mvDelete').onclick=()=>guarded(async()=>{const source=$('mvHistory').value;if(!source)throw Error('削除するMVを選択してください');if(!confirm('選択した完成MVをCloudinaryから削除しますか？'))return;await request('delete',{source_request:source});});
 setInterval(()=>{if(context().api&&context().project&&active&&!document.hidden)guarded(poll);},12000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active&&context().api&&context().project)guarded(poll);});
 return {load};
}
