const $=id=>document.getElementById(id);

export function validateGuide(value){
 if(value?.version!==1||typeof value.enabled!=='boolean'||!Number.isInteger(value.transpose)||value.transpose< -12||value.transpose>12||typeof value.pitch!=='boolean'||!['off','gentle','standard'].includes(value.dynamics)||!['off','auto','on'].includes(value.noise))throw Error('AI歌声のお手本設定を確認してください');
 return value;
}

export function readGuide(){
 return validateGuide({version:1,enabled:$('guideEnabled').checked,transpose:Number($('guideTranspose').value),pitch:$('guidePitch').checked,dynamics:$('guideDynamics').value,noise:$('guideNoise').value});
}

export function fillGuide(s={}){
 $('guideEnabled').checked=!!s.enabled;
 $('guideTranspose').value=s.transpose??0;
 $('guidePitch').checked=s.pitch!==false;
 $('guideDynamics').value=s.dynamics||'gentle';
 $('guideNoise').value=s.noise||'auto';
}
