export function adoptSeparated(result, projectId, existing={}){
 if(result?.operation!=='separate'||result.storage!=='saved')throw Error('保存済みの分離結果を選んでください');
 const sources=result.sources||{};
 for(const [role,name] of [['reference','separated_vocal'],['backing','separated_backing']]){
  const asset=sources[role];
  const prefix=`singing-generator/outputs/${projectId}/`;
  if(asset?.type!=='authenticated'||asset.format!=='wav'||!asset.public_id?.startsWith(prefix)||!asset.public_id.endsWith('/'+name))throw Error('このプロジェクトの分離結果を確認してください');
 }
 return {...existing,reference:sources.reference,backing:sources.backing};
}
