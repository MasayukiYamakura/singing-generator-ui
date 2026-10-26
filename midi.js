// Standard MIDI file 0/1. Explicit melody-track selection; no polyphony guessing.
export function parseMidi(buffer){
 const data=new Uint8Array(buffer);if(data.length>2*1024*1024)throw Error('MIDIは2MB以内です');const view=new DataView(buffer);let p=0;
 const text=n=>{if(p+n>data.length)throw Error('MIDIが途中で切れています');const s=new TextDecoder().decode(data.subarray(p,p+n));p+=n;return s};
 const byte=()=>{if(p>=data.length)throw Error('MIDIが途中で切れています');return data[p++]};
 const u16=()=>byte()*256+byte();const u32=()=>byte()*16777216+byte()*65536+byte()*256+byte();
 const vlq=()=>{let n=0;for(let i=0;i<4;i++){const b=byte();n=n*128+(b&127);if(!(b&128))return n}throw Error('MIDIの可変長値が不正です')};
 if(text(4)!=='MThd')throw Error('Standard MIDIファイルではありません');const header=u32(),format=u16(),count=u16(),division=u16();if(header<6||format>1||!division||(division&32768))throw Error('MIDI形式0/1・PPQ形式に対応しています');p+=header-6;
 const tempos=[{tick:0,tempo:500000,order:-1}],tracks=[];let eventCount=0;
 for(let index=0;index<count;index++){
  if(text(4)!=='MTrk')throw Error('MIDIトラックが不正です');const size=u32(),end=p+size;if(end>data.length)throw Error('MIDIトラックが途中で切れています');let tick=0,running=0,name=`トラック${index+1}`;const active=new Map(),notes=[];
  while(p<end){if(++eventCount>200000)throw Error('MIDIのイベントが多すぎます');tick+=vlq();let status=byte();if(status<128){p--;if(!running)throw Error('MIDIのステータスが不正です');status=running;}else if(status<240)running=status;
   if(status===255){const type=byte(),len=vlq();if(p+len>end)throw Error('MIDIメタイベントが不正です');if(type===81&&len===3)tempos.push({tick,tempo:data[p]*65536+data[p+1]*256+data[p+2],order:eventCount});if(type===3)name=new TextDecoder().decode(data.subarray(p,p+len));p+=len;if(type===47)break;continue;}
   if(status===240||status===247){const len=vlq();p+=len;if(p>end)throw Error('MIDI SysExが不正です');running=0;continue;}
   const kind=status>>4,ch=status&15;if(kind<8||kind>14)throw Error('未対応のMIDIイベントです');const a=byte(),b=kind===12||kind===13?0:byte();if(a>127||b>127)throw Error('MIDIデータが不正です');const id=`${ch}:${a}`;
   if(kind===9&&b>0){if(!active.has(id))active.set(id,[]);active.get(id).push(tick)}
   else if(kind===8||(kind===9&&b===0)){const list=active.get(id);if(list?.length){const start=list.shift();if(tick>start)notes.push({start_tick:start,end_tick:tick,midi:a,channel:ch})}}
  }
  p=end;tracks.push({index,name,notes});
 }
 tempos.sort((a,b)=>a.tick-b.tick||a.order-b.order);let t=0,seconds=0,tempo=500000;const timeline=[];for(const entry of tempos){seconds+=(entry.tick-t)*tempo/division/1e6;t=entry.tick;tempo=entry.tempo;if(!tempo)throw Error('MIDIテンポが不正です');timeline.push({tick:t,seconds,tempo});}
 const secondsAt=tick=>{let chosen=timeline[0];for(const entry of timeline){if(entry.tick>tick)break;chosen=entry}return chosen.seconds+(tick-chosen.tick)*chosen.tempo/division/1e6};
 return tracks.filter(track=>track.notes.length).map(track=>({...track,notes:track.notes.sort((a,b)=>a.start_tick-b.start_tick).map(n=>({start:secondsAt(n.start_tick),end:secondsAt(n.end_tick),midi:n.midi}))}));
}
export function melodyNotes(notes,transpose=0){if(!Number.isInteger(transpose)||Math.abs(transpose)>12)throw Error('移調は半音単位で±12以内です');let last=0;return notes.map(n=>{const out={start:n.start,end:n.end,midi:n.midi+transpose};if(out.start<last-1e-6)throw Error('選んだトラックは音符が重なっています。単旋律のメロディートラックを選んでください');if(out.midi<24||out.midi>96)throw Error('移調後の音程が対応範囲を超えています');last=out.end;return out;});}
