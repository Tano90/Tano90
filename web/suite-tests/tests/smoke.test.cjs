const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const C=require('../src/core.js');
const V4=require('../src/v04core.js'),V5=require('../src/v05core.js'),V6=require('../src/v06core.js');
const app=fs.readFileSync(require('node:path').join(__dirname,'../src/app.js'),'utf8');
for (const [view,expected] of Object.entries({overview:'Wie läuft der Betrieb?',products:'Artikel &amp; Umsätze',calculator:'Preiskalkulation',portfolio:'Renner &amp; Penner',insights:'Dein digitaler Analyse-Assistent',import:'CSV-Datei importieren',settings:'Datensicherung',roadmap:'GLB Workforce'})) {
 test('Der Bildschirm '+view+' wird ohne JavaScript-Fehler gerendert',()=>{
  const nodes={};const el=(id)=>nodes[id]??(nodes[id]={innerHTML:'',textContent:'',addEventListener(){},classList:{add(){},remove(){},toggle(){}}});
  const document={querySelector:el,querySelectorAll:()=>[],addEventListener(){}};
  const window={GLBCore:C,GLBV04:V4,GLBV05:V5,GLBV06:V6,addEventListener(){},scrollTo(){}};
  const localStorage={getItem(){return null;},setItem(){}};
  const ctx={window,document,localStorage,location:{hash:'#'+view},Intl,Number,Math,JSON,console,Date,setTimeout(){},clearTimeout(){}};
  vm.runInNewContext(app,ctx,{timeout:1000});
  assert.ok(nodes['#main'].innerHTML.includes(expected),'Missing text: '+expected);
  assert.ok(nodes['#main'].innerHTML.length>500);
 });
}

for (const [view,expected] of Object.entries({funnel:'Service Funnel &amp; Sales Forecast',groups:'Oberkategorien',costs:'Deckungsbeiträge &amp; Zielpreise',outlets:'Outlets &amp; Umsätze',market:'Mein Markt',lifecycle:'Produktlebenszyklus'})) {
 test('MVP 0.2 Bildschirm '+view+' rendert',()=>{
  const nodes={};const el=(id)=>nodes[id]??(nodes[id]={innerHTML:'',textContent:'',addEventListener(){},classList:{add(){},remove(){},toggle(){}}});
  const document={querySelector:el,querySelectorAll:()=>[],addEventListener(){}};
  const window={GLBCore:C,GLBV04:V4,GLBV05:V5,GLBV06:V6,addEventListener(){},scrollTo(){}};
  const ctx={window,document,localStorage:{getItem(){return null;},setItem(){}},location:{hash:'#'+view},Intl,Number,Math,JSON,console,Date,setTimeout(){},clearTimeout(){}};
  vm.runInNewContext(app,ctx,{timeout:1500});
  assert.ok(nodes['#main'].innerHTML.includes(expected),'Fehlende Bildschirmüberschrift: '+expected);
  assert.ok(nodes['#main'].innerHTML.length>500);
 });
}
