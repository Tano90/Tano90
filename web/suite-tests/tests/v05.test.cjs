'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const V5=require('../src/v05core.js');
const ingredients=[{id:'beef',name:'Rind',packQty:1,packUnit:'kg',packCostNet:20,wastePct:0,minimumBase:50}];
const warehouses=[{id:'kitchen',name:'Küche'},{id:'bar',name:'Bar'}];
const counts=[{ingredientId:'beef',warehouseId:'kitchen',baseQty:100,date:'2026-10-01',savedAt:'2026-10-01T08:00:00.000Z'},
 {ingredientId:'beef',warehouseId:'bar',baseQty:0,date:'2026-10-01',savedAt:'2026-10-01T08:00:00.000Z'}];
const m=(type,qty,from,to,date='2026-10-02')=>({type,qtyBase:qty,ingredientId:'beef',fromWarehouseId:from,toWarehouseId:to,date,recordedAt:date+'T09:00:00.000Z'});
const base={ingredients,warehouses,inventoryCounts:counts,recipes:[{productId:'burger',yieldPortions:1,lines:[{ingredientId:'beef',amount:10,unit:'g'}]}],dailySales:[{date:'2026-10-03',productId:'burger',quantity:2}],assignments:{beef:'kitchen'},asOf:'2026-10-20'};
test('incoming, transfer, waste and modeled consumption apply only after the latest count',()=>{
 const r=V5.inventoryState({...base,stockMovements:[m('receipt',25,'','kitchen'),m('waste',10,'kitchen',''),m('transfer',20,'kitchen','bar')]});
 assert.equal(r.rows.find(x=>x.warehouseId==='kitchen').actualBase,95);
 assert.equal(r.rows.find(x=>x.warehouseId==='kitchen').estimatedBase,75);
 assert.equal(r.rows.find(x=>x.warehouseId==='bar').estimatedBase,20);
 assert.equal(r.virtualCounts.length,2);
});
test('bookings before the latest inventory are not counted a second time',()=>{
 const r=V5.inventoryState({...base,stockMovements:[m('receipt',1000,'','kitchen','2026-09-30')]});
 assert.equal(r.rows.find(x=>x.warehouseId==='kitchen').actualBase,100);
});
test('same day of physical count excludes daily sales because sale time is ambiguous',()=>{
 const r=V5.inventoryState({...base,dailySales:[{date:'2026-10-01',productId:'burger',quantity:9}]});
 assert.equal(r.rows.find(x=>x.warehouseId==='kitchen').estimatedBase,100);
});
test('ambiguous multi-warehouse sales remain unallocated without explicit assignment',()=>{
 const r=V5.inventoryState({...base,assignments:{}});
 assert.equal(r.rows.find(x=>x.warehouseId==='kitchen').estimatedBase,100);
 assert.ok(r.errors.length>=1);
});
test('missing physical inventory stays unknown even with a receipt',()=>{
 const r=V5.inventoryState({...base,inventoryCounts:[],stockMovements:[m('receipt',200,'','kitchen')]});
 assert.equal(r.rows.length,0);
 assert.deepEqual(r.unknown,['beef']);
});
test('ordered PO creates physical movement exactly once with expected quantity',()=>{
 const order={id:'o1',code:'GLB-1',status:'ordered',lines:[{ingredientId:'beef',warehouseId:'kitchen',packs:3,packQty:1,packUnit:'kg'}]};
 const rows=V5.receiveOrder(order,warehouses,ingredients,'2026-10-20','2026-10-20T13:00:00.000Z');
 assert.equal(rows.length,1);assert.equal(rows[0].qtyBase,3000);assert.equal(rows[0].id,'o1-receipt-0');
 assert.throws(()=>V5.receiveOrder({...order,status:'received'},warehouses,ingredients,'2026-10-20','2026-10-20T13:00:00.000Z'));
});
test('validate real calendar days',()=>{assert.equal(V5.validDate('2026-02-30'),false);assert.equal(V5.validDate('2026-10-20'),true);});
test('order stats exclude received and cancelled volume from open commitments',()=>{
 const line=[{packs:2,packCostNet:4}];const stat=V5.orderStats([{status:'draft',lines:line},{status:'ordered',lines:line},{status:'received',lines:line},{status:'cancelled',lines:line}]);
 assert.equal(stat.openTotal,16);assert.equal(stat.ordered,1);
});
test('onboarding reports missing data without assuming it is complete',()=>{
 const r=V5.readiness({items:[],ingredients:[],recipes:[],warehouses:[],inventoryCounts:[],dailySales:[]});assert.equal(r.length,6);assert.equal(r.filter(x=>x.ready).length,0);
});
