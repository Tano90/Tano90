/* GLB v0.8 - navigation grants. Security MUST additionally be enforced in Supabase SQL. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.GLBAccess=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const ALL=['myday','overview','operations','setup','products','groups','costs','outlets','market','funnel','menuimport','recipes','inventory','stockledger','orders','purchasing','lifecycle','calculator','portfolio','insights','reports','import','settings','roadmap'];
 const CONFIG={
 owner:{label:'Inhaber / System-Owner',views:ALL},
 general_manager:{label:'Geschäftsführer',views:ALL},
 restaurant_manager:{label:'Restaurantleiter',views:ALL.filter(x=>x!=='settings')},
 service_lead:{label:'Abteilungsleitung Service',views:['myday','funnel']},
 kitchen_lead:{label:'Abteilungsleitung Küche',views:['myday','products','menuimport','recipes','inventory','stockledger','orders','purchasing']},
 sales:{label:'Sales',views:['myday','funnel','market']},
 service_staff:{label:'MA Service',views:['myday','funnel']},
 kitchen_staff:{label:'MA Küche',views:['myday','inventory']},
 editor:{label:'Bestandsrolle: Bearbeiten',views:ALL},
 viewer:{label:'Bestandsrolle: Lesen',views:['myday']}
 };
 let role=null;
 const api={
  roles:CONFIG, setRole(v){role=CONFIG[v]?v:null;},
  get role(){return role;},get enabled(){return role!==null;},
  label(v){return CONFIG[v]?.label||v||'Keine Rolle';},
  canView(v){return role===null || CONFIG[role].views.includes(v);},
  defaultView(){return role && ['owner','general_manager','restaurant_manager','editor'].includes(role)?'operations':'myday';},
  canManageUsers(){return ['owner','general_manager'].includes(role);},
  isPrivileged(){return ['owner','general_manager','restaurant_manager','editor'].includes(role);},
  writableKeys(){const x={service_staff:['funnel'],service_lead:['funnel','sales','dailySales'],sales:['funnel','sales','dailySales','market','marketDiscovered','marketLastScan'],kitchen_staff:['inventoryCounts'],kitchen_lead:['items','ingredients','recipes','warehouses','inventoryCounts','stockMovements','ingredientWarehouses','purchaseOrders','dailySales','v04Forecast']};return x[role]||[];}
 };
 return api;
});
