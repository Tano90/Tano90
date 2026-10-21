/* GLB AI Suite 0.5 – auditable inventory projections & order operations. */
(function(root,factory){const api=factory(root?.GLBV04 || (typeof require==='function'?require('./v04core.js'):null));if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.GLBV05=api;})(typeof window!=='undefined'?window:globalThis,function(V4){
'use strict';
const round=n=>Math.round((Number(n)+Number.EPSILON)*1e4)/1e4;
const validDate=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s||'')))return false;const d=new Date(s+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;};
const key=(w,i)=>w+'|'+i;
const isAfter=(entry,latest)=>entry.date>latest.date || entry.date===latest.date && entry.recordedAt && latest.savedAt && entry.recordedAt>latest.savedAt;
function inventoryState({ingredients=[],warehouses=[],inventoryCounts=[],stockMovements=[],dailySales=[],recipes=[],assignments={},asOf=new Date().toISOString().slice(0,10),includeSalesUsage=true}){
 const snaps=V4.latestInventory(inventoryCounts.filter(x=>validDate(x.date)&&x.date<=asOf),asOf);
 const known=new Map();
 for(const [k,v] of snaps){known.set(k,{warehouseId:v.warehouseId,ingredientId:v.ingredientId,date:v.date,savedAt:v.savedAt||'',countBase:Number(v.baseQty),movementBase:0,modelledSalesBase:0,actualBase:Number(v.baseQty),estimatedBase:Number(v.baseQty)});}
 const moves=stockMovements.filter(m=>validDate(m.date)&&m.date<=asOf&&Number.isFinite(Number(m.qtyBase)));
 for(const m of moves){for(const [warehouseId,sign] of [[m.fromWarehouseId,-1],[m.toWarehouseId,1]]){
   if(!warehouseId)continue;const row=known.get(key(warehouseId,m.ingredientId));if(!row||!isAfter(m,row))continue;row.movementBase+=sign*Number(m.qtyBase);row.actualBase+=sign*Number(m.qtyBase);row.estimatedBase+=sign*Number(m.qtyBase);
 }}
 const errors=[];const recipeMap=new Map(recipes.map(r=>[r.productId,r]));const ingMap=new Map(ingredients.map(i=>[i.id,i]));
 if(includeSalesUsage){for(const sale of dailySales){if(!validDate(sale.date)||sale.date>asOf||!Number.isFinite(Number(sale.quantity))||Number(sale.quantity)<=0)continue;const recipe=recipeMap.get(sale.productId);if(!recipe)continue;const portions=Number(recipe.yieldPortions);if(!(portions>0))continue;for(const line of recipe.lines||[]){const ing=ingMap.get(line.ingredientId);if(!ing)continue;const base=V4.convert(line.amount,line.unit,V4.baseUnit(ing.packUnit));const waste=Number(line.wastePct??ing.wastePct??0);if(base===null||!(waste>=0&&waste<100))continue;
 const wh=assignments[ing.id] || (()=>{const w=[...known.values()].filter(r=>r.ingredientId===ing.id).map(r=>r.warehouseId);return w.length===1?w[0]:null;})();
 if(!wh){errors.push({ingredientId:ing.id,reason:'Keine eindeutige Lagerzuordnung'});continue;}
 const row=known.get(key(wh,ing.id));if(!row){errors.push({ingredientId:ing.id,reason:'Keine Inventur im zugeordneten Lager'});continue;}
 // A daily sale on the inventory date cannot be reliably sequenced. Ignore to prevent false double deductions.
 if(sale.date<=row.date)continue;
 const usage=Number(sale.quantity)*base/(1-waste/100)/portions;
 row.modelledSalesBase+=usage;row.estimatedBase-=usage;
 }}}
 const rows=[...known.values()].map(r=>({...r,countBase:round(r.countBase),movementBase:round(r.movementBase),modelledSalesBase:round(r.modelledSalesBase),actualBase:round(r.actualBase),estimatedBase:round(r.estimatedBase),negative:r.estimatedBase<-.0001}));
 const virtualCounts=rows.map(r=>({date:asOf,warehouseId:r.warehouseId,ingredientId:r.ingredientId,baseQty:Math.max(0,round(r.estimatedBase)),savedAt:asOf+'T23:59:59.999Z'}));
 return {rows,virtualCounts,unknown:ingredients.filter(i=>!rows.some(r=>r.ingredientId===i.id)).map(i=>i.id),errors,asOf};
}
function orderStats(orders){const all=orders||[];return {draft:all.filter(x=>x.status==='draft').length,ordered:all.filter(x=>x.status==='ordered').length,received:all.filter(x=>x.status==='received').length,openTotal:round(all.filter(x=>['draft','ordered'].includes(x.status)).reduce((s,o)=>s+(o.lines||[]).reduce((t,l)=>t+Number(l.packs)*Number(l.packCostNet||0),0),0))};}
function receiveOrder(order,warehouses,ingredients,date,recordedAt){if(!order||order.status!=='ordered')throw Error('Nur als bestellt markierte Bestellungen können angenommen werden.');if(!validDate(date))throw Error('Ungültiges Wareneingangsdatum');const wids=new Set(warehouses.map(x=>x.id)),im=new Map(ingredients.map(x=>[x.id,x]));const movements=[];
 for(const [index,l]of (order.lines||[]).entries()){
   if(!im.has(l.ingredientId)||!wids.has(l.warehouseId)||!(Number(l.packs)>0))throw Error('Bestellposition ungültig');const pack=V4.baseQuantity(Number(l.packQty),l.packUnit);if(!(pack>0))throw Error('Gebinde ungültig');movements.push({id:order.id+'-receipt-'+index,type:'receipt',date,recordedAt,ingredientId:l.ingredientId,fromWarehouseId:'',toWarehouseId:l.warehouseId,qtyBase:round(Number(l.packs)*pack),orderId:order.id,note:'Wareneingang Bestellung '+order.code});
 }
 return movements;
}
function readiness({items=[],ingredients=[],recipes=[],warehouses=[],inventoryCounts=[],dailySales=[],sales=[]}){
 const links=recipes.filter(r=>items.some(i=>i.id===r.productId));const inv=inventoryCounts.length;return [
 {id:'items',title:'Produkte hinterlegen',ready:items.length>0,view:'menuimport',hint:`${items.length} Produkte`},
 {id:'ingredients',title:'Rohwaren & Einkaufspreise',ready:ingredients.length>0,view:'recipes',hint:`${ingredients.length} Rohwaren`},
 {id:'recipes',title:'Rezepturen verknüpfen',ready:links.length>0,view:'recipes',hint:`${links.length} Rezepte`},
 {id:'warehouses',title:'Lager einrichten',ready:warehouses.length>0,view:'inventory',hint:`${warehouses.length} Lager`},
 {id:'counts',title:'Erste Inventur durchführen',ready:inv>0,view:'inventory',hint:`${inv} Zählungen`},
 {id:'sales',title:'Tagesabsatz importieren',ready:dailySales.length>0,view:'purchasing',hint:`${dailySales.length} Verkaufszeilen`}
 ];
}
return {inventoryState,orderStats,receiveOrder,readiness,validDate,round};
});
