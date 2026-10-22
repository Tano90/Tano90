const CFG='glb_v1_cloud_cfg';const SESSION='glb_v1_session';
export function cloudConfig(){try{return JSON.parse(localStorage.getItem(CFG)||'null')}catch{return null}}
export const saveConfig = cfg=>localStorage.setItem(CFG,JSON.stringify(cfg));
export const clearCloud=()=>{sessionStorage.removeItem(SESSION);localStorage.removeItem(CFG)};
export const cloudSession=()=>{try{return JSON.parse(sessionStorage.getItem(SESSION)||'null')}catch{return null}};
function saveSession(data){sessionStorage.setItem(SESSION,JSON.stringify(data))}
function validUrl(url){try{const u=new URL(url);return u.protocol==='https:'&&u.username===''&&u.password===''}catch{return false}}
async function baseFetch(path,body,method='POST',auth=false,headers={}){
  const cfg=cloudConfig();if(!cfg||!validUrl(cfg.url)||!cfg.key)throw Error('Supabase URL und Publishable/Anon Key fehlen.');
  const h={'apikey':cfg.key,'Content-Type':'application/json',...headers};
  if(auth){const session=await ensureSession();h.Authorization=`Bearer ${session.access_token}`;}
  const res=await fetch(`${cfg.url.replace(/\/$/,'')}/${path}`,{method,headers:h,...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const raw=await res.text();let data;try{data=raw?JSON.parse(raw):null}catch{data=raw}
  if(!res.ok)throw Error(`${res.status} ${data?.message||data?.error_description||data?.error||data?.hint||raw?.slice(0,300)||'API-Fehler'}`);
  return data;
}
export async function login(email,password){
 const result=await baseFetch('auth/v1/token?grant_type=password',{email,password});
 saveSession({...result,expires_at:Date.now()+result.expires_in*1000});return result;
}
async function ensureSession(){
 const sess=cloudSession();if(!sess)throw Error('Bitte erneut in Supabase anmelden.');
 if(sess.expires_at>Date.now()+60000)return sess;
 const result=await baseFetch('auth/v1/token?grant_type=refresh_token',{refresh_token:sess.refresh_token});
 const next={...result,expires_at:Date.now()+result.expires_in*1000};saveSession(next);return next;
}
export const logout=()=>sessionStorage.removeItem(SESSION);
export async function getAccessToken(){return (await ensureSession()).access_token;}
export async function api(table,opts={}){
 const {method='GET',body,query='',prefer}=opts;
 const headers=prefer?{'Prefer':prefer}:{};
 return baseFetch(`rest/v1/${table}${query}`,body,method,true,headers);
}
export async function verifyRole(org){
 const workspace=await api('rpc/glb_read_workspace',{method:'POST',body:{p_org:org}});
 return workspace?.role||null;
}
async function allRows(table,query){const pageSize=1000;const output=[];for(let i=0;i<50;i++){const extra=`&limit=${pageSize}&offset=${i*pageSize}`;const part=await api(table,{query:query+extra});if(!Array.isArray(part))throw Error('Ungültige Datenbankantwort.');output.push(...part);if(part.length<pageSize)return output;}throw Error('Mehr als 50.000 Datensätze: Es ist eine paginierte Berichtsauswertung erforderlich.');}
export async function loadCloud(org,role){
 const isFinance=['owner','editor','restaurant_manager','general_manager'].includes(role);
 const hasInventory=isFinance||['kitchen_lead','kitchen_staff'].includes(role);
 const results=await Promise.all([
  allRows('glb_v1_outlets',`?organization_id=eq.${encodeURIComponent(org)}&select=id,name&order=name.asc`),
  isFinance?allRows('glb_v1_products',`?organization_id=eq.${encodeURIComponent(org)}&select=id,name,unit_cost_net,vat_percent&order=name.asc`):Promise.resolve([]),
  isFinance?allRows('glb_v1_sales',`?organization_id=eq.${encodeURIComponent(org)}&select=*&order=month.desc`):Promise.resolve([]),
  allRows('glb_v1_tasks',`?organization_id=eq.${encodeURIComponent(org)}&select=*&order=created_at.desc`),
  hasInventory?allRows('glb_v1_inventory',`?organization_id=eq.${encodeURIComponent(org)}&select=*&order=name.asc`):Promise.resolve([]),
 ]);
 return {demo:false,outlets:results[0],products:results[1],sales:results[2],tasks:results[3],inventory:results[4]};
}
export async function postRows(table,rows,onConflict){
 return api(table,{method:'POST',body:rows,query:onConflict?`?on_conflict=${encodeURIComponent(onConflict)}`:'',prefer:'resolution=ignore-duplicates,return=representation'});
}
export async function insertOne(table,data){
 const result=await api(table,{method:'POST',body:data,prefer:'return=representation'});return Array.isArray(result)?result[0]:result;
}
export async function patchOne(table,id,org,data,expectedVersion){const version=Number(expectedVersion??1);const result=await api(table,{method:'PATCH',query:`?id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(org)}&version=eq.${version}`,body:{...data,version:version+1},prefer:'return=representation'});if(!Array.isArray(result)||result.length!==1)throw Error('Änderungskonflikt: Der Datensatz wurde parallel verändert. Bitte neu laden.');return result[0];}

export async function backfillCost(org,productId,cost){const result=await api('glb_v1_sales',{method:'PATCH',query:`?organization_id=eq.${encodeURIComponent(org)}&product_id=eq.${encodeURIComponent(productId)}&unit_cost_net=is.null`,body:{unit_cost_net:cost},prefer:'return=representation'});return result?.length??0;}
export async function updateProductCost(org,productId,cost){return api('glb_v1_products',{method:'PATCH',query:`?organization_id=eq.${encodeURIComponent(org)}&id=eq.${encodeURIComponent(productId)}`,body:{unit_cost_net:cost},prefer:'return=representation'});}
