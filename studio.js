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
export function trimLeft(edit,value,duration=360){
 const next=clamp(value,Math.max(0,edit.trim_start-edit.position),Math.min(edit.trim_end-.01,duration,edit.trim_start+390-edit.position));
 return {...edit,trim_start:Math.round(next*100)/100,position:Math.round((edit.position+next-edit.trim_start)*100)/100};
}
export function mountStudio(){
 const state={vocal:{trim_start:0,trim_end:360,position:0},backing:{trim_start:0,trim_end:360,position:0}},automation={vocal:[],backing:[]}, data={vocal:null,backing:null};
 let windowStart=0,windowLength=30,active=null,context=null,playing=[],playTimer=null,playTicker=null,playhead=0,dirty=false;
 const pointers=new Map();let pinch=null;
 const undo=[],redo=[];
 const snapshot=()=>({edits:structuredClone(state),curves:structuredClone(automation)});
 const restore=x=>{Object.assign(state,x.edits);Object.assign(automation,x.curves);dirty=true;refresh();};
 const pushUndo=()=>{undo.push(snapshot());if(undo.length>40)undo.shift();redo.length=0;dirty=true;};
 function fields(name){return {start:$(name+'TrimStart'),end:$(name+'TrimEnd'),position:$(name+'Position'),canvas:$(name+'Wave')};}
 function draw(name){
  const {canvas}=fields(name),ctx=canvas.getContext('2d'),width=canvas.width,height=canvas.height,e=state[name],info=data[name];
  ctx.clearRect(0,0,width,height);ctx.fillStyle='#12232b';ctx.fillRect(0,0,width,height);
  for(let t=Math.ceil(windowStart/5)*5;t<windowStart+windowLength;t+=5){const x=(t-windowStart)/windowLength*width;ctx.strokeStyle='#54747a';ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();}
  const duration=info?.duration??Math.max(e.trim_end,30);
  const first=(e.position-windowStart)/windowLength*width,last=(e.position+e.trim_end-e.trim_start-windowStart)/windowLength*width;
  ctx.fillStyle='#12584c';ctx.fillRect(first,20,last-first,height-24);
  if(info?.peaks){ctx.strokeStyle=name==='vocal'?'#39d8a2':'#f47b5d';ctx.beginPath();
   for(let px=Math.max(0,Math.floor(first));px<Math.min(width,Math.ceil(last));px++){
    const source=e.trim_start+(windowStart+px/width*windowLength-e.position),bin=Math.floor(source/duration*info.peaks.length);
    const a=info.peaks[clamp(bin,0,info.peaks.length-1)]||0;ctx.moveTo(px,height/2-a*height*.36);ctx.lineTo(px,height/2+a*height*.36);
   }ctx.stroke();
  }
  ctx.fillStyle='#fff';for(const x of [first,last]){ctx.fillRect(x-5,20,10,height-24);}
  const head=(playhead-windowStart)/windowLength*width;if(head>=0&&head<=width){ctx.fillStyle='#ffd56b';ctx.fillRect(head-1,0,2,height);}
 }
 function drawRuler(){const ruler=$('studioRuler');ruler.replaceChildren();for(let t=Math.ceil(windowStart/5)*5;t<windowStart+windowLength;t+=5){const mark=document.createElement('span');mark.className='studio-ruler-mark';mark.style.left=`${(t-windowStart)/windowLength*100}%`;mark.textContent=`${t}秒`;ruler.append(mark);}}
 function refresh(){drawRuler();for(const name of ['vocal','backing']){const e=state[name],f=fields(name);f.start.value=e.trim_start.toFixed(2);f.end.value=e.trim_end.toFixed(2);f.position.value=e.position.toFixed(2);$(name+'WaveStatus').textContent=data[name]?.peaks?`配置 ${e.position.toFixed(2)}秒 / 元音源 ${e.trim_start.toFixed(2)}〜${e.trim_end.toFixed(2)}秒。中央で移動・両端でトリミング。`:'音源を選ぶか保存済みの波形を読み込んでください。';draw(name);drawCurve(name);}
  $('studioViewStart').value=windowStart;$('studioViewStart').max=Math.max(0,Math.ceil(Math.max(...Object.values(state).map(e=>e.position+e.trim_end-e.trim_start))-windowLength));if($('studioEditState'))$('studioEditState').textContent=dirty?'未保存の位置合わせがあります。「編集を保存」で保持します。':'位置合わせは保存済み、または未変更です。';}
 function update(name,field,value){if(!Number.isFinite(value))throw Error('秒数を確認してください');pushUndo();const e=state[name],max=data[name]?.duration??360;if(field==='trim_start')Object.assign(e,trimLeft(e,value,max));else {e[field]=Math.round(clamp(value,0,field==='position'?390:max)*100)/100;if(e.trim_end<=e.trim_start)e.trim_end=Math.min(max,e.trim_start+.01);}refresh();}
 for(const name of ['vocal','backing']){
  const f=fields(name);
  for(const [key,element] of [['trim_start',f.start],['trim_end',f.end],['position',f.position]])element.addEventListener('change',()=>{try{update(name,key,Number(element.value));}catch(e){alert(e.message);refresh();}});
  f.canvas.addEventListener('pointerdown',event=>{const rect=f.canvas.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*f.canvas.width,e=state[name],handle=24/rect.width*f.canvas.width;
   $('studioTrack')&&($('studioTrack').value=name);pointers.set(event.pointerId,event.clientX);
   if(pointers.size===2){const xs=[...pointers.values()];pinch={distance:Math.abs(xs[0]-xs[1]),length:windowLength};active=null;f.canvas.setPointerCapture(event.pointerId);return;}
   const left=(e.position-windowStart)/windowLength*f.canvas.width,right=(e.position+e.trim_end-e.trim_start-windowStart)/windowLength*f.canvas.width;
   playhead=clamp(windowStart+x/f.canvas.width*windowLength,0,390);
   const pan=$('studioTool')?.value==='pan'||x<left-handle||x>right+handle;
   if(!pan)pushUndo();active={name,kind:pan?'pan':Math.abs(x-left)<handle?'trim_start':Math.abs(x-right)<handle?'trim_end':'position',x:event.clientX,initial:{...e},start:windowStart};
   f.canvas.setPointerCapture(event.pointerId);event.preventDefault();});
  f.canvas.addEventListener('pointermove',event=>{if(pointers.has(event.pointerId))pointers.set(event.pointerId,event.clientX);if(pinch&&pointers.size===2){const xs=[...pointers.values()],distance=Math.abs(xs[0]-xs[1]);if(distance>12){windowLength=clamp(Math.round(pinch.length*pinch.distance/distance),10,360);$('studioZoom').value=String([10,30,60,180,360].reduce((a,b)=>Math.abs(b-windowLength)<Math.abs(a-windowLength)?b:a));refresh();}return;}if(!active||active.name!==name)return;const delta=(event.clientX-active.x)/f.canvas.getBoundingClientRect().width*windowLength,initial=active.initial;
   if(active.kind==='pan')windowStart=clamp(active.start-delta,0,Math.max(0,390-windowLength));
   else if(active.kind==='trim_start')Object.assign(state[name],trimLeft(initial,$('studioSnap')?.checked?Math.round(initial.trim_start+delta):initial.trim_start+delta,data[name]?.duration??360));
   else if(active.kind==='trim_end')state[name].trim_end=clamp($('studioSnap')?.checked?Math.round(initial.trim_end+delta):initial.trim_end+delta,initial.trim_start+.01,data[name]?.duration??360);
   else {const position=initial.position+delta;state[name].position=clamp($('studioSnap')?.checked?Math.round(position):Math.round(position*100)/100,0,390);}
   refresh();});
  f.canvas.addEventListener('pointerup',event=>{pointers.delete(event.pointerId);if(pointers.size<2)pinch=null;active=null;});f.canvas.addEventListener('pointercancel',event=>{pointers.delete(event.pointerId);pinch=null;if(active?.kind!=='pan'&&active){Object.assign(state[name],active.initial);undo.pop();dirty=undo.length>0;}active=null;refresh();});
 }
 for(const [id,sign] of [['studioNudgeLeft',-1],['studioNudgeRight',1]])$(id)?.addEventListener('click',()=>{const name=$('studioTrack').value;update(name,'position',state[name].position+sign*Number($('studioNudgeStep').value));});
 $('studioSave')?.addEventListener('click',()=>$('saveSettings').click());
 $('studioZoom').addEventListener('change',()=>{windowLength=Number($('studioZoom').value);windowStart=0;refresh();});
 $('studioViewStart').addEventListener('input',()=>{windowStart=Number($('studioViewStart').value);refresh();});
 async function attach(name,file){if(!file)return;try{context??=new AudioContext();const buffer=await context.decodeAudioData(await file.arrayBuffer());const duration=buffer.duration,bins=1800,peaks=new Float32Array(bins),channel=buffer.getChannelData(0);
   for(let i=0;i<bins;i++){let peak=0;const from=Math.floor(i*channel.length/bins),to=Math.floor((i+1)*channel.length/bins);for(let j=from;j<to;j+=Math.max(1,Math.floor((to-from)/40)))peak=Math.max(peak,Math.abs(channel[j]));peaks[i]=peak;}
   data[name]={duration,peaks,buffer};state[name].trim_end=Math.min(duration,state[name].trim_end);state[name].trim_start=Math.min(state[name].trim_start,Math.max(0,duration-.01));refresh();
  }catch(e){data[name]=null;refresh();$('studioHint').textContent='波形の読み込みに失敗しました。数値入力は使用できます。';}}
 function attachOverview(name,overview){if(!['vocal','backing'].includes(name)||!overview)return;const duration=Number(overview.duration),peaks=overview.peaks;
  if(!Number.isFinite(duration)||duration<=0||duration>360||!Array.isArray(peaks)||!peaks.length||peaks.length>1800||!peaks.every(x=>Number.isFinite(x)&&x>=0&&x<=1.1))throw Error('保存済み波形が不正です');
  data[name]={duration,peaks:Float32Array.from(peaks),buffer:null};state[name].trim_end=Math.min(duration,state[name].trim_end);refresh();}
 function read(){
  const edits=structuredClone(state),mix={genre:$('studioGenre').value,automix:$('studioAutoMix').checked,
   vocal_db:Number($('studioVocalGain').value),backing_db:Number($('studioBackingGain').value),harmony_db:0,
   harmony:$('studioHarmony').checked?[{semitones:Number($('studioHarmonyInterval').value),db:Number($('studioHarmonyGain').value)}]:[],vocal_automation:structuredClone(automation.vocal),backing_automation:structuredClone(automation.backing)};
  const master={preset:$('studioMaster').value,intensity:$('studioIntensity').value,input_gain_db:Number($('studioInputGain').value),target_lufs:Number($('studioLufs').value)};
  return validateStudio({version:1,edits,mix,master});
 }
 function fill(s){stop();undo.length=0;redo.length=0;dirty=false;const edits=s?.edits||{};for(const name of ['vocal','backing']){Object.assign(state[name],{trim_start:0,trim_end:360,position:0},edits[name]||{});data[name]=null;}
  const m=s?.mix||{},master=s?.master||{};automation.vocal=structuredClone(m.vocal_automation||[]);automation.backing=structuredClone(m.backing_automation||[]);for(const [id,value] of Object.entries({studioGenre:m.genre||'manual',studioAutoMix:!!m.automix,studioVocalGain:m.vocal_db??0,studioBackingGain:m.backing_db??0,studioHarmony:!!m.harmony?.length,studioHarmonyInterval:m.harmony?.[0]?.semitones??7,studioHarmonyGain:m.harmony?.[0]?.db??-18,studioMaster:master.preset||'none',studioIntensity:master.intensity||'normal',studioInputGain:master.input_gain_db??0,studioLufs:master.target_lufs??-14})){if($(id).type==='checkbox')$(id).checked=value;else $(id).value=value;}refresh();}

 function stop(){if(playTimer)clearTimeout(playTimer);if(playTicker)clearInterval(playTicker);playTimer=null;playTicker=null;for(const src of playing){try{src.stop();}catch{}}playing=[];refresh();}
 async function preview(){stop();context??=new AudioContext();await context.resume();const start=Number($('studioLoopStart').value),end=Number($('studioLoopEnd').value);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>390)throw Error('試聴区間を確認してください');
  if(!data.vocal?.buffer&&!data.backing?.buffer)throw Error('配置を重ねて試聴するには元ファイルを再選択してください。保存済み音源は各トラックで単独試聴できます。');
  const now=context.currentTime+.08;
  playhead=start;const started=performance.now();playTicker=setInterval(()=>{playhead=Math.min(end,start+(performance.now()-started)/1000);for(const name of ['vocal','backing'])draw(name);},100);
  for(const name of ['vocal','backing']){const info=data[name],e=state[name];if(!info?.buffer||$(name==='vocal'?'studioMuteVocal':'studioMuteBacking').checked||($('studioSoloVocal').checked||$('studioSoloBacking').checked)&&!$(name==='vocal'?'studioSoloVocal':'studioSoloBacking').checked)continue;
   const from=Math.max(start,e.position),to=Math.min(end,e.position+e.trim_end-e.trim_start);
   if(to<=from)continue;const offset=e.trim_start+from-e.position;
   const source=context.createBufferSource(),gain=context.createGain();source.buffer=info.buffer;gain.gain.value=.7;
   source.connect(gain).connect(context.destination);source.start(now+from-start,offset,to-from);playing.push(source);
  }
  playTimer=setTimeout(()=>{playTimer=null;if($('studioLoop').checked)preview().catch(e=>{$('studioHint').textContent=e.message;});else stop();},Math.ceil((end-start)*1000)+100);
 }
 $('studioPreview').onclick=()=>preview().catch(e=>{$('studioHint').textContent=e.message;});
 $('studioStop').onclick=stop;
 $('studioUndo').onclick=()=>{if(!undo.length)return;redo.push(snapshot());restore(undo.pop());};
 $('studioRedo').onclick=()=>{if(!redo.length)return;undo.push(snapshot());restore(redo.pop());};

 let selected=null,dragCurve=null;
 function drawCurve(name){
  const canvas=$(name+'Curve'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,points=automation[name];
  ctx.fillStyle='#12232b';ctx.fillRect(0,0,w,h);
  ctx.strokeStyle=name==='vocal'?'#39d8a2':'#f47b5d';ctx.lineWidth=3;ctx.beginPath();
  for(let x=0;x<w;x+=3){const t=windowStart+x/w*windowLength;let db=0;
   if(points.length){if(t<=points[0].time)db=points[0].db;else if(t>=points.at(-1).time)db=points.at(-1).db;
    else{const j=points.findIndex(p=>p.time>=t),a=points[j-1],b=points[j];db=a.db+(b.db-a.db)*(t-a.time)/(b.time-a.time);}}
   const y=(12-db)/48*h;if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }ctx.stroke();
  for(const p of points){if(p.time<windowStart||p.time>windowStart+windowLength)continue;
   const x=(p.time-windowStart)/windowLength*w,y=(12-p.db)/48*h;ctx.fillStyle=selected?.point===p?'#fff':'#ffd56b';ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);ctx.fill();}
  ctx.fillStyle='#d6ebed';ctx.font='12px sans-serif';ctx.fillText(points.length?'点をドラッグして音量変更':'時刻と音量を入力して点を追加',8,h-7);
 }
 function addPoint(name){
  const time=Number($('curveTime').value),db=Number($('curveDb').value);
  if(!Number.isFinite(time)||time<0||time>390||!Number.isFinite(db)||db< -36||db>12)throw Error('音量カーブの時刻・音量を確認してください');
  if(automation[name].some(p=>Math.abs(p.time-time)<.01)||automation[name].length>=60)throw Error('同じ時刻の点、または点の上限です');
  pushUndo();const point={time,db};automation[name].push(point);automation[name].sort((a,b)=>a.time-b.time);selected={name,point};refresh();
 }
 $('addVocalPoint').onclick=()=>{try{addPoint('vocal');}catch(e){$('studioHint').textContent=e.message;}};
 $('addBackingPoint').onclick=()=>{try{addPoint('backing');}catch(e){$('studioHint').textContent=e.message;}};
 $('removeCurvePoint').onclick=()=>{if(!selected)return;pushUndo();automation[selected.name]=automation[selected.name].filter(p=>p!==selected.point);selected=null;refresh();};
 for(const name of ['vocal','backing']){
  const canvas=$(name+'Curve');
  canvas.addEventListener('pointerdown',e=>{const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width*canvas.width,y=(e.clientY-rect.top)/rect.height*canvas.height;
   const point=automation[name].find(p=>Math.abs((p.time-windowStart)/windowLength*canvas.width-x)<18&&Math.abs((12-p.db)/48*canvas.height-y)<18);
   if(!point)return;pushUndo();selected={name,point};dragCurve={name,point};canvas.setPointerCapture(e.pointerId);refresh();});
  canvas.addEventListener('pointermove',e=>{if(!dragCurve||dragCurve.name!==name)return;const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width,y=(e.clientY-rect.top)/rect.height,points=automation[name],index=points.indexOf(dragCurve.point);
   const lo=index?points[index-1].time+.01:0,hi=index<points.length-1?points[index+1].time-.01:390;
   dragCurve.point.time=Math.round(clamp(windowStart+x*windowLength,lo,hi)*100)/100;dragCurve.point.db=Math.round(clamp(12-y*48,-36,12)*10)/10;refresh();});
  canvas.addEventListener('pointerup',()=>{dragCurve=null;});canvas.addEventListener('pointercancel',()=>{dragCurve=null;});
 }
 refresh();return {read,fill,attach,attachOverview,markSaved(){dirty=false;refresh();}};
}

