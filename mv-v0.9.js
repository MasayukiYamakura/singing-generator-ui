import {uuid,deviceKeys,decryptMailbox} from './core-v0.5.3.js';

export function mountMV(context){
 const $=id=>document.getElementById(id);
 const text=message=>{$('mvStatus').textContent=message;};
 let saved={},projectId=null,busy=false,permits={},results=new Map();
 const current=()=>{const c=context();if(!c.api||!c.project)throw Error('先にGitHubへ接続してプロジェクトを選んでください');if(projectId&&c.project.id!==projectId)throw Error('プロジェクトの切り替えを待っています');return c;};
 const persist=()=>localStorage.setItem(`sg-studio-${projectId}`,JSON.stringify(saved));
 const guarded=async task=>{if(busy)return;busy=true;try{await task();}catch(e){text(e.message);}finally{busy=false;if(context().api&&context().project&&context().project.id!==projectId)await load();}};
 const path=(id,kind)=>`projects/${projectId}/mv/${kind}/${id}.json`;
 async function history(){
  const {api}=current();let entries=[];
  try{entries=await api.call(`contents/projects/${projectId}/mv/results?ref=main`);}catch(e){if(e.status!==404)throw e;}
  const old=$('mvHistory').value,ref=$('mvReferenceHistory').value||saved.preparation;
  $('mvHistory').replaceChildren(new Option('保存済みMVを選択',''));
  $('mvReferenceHistory').replaceChildren(new Option('生成した基準画像を選択',''));
  results=new Map();
  for(const file of entries.filter(x=>x.name.endsWith('.json')).reverse()){
   const {value}=await api.get(file.path);if(value?.storage!=='saved'||value.series_parent)continue;
   const id=file.name.slice(0,-5);results.set(id,value);
   const title=`${new Date(value.created_at*1000).toLocaleString()} · ${value.variant==='hood'?'黒フード':'本人'} · ${value.review==='approved'?'確認済み':'要確認'}`;
   if(value.task==='prepare')$('mvReferenceHistory').add(new Option(title,id));
   else $('mvHistory').add(new Option(`${title} · ${value.duration.toFixed(1)}秒 · ${value.mode==='studio'?'歌唱スタジオ':value.mode==='smoke'?'CPU試験':'旧AI試験'}`,id));
  }
  $('mvHistory').value=old;$('mvReferenceHistory').value=ref||'';
 }
 async function request(operation,extra={}){
  const {api}=current(),id=uuid(),keys=await deviceKeys();
  await api.put(path(id,'requests'),{version:1,operation,reply_key:keys.publicKey,...extra});
  const source=['collect','playback','delete','approve','pause','resume'].includes(operation)?extra.source_request:id;
  saved.active={id,source,operation,task:extra.task,created_at:Date.now()};
  if(operation==='submit'&&extra.task==='render'||operation==='revise')saved.series=source;
  persist();
  await api.call('actions/workflows/live-mv.yml/dispatches',{method:'POST',body:{ref:'main',inputs:{project:projectId,request:id}}});
  text('要求を受け付けました。状態を自動確認します。');
 }
 function fileFor(role){return $(role==='photo'?'mvPhoto':role==='vocal'?'mvVocal':'mvTrack').files[0];}
 async function upload(role,permit,file){
  const image=role==='photo',ext=file.name.split('.').pop().toLowerCase();
  if(image?file.size>12*1024**2||!['image/jpeg','image/png','image/webp'].includes(file.type):file.size>100*1024**2||!['wav','mp3','m4a','flac'].includes(ext))throw Error(image?'写真はJPEG・PNG・WebP、12MB以内にしてください':'音源はWAV・MP3・M4A・FLAC、100MB以内にしてください');
  const form=new FormData();for(const [key,value] of Object.entries(permit.upload))form.append(key,String(value));form.append('file',file);
  const response=await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(permit.cloud_name)}/${image?'image':'video'}/upload`,{method:'POST',body:form});
  if(!response.ok)throw Error(`非公開登録に失敗しました (HTTP ${response.status})`);
  const value=await response.json();
  const allowed=image?['jpg','jpeg','png','webp']:[ext,...(ext==='m4a'?['mp4']:[])];
  if(value.type!=='authenticated'||value.public_id!==permit.upload.public_id||!allowed.includes(value.format))throw Error('保存先・形式を確認できません');
  if(!image&&(!Number.isFinite(value.duration)||value.duration>360))throw Error('6分以内で長さを確認できる音源を選んでください');
  const asset={public_id:value.public_id,format:value.format,type:value.type,...(!image?{duration:value.duration}:{})};
  saved[role==='vocal'?'stem':role]=asset;
  saved.preparation=null;saved.preview=null;persist();delete permits[role];
  if(role==='track'&&value.duration>=1)$('mvSeconds').value=Math.floor(value.duration*10)/10;
  text(role==='photo'?'写真を非公開登録しました。':role==='vocal'?'同期用の歌声を登録しました。':'完成曲を登録しました。原音をMVに使います。');
 }
 async function beginUpload(role){
  const file=fileFor(role);if(!file)throw Error('登録するファイルを選んでください');
  if(permits[role]?.expires_at*1000>Date.now()+60000)return upload(role,permits[role],file);
  await request(role);
 }
 async function input(){
  const {api}=current(),source_kind=$('mvAudioSource').value,variant=$('mvVariant').value;
  let audio={};
  if(source_kind==='track'){
   if(!saved.track)throw Error('完成曲を先に登録してください');audio.track=saved.track;
  }else{
   const id=$('history').value;if(!id)throw Error('上の履歴から加工音源を選んでください');
   const {value}=await api.get(`projects/${projectId}/results/${id}.json`);
   if(!value||value.demo||value.storage!=='saved')throw Error('保存済みの実声音源を選んでください');audio.audio_request=id;
  }
  if(variant==='face'&&!saved.photo)throw Error('本人版の写真を登録してください');
  return {source_kind,variant,...audio,...(variant==='face'?{photo:saved.photo}:{}),
   ...(saved.stem?{stem:saved.stem}:{}),direction:$('mvDirection').value.trim()};
 }
 async function poll(){
  const active=saved.active;if(!active)return;
  const {api}=current();const {value:job}=await api.get(path(active.id,'jobs'));
  let run;try{const page=await api.call('actions/workflows/live-mv.yml/runs?event=workflow_dispatch&per_page=100');run=page.workflow_runs.find(x=>x.display_title===`mv-${projectId}-${active.id}`);}catch{}
  if(run){$('mvRunLink').href=run.html_url;$('mvRunLink').hidden=false;}
  if(job?.status==='failed'||run?.status==='completed'&&run.conclusion!=='success'){
   text(`処理が停止しました。${job?.error||'Actionsログを確認してください。'} GPU推論の自動再送は行いません。`);return;
  }
  if(job?.paused){text('一時停止中です。実行中のKaggle区間は終了後に回収できます。');return;}
  if(job?.status==='waiting'){
   text(job.kind==='series'?`生成中：${job.completed_segments||0}/${job.segments}区間。画面を開いている間は自動で回収・継続します。`:'Kaggleで処理中です。固定した実行版を回収します。');
   if(run?.status==='completed'&&Date.now()-active.created_at>180000)await request('collect',{source_request:active.source});
   return;
  }
  if(job?.status!=='completed'){text(`処理中：${job?.stage||'Actions起動待ち'}`);return;}
  const {value:sealed}=await api.get(path(active.id,'responses'));if(!sealed)return;
  const response=await decryptMailbox(sealed,(await deviceKeys()).privateKey);
  if(['photo','track','vocal'].includes(active.operation)){
   permits[active.operation]=response;const file=fileFor(active.operation);
   if(file)await upload(active.operation,response,file);else text('登録準備ができました。ファイルを選び、登録ボタンを押してください。');
  }else if(active.operation==='playback'){
   const media=document.createElement(response.task==='prepare'?'img':'video');
   if(media.tagName==='VIDEO'){media.controls=true;media.playsInline=true;}
   else media.alt='生成したライブ用基準画像';
   media.src=response.url;media.style.width='100%';
   const link=document.createElement('a');link.href=response.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='画像・動画を開く／保存';
   $('mvPlayer').replaceChildren(media,link);text('非公開リンクは15分有効です。人物・動作・口元を確認してください。');
  }else if(active.operation==='approve'){
   saved[response.task==='prepare'?'preparation':'preview']=active.source;persist();await history();
   text(response.task==='prepare'?'基準画像を採用しました。次は5〜10秒のプレビューを生成してください。':'短尺プレビューを確認済みにしました。長尺生成に使用できます。');
  }else if(active.operation==='delete'){
   $('mvPlayer').replaceChildren();await history();text('記録された出力を削除しました。入力曲は保持されています。');
  }else if(['pause','resume'].includes(active.operation)||['waiting','paused'].includes(response.status)){
   saved.active={id:active.source,source:active.source,operation:'submit',created_at:Date.now()};persist();
   text(response.status==='paused'?'一時停止しました。':'Kaggleの固定版を待っています。保存済みの区間は再生成しません。');return;
  }else{
   await history();
   if(response.task==='prepare'){$('mvReferenceHistory').value=active.source;text('基準画像を保存しました。表示して確認し、採用してください。');}
   else {$('mvHistory').value=active.source;text('MVを保存しました。再生して品質を確認してください。生成完了は品質合格の自動判定ではありません。');}
  }
  saved.active=null;persist();
 }
 async function load(){
  if(busy)return;
  const {project,api}=context();if(!project||!api)return;if(projectId!==project.id){
   projectId=project.id;saved=JSON.parse(localStorage.getItem(`sg-studio-${projectId}`)||'{}');
   for(const key of ['track','photo'])if(!saved[key])saved[key]=JSON.parse(localStorage.getItem(`sg-mv-${key}-${projectId}`)||'null');
   permits={};$('mvPlayer').replaceChildren();$('mvRunLink').hidden=true;
  }await history();if(saved.active)await poll();
 }
 $('mvUploadTrack').onclick=()=>guarded(()=>beginUpload('track'));
 $('mvUploadPhoto').onclick=()=>guarded(()=>beginUpload('photo'));
 $('mvUploadVocal').onclick=()=>guarded(()=>beginUpload('vocal'));
 $('mvClearVocal').onclick=()=>guarded(async()=>{saved.stem=null;saved.preparation=null;saved.preview=null;persist();text('同期用歌声の選択を解除しました。完成曲から抽出します。');});
 $('mvBuildReference').onclick=()=>guarded(async()=>{const source=await input();await request('submit',{...source,mode:'studio',task:'prepare',seconds:1,start:0});});
 $('mvViewReference').onclick=()=>guarded(async()=>{const id=$('mvReferenceHistory').value;if(!id)throw Error('基準画像を選んでください');await request('playback',{source_request:id});});
 $('mvApproveReference').onclick=()=>guarded(async()=>{const id=$('mvReferenceHistory').value;if(!id)throw Error('基準画像を選んでください');await request('approve',{source_request:id});});
 $('mvApprovePreview').onclick=()=>guarded(async()=>{const id=$('mvHistory').value,value=results.get(id);if(value?.mode!=='studio'||value.duration>10.1)throw Error('5〜10秒のスタジオプレビューを選んでください');await request('approve',{source_request:id});});
 $('mvGenerate').onclick=()=>guarded(async()=>{
  const source=await input(),seconds=Number($('mvSeconds').value),start=Number($('mvStart').value),mode=$('mvMode').value;
  if(!Number.isFinite(seconds)||seconds<1||seconds>(source.source_kind==='track'||mode==='studio'?360:77)||!Number.isFinite(start)||start<0||start+seconds>360)throw Error('生成する開始位置と長さを確認してください');
  if(source.track?.duration&&start+seconds>source.track.duration+.05)throw Error('指定区間が完成曲より長くなっています');
  const preparation=$('mvReferenceHistory').value||saved.preparation;
  if(mode==='studio'&&!preparation)throw Error('先に基準画像を作成・採用してください');
  await request('submit',{...source,mode,seconds,start,...(mode==='studio'?{task:'render',preparation,preview:saved.preview,sync_offset_ms:Number($('mvSyncOffset').value)}:{})});
 });
 $('mvCollect').onclick=()=>guarded(async()=>{const source=saved.active?.source||saved.series;if(!source)throw Error('回収する生成依頼がありません');await request('collect',{source_request:source});});
 $('mvPause').onclick=()=>guarded(async()=>{if(!saved.series)throw Error('長尺生成の依頼がありません');await request('pause',{source_request:saved.series});});
 $('mvResume').onclick=()=>guarded(async()=>{if(!saved.series)throw Error('長尺生成の依頼がありません');await request('resume',{source_request:saved.series});});
 $('mvReviseCut').onclick=()=>guarded(async()=>{const source=$('mvHistory').value,index=Number($('mvCutIndex').value)-1;if(!results.get(source)?.segments)throw Error('完成した長尺MVを選んでください');if(!Number.isInteger(index)||index<0)throw Error('カット番号を確認してください');await request('revise',{source_request:source,cut_index:index,revision_stage:$('mvRevisionStage').value,sync_offset_ms:Number($('mvSyncOffset').value)});});
 $('mvPlayback').onclick=()=>guarded(async()=>{const source=$('mvHistory').value;if(!source)throw Error('MVを選んでください');await request('playback',{source_request:source});});
 $('mvDelete').onclick=()=>guarded(async()=>{const source=$('mvHistory').value;if(!source)throw Error('MVを選んでください');if(confirm('選択したMVと、ほかの版が使用していない中間動画を削除しますか？'))await request('delete',{source_request:source});});
 $('mvRefresh').onclick=()=>guarded(async()=>{await history();await poll();});
 setInterval(()=>{if(context().api&&context().project&&saved.active&&!document.hidden)guarded(poll);},20000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&saved.active&&context().api&&context().project)guarded(poll);});
 return {load};
}
