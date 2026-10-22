const KEY='glb_v1_demo_local_state';
const ID=()=>crypto.randomUUID();
export function makeDemo(){
  const outletId='demo-outlet-restaurant';
  const barId='demo-outlet-bar';
  const products=[
    {id:'demo-p-1',name:'Cheeseburger',vat_percent:7,unit_cost_net:4.60},
    {id:'demo-p-2',name:'Hüftsteak',vat_percent:7,unit_cost_net:9.30},
    {id:'demo-p-3',name:'Salat Bowl',vat_percent:7,unit_cost_net:2.90},
    {id:'demo-p-4',name:'Signature Cocktail',vat_percent:19,unit_cost_net:2.70},
    {id:'demo-p-5',name:'Apfelstrudel',vat_percent:7,unit_cost_net:null},
  ];
  const sales=[
    ['demo-p-1',outletId,75,19.5,4.60,7],['demo-p-2',outletId,49,29.5,9.30,7],
    ['demo-p-3',outletId,28,9.80,2.90,7],['demo-p-4',barId,61,9.5,2.70,19],
    ['demo-p-5',outletId,19,10.20,null,7]
  ].map(([product_id,outlet_id,quantity,unit_price_gross,unit_cost_net,vat_percent],i)=>({id:`demo-sale-${i}`,product_id,outlet_id,month:'2026-10-01',quantity,unit_price_gross,unit_cost_net,vat_percent,source_hash:'demo',line_no:i+1}));
  return {demo:true,outlets:[{id:outletId,name:'Restaurant'},{id:barId,name:'Bar'}],products,sales,
    inventory:[{id:ID(),name:'Rinderhüfte',unit:'kg',stock:9,reorder_point:12,par_level:30,supplier:'Lieferant hinterlegen'},
      {id:ID(),name:'Burger Buns',unit:'Stück',stock:68,reorder_point:30,par_level:90,supplier:''},
      {id:ID(),name:'Gin',unit:'Flaschen',stock:3,reorder_point:5,par_level:12,supplier:''}],
    tasks:[{id:ID(),title:'Wareneinsatz Apfelstrudel hinterlegen',priority:'high',status:'open',due_on:'2026-10-23'},
      {id:ID(),title:'Rinderhüfte nachbestellen',priority:'high',status:'open',due_on:'2026-10-22'},
      {id:ID(),title:'Wochenreport prüfen',priority:'medium',status:'done',due_on:'2026-10-21'}]};
}
export const getLocal=()=>{try {const obj=JSON.parse(localStorage.getItem(KEY)||'null');return obj&&Array.isArray(obj.products)?obj:makeDemo();}catch{return makeDemo();}};
export const setLocal=data=>localStorage.setItem(KEY,JSON.stringify(data));
export const resetLocal=()=>{const data=makeDemo();setLocal(data);return data;};
export const uuid=ID;
