import {api,cloudSession,getAccessToken} from './cloud.mjs';
import {STAGES} from './intelligence.mjs';
async function page(table,org,select='*',extra=''){
 const maxPages=50,size=1000,result=[];
 for(let i=0;i<maxPages;i++){
  const q=`?organization_id=eq.${encodeURIComponent(org)}&select=${encodeURIComponent(select)}${extra}&limit=${size}&offset=${i*size}`;
  const part=await api(table,{query:q});if(!Array.isArray(part))throw Error(`Cloud ${table}: ungültige Antwort`);
  result.push(...part);if(part.length<size)return result;
 }
 throw Error(`${table}: Datenvolumen über 50.000 Zeilen. Serveraggregation benötigt.`);
}
export async function loadIntelligence(org,finance){
 const training=await page('glb_v11_training_results',org);
 if(!finance)return {pos:[],tags:[],targets:[],markets:[],training};
 const minDate=new Date(Date.now()-90*86400000).toISOString().slice(0,10);
 const [pos,tags,targets,markets]=await Promise.all([
  page('glb_v11_pos_lines',org,'*',`&service_date=gte.${minDate}`),page('glb_v11_product_tags',org),page('glb_v11_targets',org),page('glb_v11_market_observations',org)
 ]);return {pos,tags,targets,markets,training};
}
export async function savePos(org,lines){let inserted=0;for(let i=0;i<lines.length;i+=100){const batch=lines.slice(i,i+100).map(({id,...r})=>({...r,organization_id:org}));const rows=await api('glb_v11_pos_lines',{method:'POST',query:'?on_conflict=organization_id,source_hash,line_no',body:batch,prefer:'resolution=ignore-duplicates,return=representation'});inserted+=(rows?.length||0);}return inserted;}
export async function addMarket(org,o){return api('glb_v11_market_observations',{method:'POST',body:{...o,organization_id:org},prefer:'return=representation'});}
export async function saveTag(org,product_name,stage,exists){return exists?api('glb_v11_product_tags',{method:'PATCH',query:`?organization_id=eq.${encodeURIComponent(org)}&product_name=eq.${encodeURIComponent(product_name)}`,body:{stage},prefer:'return=representation'}):api('glb_v11_product_tags',{method:'POST',body:{organization_id:org,product_name,stage},prefer:'return=representation'});}
export async function saveTarget(org,stage,target_ratio,exists){return exists?api('glb_v11_targets',{method:'PATCH',query:`?organization_id=eq.${encodeURIComponent(org)}&stage=eq.${encodeURIComponent(stage)}`,body:{target_ratio},prefer:'return=representation'}):api('glb_v11_targets',{method:'POST',body:{organization_id:org,stage,target_ratio},prefer:'return=representation'});}
export async function saveQuiz(org,stage,correct,points,user_id){return api('glb_v11_training_results',{method:'POST',body:{organization_id:org,user_id,stage,correct,points},prefer:'return=representation'});}
export async function getMyUser(){const sess=cloudSession();return sess?.user?.id||null;}
export async function protectedApi(path,body){const access=await getAccessToken();const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${access}`},body:JSON.stringify(body)});const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||`Serverfehler ${r.status}`);return data;}
export async function readLegacy(org){return api('rpc/glb_read_workspace',{method:'POST',body:{p_org:org}});}
