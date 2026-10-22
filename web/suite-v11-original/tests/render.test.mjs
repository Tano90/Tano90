import {test} from 'node:test';import assert from 'node:assert/strict';

test('App starts with mock browser bindings and all core screens render',async()=>{
 const data=new Map();
 globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 globalThis.sessionStorage={getItem:k=>data.get('session:'+k)||null,setItem:(k,v)=>data.set('session:'+k,v),removeItem:k=>data.delete('session:'+k)};
 globalThis.location={protocol:'http:'};Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});globalThis.window={scrollTo:()=>{}};
 const listeners={};
 const root={innerHTML:'',addEventListener:(name,fn)=>listeners[name]=fn};
 globalThis.document={querySelector:s=>s==='#app'?root:null};
 await import('../public/app.js');
 assert.match(root.innerHTML,/Management Cockpit/);
 assert.match(root.innerHTML,/Beispieldaten/);
 const target=page=>({closest:selector=>selector==='[data-page]'?{dataset:{page}}:null});
 for(const [page,needle] of [['sales','Neuen Import vorbereiten'],['menu','Artikelperformance'],['inventory','Bestandsübersicht'],['tasks','Aufgabenliste'],['settings','Supabase Verbindung'],['funnel','Daily Sales Funnel'],['market','KI-Marktcheck'],['training','Funnel Quest'],['legacy','Vorherige GLB-Module']]){
  await listeners.click({target:target(page)});
  assert.match(root.innerHTML,new RegExp(needle),page);
 }
});
