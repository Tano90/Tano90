/* Reliable, conservative extraction of article-price pairs from copied or PDF text.
   No AI/OCR is claimed here: image-only menu pages are not text-readable. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.GLBMenu08=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const trim=s=>String(s??'').replace(/\s+/g,' ').trim();
 const number=s=>{let x=String(s??'').replace(/[^\d.,]/g,'');if(x.includes(',')&&x.includes('.'))x=x.lastIndexOf(',')>x.lastIndexOf('.')?x.replace(/\./g,'').replace(',','.'):x.replace(/,/g,'');else x=x.replace(',','.');return Number(x);};
 const norm=s=>trim(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const amount='(?:\\d{1,4}(?:[.,]\\d{1,2})?)';
 const trailing=new RegExp('^(.{2,165}?)\\s*(?:[.·•\\-]{2,}\\s*|\\s{2,}|\\s+)('+amount+')\\s*(?:€|EUR)?\\s*$', 'i');
 const leading=new RegExp('^(?:€|EUR)\\s*('+amount+')\\s+(.{2,165})$', 'i');
 const priceOnly=new RegExp('^(?:€|EUR)?\\s*('+amount+')\\s*(?:€|EUR)?$', 'i');
 const headings=/^(?:VORSPEISEN|HAUPTGERICHTE|SUPPEN|SALATE|BOWLS|BURGER|GRILL|STEAKS|FISCH|DESSERTS|GETRÄNKE|ALKOHOLFREI|WEINE|KAFFEE|TEE|PASTA|BEILAGEN|SIDES|SNACKS|FRÜHSTÜCK|KIDS|APERITIF|COCKTAILS|SPEISEN|MENÜS|STARTERS|MAINS|DESSERT|PIZZA|SWEETS|SIGNATURES|SPECIALS)$/i;
 const isDescription=s=>trim(s).length>160 || /\b(?:allergene|enthält|zutaten|serviert mit|inklusive|auf wunsch|frisch zubereitet)\b/i.test(s);
 function parseText(input,{vat=19}={}){
  const lines=String(input||'').replace(/\r/g,'\n').split('\n').map(trim).filter(Boolean),rows=[],errors=[];
  let category='Speisekarte',pending='';
  const add=(name,raw,source)=>{name=trim(name).replace(/^[\s•·\-*0-9.)]+/,'').replace(/[.·\s-]+$/,'');const price=number(raw);
   if(name.length<3||name.length>120||isDescription(name)||!Number.isFinite(price)||price<=0||price>9999){errors.push(source);return false;}
   rows.push({name,category,grossPrice:price,vat,unit:'Portion'});return true;};
  for(let i=0;i<lines.length;i++){
   const line=lines[i];
   if(headings.test(line)){category=line;pending='';continue;}
   if(line.length<3)continue;
   let match=line.match(trailing);if(match){add(match[1],match[2],line);pending='';continue;}
   match=line.match(leading);if(match){add(match[2],match[1],line);pending='';continue;}
   // European menu layouts often split dish and price across two separate lines.
   match=line.match(priceOnly);
   if(match && pending){add(pending,match[1],pending+' / '+line);pending='';continue;}
   if(/^\d+(?:[,\.]\d{1,2})?\s*€?$/.test(line)) {errors.push('Preis ohne Produkt: '+line);continue;}
   if(!/\d{4}|\b(?:www\.|@|tel\.|reservierung)\b/i.test(line)&&line.length<=95&&!isDescription(line))pending=line;
  }
  return {rows:dedupe(rows),errors};
 }
 function dedupe(rows){const seen=new Set();return rows.filter(x=>{const k=norm(x.category)+'|'+norm(x.name)+'|'+x.grossPrice;if(seen.has(k))return false;seen.add(k);return true;});}
 function parseCSV(input){
  const V=typeof window!=='undefined'?window.GLBV04:require('./v04core.js');
  const table=V.parseTable(input),head=table.shift();if(!head)throw Error('CSV ohne Überschriften');
  const aliases={name:['produkt','artikel','artikelname','produktname','gericht','bezeichnung','speise','name','item'],price:['bruttopreis','preis','vkbrutto','verkaufspreis','vkp','preisbrutto','price','verkaufspreisbrutto'],category:['kategorie','warengruppe','rubrik','gruppe','category'],vat:['ust','mwst','steuer','steuerprozentsatz','vat'],unit:['einheit','portion','portionseinheit','unit']};
  const index=(names)=>head.findIndex(h=>names.includes(norm(h)));
  const pos=Object.fromEntries(Object.entries(aliases).map(([k,v])=>[k,index(v)]));
  if(pos.name<0||pos.price<0)throw Error('Spalten Produkt/Artikel und Preis/Bruttopreis fehlen. Bitte GLB-Vorlage nutzen.');
  const rows=[],errors=[];
  table.forEach((r,i)=>{const name=trim(r[pos.name]);const price=number(r[pos.price]);let vat=pos.vat<0||!trim(r[pos.vat])?19:number(r[pos.vat]);
   if(vat===.07)vat=7;if(vat===.19)vat=19;
   if(name.length<3||name.length>120||!Number.isFinite(price)||price<=0||![0,7,19].includes(vat)){errors.push('Zeile '+(i+2));return;}
   rows.push({name,grossPrice:price,category:pos.category<0?'Speisekarte':trim(r[pos.category])||'Speisekarte',vat,unit:pos.unit<0?'Portion':trim(r[pos.unit])||'Portion'});
  });
  return {rows:dedupe(rows),errors};
 }
 return {parseText,parseCSV,dedupe};
});
