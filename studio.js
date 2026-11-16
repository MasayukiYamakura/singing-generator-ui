export const MASTER_PRESETS=['none','universal','fire','clarity','tape','natural','cinematic','spatial','punch'];
export function validateStudio(s){
 if(s?.version!==1)throw Error('スタジオ設定の版が不正です');
 for(const name of ['vocal','backing']){
  const e=s.edits?.[name];
  if(!e||![e.trim_start,e.trim_end,e.position].every(Number.isFinite)||e.trim_start<0||e.trim_end<=e.trim_start||e.trim_end>360||e.position<0||e.position>390)throw Error(name+'の配置とトリミングを確認してください');
 }
 if(!['manual','pop','rock','acoustic','hiphop'].includes(s.mix?.genre)||!MASTER_PRESETS.includes(s.master?.preset))throw Error('ミックス・マスタリングの設定を確認してください');
 for(const k of ['vocal_db','backing_db','harmony_db'])if(!Number.isFinite(s.mix[k])||s.mix[k]<-36||s.mix[k]>12)throw Error('トラック音量を確認してください');
 return s;
}
const $=id=>document.getElementById(id);
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
export function mountStudio(){
 const state={vocal:{trim_start:0,trim_end:360,position:0},backing:{trim_start:0,trim_end:360,position:0}}, data={vocal:null,backing:null};
 let windowStart=0,windowLength=30,active=null,context=null,playing=[],playTimer=null;
 const undo=[],redo=[];
 const snapshot=()=>structuredClone(state);
 const pushUndo=()=>{undo.push(snapshot());if(undo.length>40)undo.shift();redo.length=0;};
 function fields(name){return {start:$(name+'TrimStart'),end:$(name+'TrimEnd'),position:$(name+'Position'),canvas:$(name+'Wave')};}
 function draw(name){
  const {canvas}=fields(name),ctx=canvas.getContext('2d'),width=canvas.width,height=canvas.height,e=state[name],info=data[name];
  ctx.clearRect(0,0,width,height);ctx.fillStyle='#12232b';ctx.fillRect(0,0,width,height);
  for(let t=Math.ceil(windowStart/5)*5;t<windowStart+windowLength;t+=5){const x=(t-windowStart)/windowLength*width;ctx.strokeStyle='#37505b';ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();ctx.fillStyle='#b6ced4';ctx.font='13px sans-serif';ctx.fillText(t+'s',x+2,13);}
  const duration=info?.duration??Math.max(e.trim_end,30);
  const first=(e.position-windowStart)/windowLength*width,last=(e.position+e.trim_end-e.trim_start-windowStart)/windowLength*width;
  ctx.fillStyle='#12584c';ctx.fillRect(first,20,last-first,height-24);
  if(info?.peaks){ctx.strokeStyle=name==='vocal'?'#39d8a2':'#f47b5d';ctx.beginPath();
   for(let px=Math.max(0,Math.floor(first));px<Math.min(width,Math.ceil(last));px++){
    const source=e.trim_start+(windowStart+px/width*windowLength-e.position),bin=Math.floor(source/duration*info.peaks.length);
    const a=info.peaks[clamp(bin,0,info.peaks.length-1)]||0;ctx.moveTo(px,height/2-a*height*.36);ctx.lineTo(px,height/2+a*height*.36);
   }ctx.stroke();
  }else{ctx.fillStyle='#d2e0e3';ctx.font='13px sans-serif';ctx.fillText('音源を選ぶと波形を表示します',Math.max(5,first+5),height/2);}
  ctx.fillStyle='#fff';for(const x of [first,last]){ctx.fillRect(x-5,20,10,height-24);}
  ctx.fillStyle='#e2f9f0';ctx.font='12px sans-serif';ctx.fillText('両端をドラッグしてトリミング・中央をドラッグして移動',8,height-7);
 }
 function refresh(){for(const name of ['vocal','backing']){const e=state[name],f=fields(name);f.start.value=e.trim_start.toFixed(2);f.end.value=e.trim_end.toFixed(2);f.position.value=e.position.toFixed(2);draw(name);}
  $('studioViewStart').value=windowStart;$('studioViewStart').max=Math.max(0,Math.ceil(Math.max(...Object.values(state).map(e=>e.position+e.trim_end-e.trim_start))-windowLength));}
 function update(name,field,value){if(!Number.isFinite(value))throw Error('秒数を確認してください');pushUndo();const e=state[name],max=data[name]?.duration??360;e[field]=Math.round(clamp(value,0,field==='position'?390:max)*100)/100;if(e.trim_end<=e.trim_start){e[field]=field==='trim_start'?Math.max(0,e.trim_end-.01):Math.min(max,e.trim_start+.01);}refresh();}
 for(const name of ['vocal','backing']){
  const f=fields(name);
  for(const [key,element] of [['trim_start',f.start],['trim_end',f.end],['position',f.position]])element.addEventListener('change',()=>{try{update(name,key,Number(element.value));}catch(e){alert(e.message);refresh();}});
  f.canvas.addEventListener('pointerdown',event=>{const rect=f.canvas.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*f.canvas.width,e=state[name];
   const left=(e.position-windowStart)/windowLength*f.canvas.width,right=(e.position+e.trim_end-e.trim_start-windowStart)/windowLength*f.canvas.width;
   if(x<left-14||x>right+14)return;
   pushUndo();active={name,kind:Math.abs(x-left)<16?'trim_start':Math.abs(x-right)<16?'trim_end':'position',x:event.clientX,initial:{...e}};
   f.canvas.setPointerCapture(event.pointerId);event.preventDefault();});
  f.canvas.addEventListener('pointermove',event=>{if(!active||active.name!==name)return;const delta=(event.clientX-active.x)/f.canvas.getBoundingClientRect().width*windowLength,initial=active.initial;
   if(active.kind==='trim_start'){const next=clamp(initial.trim_start+delta,0,initial.trim_end-.01);state[name].trim_start=next;state[name].position=clamp(initial.position+next-initial.trim_start,0,390);}
   else if(active.kind==='trim_end')state[name].trim_end=clamp(initial.trim_end+delta,initial.trim_start+.01,data[name]?.duration??360);
   else state[name].position=clamp(initial.position+delta,0,390);
   refresh();});
  f.canvas.addEventListener('pointerup',()=>{active=null;});f.canvas.addEventListener('pointercancel',()=>{active=null;});
 }
 $('studioZoom').addEventListener('change',()=>{windowLength=Number($('studioZoom').value);windowStart=0;refresh();});
 $('studioViewStart').addEventListener('input',()=>{windowStart=Number($('studioViewStart').value);refresh();});
 async function attach(name,file){if(!file)return;try{context??=new AudioContext();const buffer=await context.decodeAudioData(await file.arrayBuffer());const duration=buffer.duration,bins=1800,peaks=new Float32Array(bins),channel=buffer.getChannelData(0);
   for(let i=0;i<bins;i++){let peak=0;const from=Math.floor(i*channel.length/bins),to=Math.floor((i+1)*channel.length/bins);for(let j=from;j<to;j+=Math.max(1,Math.floor((to-from)/40)))peak=Math.max(peak,Math.abs(channel[j]));peaks[i]=peak;}
   data[name]={duration,peaks,buffer};state[name].trim_end=Math.min(duration,state[name].trim_end);state[name].trim_start=Math.min(state[name].trim_start,Math.max(0,duration-.01));refresh();
  }catch(e){data[name]=null;refresh();$('studioHint').textContent='波形の読み込みに失敗しました。数値入力は使用できます。';}}
 function read(){
  const edits=structuredClone(state),mix={genre:$('studioGenre').value,automix:$('studioAutoMix').checked,
   vocal_db:Number($('studioVocalGain').value),backing_db:Number($('studioBackingGain').value),harmony_db:0,
   harmony:$('studioHarmony').checked?[{semitones:Number($('studioHarmonyInterval').value),db:Number($('studioHarmonyGain').value)}]:[]};
  const master={preset:$('studioMaster').value,intensity:$('studioIntensity').value,input_gain_db:Number($('studioInputGain').value),target_lufs:Number($('studioLufs').value)};
  return validateStudio({version:1,edits,mix,master});
 }
 function fill(s){stop();undo.length=0;redo.length=0;const edits=s?.edits||{};for(const name of ['vocal','backing']){Object.assign(state[name],{trim_start:0,trim_end:360,position:0},edits[name]||{});data[name]=null;}
  const m=s?.mix||{},master=s?.master||{};for(const [id,value] of Object.entries({studioGenre:m.genre||'manual',studioAutoMix:!!m.automix,studioVocalGain:m.vocal_db??0,studioBackingGain:m.backing_db??0,studioHarmony:!!m.harmony?.length,studioHarmonyInterval:m.harmony?.[0]?.semitones??7,studioHarmonyGain:m.harmony?.[0]?.db??-18,studioMaster:master.preset||'none',studioIntensity:master.intensity||'normal',studioInputGain:master.input_gain_db??0,studioLufs:master.target_lufs??-14})){if($(id).type==='checkbox')$(id).checked=value;else $(id).value=value;}refresh();}

 function stop(){if(playTimer)clearTimeout(playTimer);playTimer=null;for(const src of playing){try{src.stop();}catch{}}playing=[];}
 async function preview(){stop();context??=new AudioContext();await context.resume();const start=Number($('studioLoopStart').value),end=Number($('studioLoopEnd').value);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>390)throw Error('試聴区間を確認してください');
  if(!data.vocal?.buffer&&!data.backing?.buffer)throw Error('先に歌声か伴奏のファイルを選んでください');
  const now=context.currentTime+.08;
  for(const name of ['vocal','backing']){const info=data[name],e=state[name];if(!info?.buffer||$(name==='vocal'?'studioMuteVocal':'studioMuteBacking').checked)continue;
   const from=Math.max(start,e.position),to=Math.min(end,e.position+e.trim_end-e.trim_start);
   if(to<=from)continue;const offset=e.trim_start+from-e.position;
   const source=context.createBufferSource(),gain=context.createGain();source.buffer=info.buffer;gain.gain.value=.7;
   source.connect(gain).connect(context.destination);source.start(now+from-start,offset,to-from);playing.push(source);
  }
  playTimer=setTimeout(()=>{playTimer=null;if($('studioLoop').checked)preview().catch(e=>{$('studioHint').textContent=e.message;});else stop();},Math.ceil((end-start)*1000)+100);
 }
 $('studioPreview').onclick=()=>preview().catch(e=>{$('studioHint').textContent=e.message;});
 $('studioStop').onclick=stop;
 $('studioUndo').onclick=()=>{if(!undo.length)return;redo.push(snapshot());Object.assign(state,undo.pop());refresh();};
 $('studioRedo').onclick=()=>{if(!redo.length)return;undo.push(snapshot());Object.assign(state,redo.pop());refresh();};
 refresh();return {read,fill,attach};
}
