const stages=[
  {id:'project',label:'曲を選ぶ',nodes:['.hero','#connection','#projectPanel']},
  {id:'materials',label:'音源を用意',nodes:['#materialsPanel','#songSeparation']},
  {id:'edit',label:'編集・補正',nodes:['#songStudio','#guideSection','#phraseSection']},
  {id:'finish',label:'試聴・書き出し',nodes:['#finishPanel']},
  {id:'mv',label:'MV制作',nodes:['#mvStudio']}
];
export function mountWorkflow(){
  const nav=document.getElementById('workspaceNav'),summary=document.getElementById('workspaceSummary');
  const root=document.createElement('div');root.id='workspace';summary.after(root);
  const views=new Map(),buttons=new Map();let current='project',title='';
  for(const [i,stage] of stages.entries()){
    const button=document.createElement('button');button.type='button';button.textContent=`${i+1} ${stage.label}`;
    button.addEventListener('click',()=>go(stage.id));nav.append(button);buttons.set(stage.id,button);
    const view=document.createElement('div');view.className='workspace-view';view.id=`view-${stage.id}`;
    view.setAttribute('aria-label',stage.label);root.append(view);views.set(stage.id,view);
    for(const selector of stage.nodes){const node=document.querySelector(selector);if(!node)throw Error(`制作画面が見つかりません: ${selector}`);view.append(node);}
  }
  const connection=document.getElementById('connection');
  const drawer=document.createElement('details');drawer.id='connectionDrawer';drawer.className='connection-drawer';drawer.open=true;
  const heading=document.createElement('summary');heading.textContent='GitHub接続・設定';drawer.append(heading);connection.before(drawer);drawer.append(connection);
  function go(id){
    if(!views.has(id))return;
    current=id;
    for(const [key,view] of views){view.hidden=key!==id;const button=buttons.get(key);button.setAttribute('aria-current',key===id?'step':'false');}
    if(id==='project')drawer.open=!document.getElementById('connected').textContent.includes('接続済み');
    summary.textContent=`${title||'曲を選択してください'} · ${stages.find(s=>s.id===id).label}`;
    try{sessionStorage.setItem('sg-workspace-step',id);}catch{}
    nav.scrollIntoView({block:'start',behavior:'instant'});
  }
  function setProject(name,{restore=false}={}){
    title=name||'';
    let next='materials';
    if(restore){try{next=sessionStorage.getItem('sg-workspace-step')||next;}catch{}}
    go(next);
  }
  go('project');
  return {go,setProject,setConnected(connected){drawer.open=!connected;}};
}
