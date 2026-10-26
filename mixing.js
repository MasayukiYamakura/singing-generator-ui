export function gridSuggestions(phrases,bpm,division=8,origin=0){if(!Number.isFinite(bpm)||bpm<40||bpm>240||![4,8,16].includes(division)||!Number.isFinite(origin))throw Error('BPMは40〜240、グリッドは4/8/16です');const step=60/bpm*4/division;return phrases.map(p=>({...p,shift_ms:Math.max(-300,Math.min(300,Math.round((origin+Math.round((p.start-origin)/step)*step-p.start)*1000)))}));}
export const presets={
 dry:{strength:'off',retune_ms:0,effects:{version:2}},
 natural:{strength:'weak',retune_ms:30,effects:{version:2,highpass:true,highpass_hz:80,denoise:true,noise_reduction_db:6,compressor:true,threshold_db:-18,ratio:2,attack_ms:10,release_ms:150,presence_db:1,air_db:1,reverb:.08}},
 pop:{strength:'strong',retune_ms:20,effects:{version:2,highpass:true,highpass_hz:85,denoise:true,noise_reduction_db:9,compressor:true,threshold_db:-20,ratio:3,attack_ms:5,release_ms:120,deess:true,presence_db:2.5,air_db:1.5,reverb:.12,delay:.08,delay_ms:140,doubler:.15,chorus:.05,mastering:true,target_lufs:-14}},
 robotic:{strength:'hard',retune_ms:0,effects:{version:2,highpass:true,denoise:true,compressor:true,threshold_db:-20,ratio:4,presence_db:2,air_db:2,reverb:.1,delay:.1,delay_ms:150,doubler:.2,chorus:.08,mastering:true,target_lufs:-14}}
};
