/** GLB 1.1 – deterministische Kennzahlen. KI darf keine Werte erfinden. */
import {parseCSV,numberDE,norm} from './core.mjs';
export const STAGES=[
 {id:'aperitif',name:'Aperitif',target:.30,lesson:'Der erste Drink',question:'Wann bietet man einen Aperitif sinnvoll an?',options:['Beim Ankommen mit konkreter Empfehlung','Erst nach dem Dessert','Gar nicht'],answer:0,tip:'Kurzer, konkreter Vorschlag direkt beim Empfang – ohne Druck.'},
 {id:'water',name:'Wasser',target:.55,lesson:'Wasser am Tisch',question:'Was verbessert die Wasserquote?',options:['Ungefragt buchen','Still oder sprudelnd aktiv anbieten','Erst nach Nachfrage servieren'],answer:1,tip:'Eine ehrliche Wahl anbieten und Wünsche respektieren.'},
 {id:'upgrade',name:'Upgrade',target:.22,lesson:'Passende Upgrades',question:'Welcher Zusatzverkauf ist besonders sinnvoll?',options:['Beliebig das Teuerste','Passende Beilage oder Sauce zum Hauptgericht','Jeden Gast mehrfach drängen'],answer:1,tip:'Zum gewählten Gericht passende, klar bepreiste Erweiterungen anbieten.'},
 {id:'dessert',name:'Dessert',target:.20,lesson:'Der süße Abschluss',question:'Wann sollte Dessert konkret angeboten werden?',options:['Nach dem Hauptgang, mit Empfehlung','Nur beim Bezahlen','Vor dem Hauptgang'],answer:0,tip:'Zum richtigen Zeitpunkt ein konkretes Dessert nennen.'},
 {id:'coffee',name:'Kaffee',target:.25,lesson:'Kaffee & Digestif',question:'Welche Frage klingt natürlich?',options:['Kaffee kostet extra.','Darf es zum Abschluss Espresso oder Cappuccino sein?','Gar keine Frage stellen'],answer:1,tip:'Kaffeeauswahl als natürlichen Abschluss anbieten.'},
 {id:'afterglow',name:'After Glow',target:.10,lesson:'After-Dinner-Moment',question:'Was ist ein gutes After-Glow-Angebot?',options:['Ein klar erklärtes kleines Abschlussangebot','Immer automatisch aufbuchen','Ohne Produktkenntnis empfehlen'],answer:0,tip:'Ein kleines Erlebnis anbieten, transparent und passend zum Gast.'}
];
export const STAGE_IDS=new Set(STAGES.map(x=>x.id));
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(`${s}T12:00:00Z`))&&new Date(`${s}T12:00:00Z`).toISOString().slice(0,10)===s;
const positive=(n,max)=>Number.isFinite(n)&&n>=0&&n<=max;
const finiteMoney=(n,max)=>Number.isFinite(n)&&n>=0&&n<=max;
export function readPosImport(csv,hash,filename,products=[],outlets=[],productTags=[]){
 const src=parseCSV(csv), errors=[],warnings=[],rows=[];
 if(!src.length)return {valid:[],errors:['Datei enthält keine Buchungszeilen.'],warnings:[]};
 const productIndex=new Map(products.map(p=>[norm(p.name),p]));
 const outletIndex=new Map(outlets.map(o=>[norm(o.name),o]));
 const tagIndex=new Map(productTags.map(x=>[norm(x.product_name),x.stage]));
 const required=['datum','bonid','outlet','produkt','menge','bruttopreis'];
 const missing=required.filter(c=>!(c in src[0].values));
 if(missing.length)return {valid:[],errors:[`Pflichtspalten fehlen: ${missing.join(', ')}`],warnings};
 const checkGuests=new Map();
 for(const line of src){const v=line.values,at=line.lineNo, day=(v.datum||'').trim(),bon=String(v.bonid||'').trim(),article=String(v.produkt||'').trim(),outlet=outletIndex.get(norm(v.outlet));
  const qty=numberDE(v.menge),gross=numberDE(v.bruttopreis);const product=productIndex.get(norm(article));
  const guests=String(v.gaeste??'').trim()===''?null:numberDE(v.gaeste);
  const vat=String(v.ust??'').trim()===''?(product?.vat_percent??null):numberDE(v.ust);
  const cost=String(v.wareneinsatznetto??'').trim()===''?(product?.unit_cost_net??null):numberDE(v.wareneinsatznetto);
  const stage=norm(v.funnelstufe||tagIndex.get(norm(article))||'none');
  if(!validDate(day)){errors.push(`Zeile ${at}: Datum muss JJJJ-MM-TT sein.`);continue}
  if(!bon||bon.length>100){errors.push(`Zeile ${at}: gültige BonID fehlt.`);continue}
  if(!outlet){errors.push(`Zeile ${at}: Outlet nicht im Bestand: ${v.outlet}.`);continue}
  if(!article||article.length>200){errors.push(`Zeile ${at}: Artikel fehlt/ist zu lang.`);continue}
  if(!positive(qty,1e7)||qty===0||!finiteMoney(gross,1e6)){errors.push(`Zeile ${at}: Menge/Bruttopreis ungültig.`);continue}
  if(guests!==null&&(!Number.isSafeInteger(guests)||guests<1||guests>1000)){errors.push(`Zeile ${at}: Gästezahl ungültig.`);continue}
  if(![7,19].includes(vat)){errors.push(`Zeile ${at}: USt fehlt oder ist nicht 7 bzw. 19. Artikel im Stammdatenbereich anlegen oder USt-Spalte ausfüllen.`);continue}
  if(cost!==null&&!finiteMoney(cost,1e6)){errors.push(`Zeile ${at}: Wareneinsatz ungültig.`);continue}
  if(stage!=='none'&&!STAGE_IDS.has(stage)){errors.push(`Zeile ${at}: unbekannte FunnelStufe ${stage}.`);continue}
  const checkKey=[day,outlet.id,bon].join('|');
  if(guests!==null&&checkGuests.has(checkKey)&&checkGuests.get(checkKey)!==guests){errors.push(`Zeile ${at}: unterschiedliche Gästezahl für denselben Bon.`);continue}
  if(guests!==null)checkGuests.set(checkKey,guests);
  if(!product&&!v.wareneinsatznetto)warnings.push(`Zeile ${at}: Artikel nicht im Stamm, Wareneinsatz ggf. unbekannt.`);
  rows.push({id:`${hash}:${at}`,source_hash:hash,line_no:at,file_name:filename,service_date:day,check_id:bon,outlet_id:outlet.id,product_name:article,product_id:product?.id??null,quantity:qty,unit_price_gross:gross,unit_cost_net:cost,vat_percent:vat,guests,stage,staff_code: (v.mitarbeiter||'').slice(0,80)});
 }
 // Missing guest counts can be filled ONLY if another line of the exact same check contains it.
 for(const row of rows)if(row.guests==null)row.guests=checkGuests.get([row.service_date,row.outlet_id,row.check_id].join('|'))??null;
 return {valid:rows,errors,warnings};
}
export function aggregateFunnel(lines,{outlet='all',date='all',targets={}}={}){
 const filtered=lines.filter(l=>(outlet==='all'||l.outlet_id===outlet)&&(date==='all'||l.service_date===date));
 const checks=new Map(),byDate=new Map();let gross=0,net=0,knownCost=0,costMissing=0;
 for(const l of filtered){const qty=Number(l.quantity),amount=qty*Number(l.unit_price_gross),vat=Number(l.vat_percent),n=amount/(1+vat/100);gross+=amount;net+=n;
  if(l.unit_cost_net!=null&&Number.isFinite(Number(l.unit_cost_net)))knownCost+=qty*Number(l.unit_cost_net);else costMissing++;
  const key=`${l.service_date}|${l.outlet_id}|${l.check_id}`;
  if(!checks.has(key))checks.set(key,{date:l.service_date,outlet:l.outlet_id,bon:l.check_id,guests:l.guests??null,stages:new Set()});
  const c=checks.get(key);if(c.guests==null&&l.guests!=null)c.guests=l.guests;
  if(STAGE_IDS.has(l.stage))c.stages.add(l.stage);
  if(!byDate.has(l.service_date))byDate.set(l.service_date,{date:l.service_date,checks:new Set(),gross:0,net:0});
  const d=byDate.get(l.service_date);d.checks.add(key);d.gross+=amount;d.net+=n;
 }
 const checkCount=checks.size,guestComplete=[...checks.values()].every(c=>Number(c.guests)>0),covers=guestComplete?[...checks.values()].reduce((a,c)=>a+Number(c.guests),0):null;
 const stages=STAGES.map(stage=>{
  const stageLines=filtered.filter(l=>l.stage===stage.id),unique=[...checks.values()].filter(c=>c.stages.has(stage.id)).length,units=stageLines.reduce((a,l)=>a+Number(l.quantity),0),sgross=stageLines.reduce((a,l)=>a+Number(l.quantity)*Number(l.unit_price_gross),0),snet=stageLines.reduce((a,l)=>a+Number(l.quantity)*Number(l.unit_price_gross)/(1+Number(l.vat_percent)/100),0);
  const costsOk=stageLines.length>0&&stageLines.every(l=>l.unit_cost_net!=null&&Number.isFinite(Number(l.unit_cost_net)));
  const stageCost=costsOk?stageLines.reduce((a,l)=>a+Number(l.quantity)*Number(l.unit_cost_net),0):null;
  const rate=checkCount?unique/checkCount:null,target=Number.isFinite(Number(targets[stage.id]))?Math.max(0,Math.min(1,Number(targets[stage.id]))):stage.target;
  const unitNet=units?snet/units:null,unitDB=costsOk&&units?(snet-stageCost)/units:null;
  // Conservative scenario: 1 additional unit per additional check, without extrapolating guarantees.
  const extraChecks=rate===null?null:Math.max(0,Math.round((target-rate)*checkCount));
  const revenuePotential=extraChecks===null||unitNet===null?null:extraChecks*unitNet;
  const dbPotential=extraChecks===null||unitDB===null?null:extraChecks*unitDB;
  return {...stage,checks:unique,units,gross:sgross,net:snet,rate,target,unitNet,unitDB,extraChecks,revenuePotential,dbPotential,costsOk};
 });
 const days=[...byDate.values()].sort((a,b)=>b.date.localeCompare(a.date)).map(d=>({date:d.date,checks:d.checks.size,gross:d.gross,net:d.net}));
 return {days,checkCount,covers,guestComplete,gross,net,margin:costMissing===0?net-knownCost:null,costMissing,stages,unclassified:filtered.filter(l=>!STAGE_IDS.has(l.stage)).length,lineCount:filtered.length};
}
export function compareMarket(observations,ourProducts){
 const eligible=observations.filter(o=>o.source_url&&validDate(o.checked_on)&&positive(Number(o.competitor_price_gross),1e6)&&Number(o.competitor_price_gross)>0);
 return eligible.map(o=>{const match=ourProducts.find(p=>norm(p.name)===norm(o.own_product));const own=Number(o.our_price_gross)||null;return {...o,own_name:match?.name||o.own_product,delta:own?((own-Number(o.competitor_price_gross))/Number(o.competitor_price_gross))*100:null}}).sort((a,b)=>b.checked_on.localeCompare(a.checked_on));
}
export function scoreQuiz(stageId,answerIndex){const s=STAGES.find(x=>x.id===stageId);if(!s)return {correct:false,points:0};const correct=Number(answerIndex)===s.answer;return {correct,points:correct?100:0,tip:s.tip};}
