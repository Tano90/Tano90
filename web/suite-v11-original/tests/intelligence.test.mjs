import {test} from 'node:test';import assert from 'node:assert/strict';
import {readPosImport,aggregateFunnel,compareMarket,scoreQuiz,STAGES} from '../public/intelligence.mjs';
import {initializeIntelligence} from '../public/intelligence-ui.mjs';
const outlets=[{id:'o1',name:'Restaurant'}],products=[{id:'p1',name:'Burger',unit_cost_net:4,vat_percent:7},{id:'p2',name:'Aperitif',unit_cost_net:3,vat_percent:19}];
const hash='a'.repeat(64);
const csv='Datum;BonID;Outlet;Produkt;Menge;Bruttopreis;Gaeste;FunnelStufe\n2026-10-20;A01;Restaurant;Burger;2;21,40;2;none\n2026-10-20;A01;Restaurant;Aperitif;1;10,00;2;aperitif\n2026-10-20;A02;Restaurant;Burger;2;21,40;3;none\n';
function parse(s=csv){return readPosImport(s,hash,'pos.csv',products,outlets);}
test('day POS parse keeps receipt id & verified VAT and cost',()=>{const r=parse();assert.equal(r.errors.length,0);assert.equal(r.valid.length,3);assert.equal(r.valid[0].unit_cost_net,4);assert.equal(r.valid[1].vat_percent,19);});
test('POS refuses monthly aggregated rows without receipt and day',()=>{const a=readPosImport('Produkt;Outlet;Monat;Menge;Bruttopreis\nBurger;Restaurant;2026-10;200;20',hash,'old.csv',products,outlets);assert.match(a.errors.join(' '),/datum|bonid/);assert.equal(a.valid.length,0);});
test('receipt denominator is unique checks, covers sum once per receipt',()=>{const a=aggregateFunnel(parse().valid);assert.equal(a.checkCount,2);assert.equal(a.covers,5);const ap=a.stages.find(x=>x.id==='aperitif');assert.equal(ap.checks,1);assert.equal(ap.rate,.5);assert.ok(a.gross>90);});
test('Funnel costs and scenario from real stage item',()=>{const a=aggregateFunnel(parse().valid,{targets:{aperitif:1}}),ap=a.stages.find(x=>x.id==='aperitif');assert.equal(ap.extraChecks,1);assert.ok(ap.dbPotential>0);assert.ok(Math.abs(ap.unitNet-(10/1.19))<1e-9);});
test('no contribution margin invented if stage cost missing',()=>{const parsed=parse();parsed.valid[1].unit_cost_net=null;const a=aggregateFunnel(parsed.valid,{targets:{aperitif:1}});assert.equal(a.margin,null);assert.equal(a.stages[0].dbPotential,null);});
test('missing guests are not automatically equated with receipts',()=>{const r=parse();r.valid.forEach(x=>x.guests=null);const a=aggregateFunnel(r.valid);assert.equal(a.covers,null);assert.equal(a.guestComplete,false);});
test('inconsistent same check guest numbers flagged',()=>{const str=csv.replace('Aperitif;1;10,00;2;aperitif','Aperitif;1;10,00;4;aperitif');assert.match(parse(str).errors.join(' '),/unterschiedliche Gästezahl/);});
test('date validation rejects invalid calendar date',()=>{const str=csv.replace('2026-10-20','2026-02-30');assert.ok(parse(str).errors.some(x=>x.includes('Datum')));});
test('outlet must match master data',()=>{const str=csv.replace('A01;Restaurant','A01;Fremd');assert.ok(parse(str).errors.some(x=>x.includes('Outlet')));});
test('market observations need source and date and positive price',()=>{const x=compareMarket([{competitor_name:'Cafe',own_product:'Burger',competitor_product:'Burger',our_price_gross:20,competitor_price_gross:25,source_url:'https://example.com',checked_on:'2026-10-20'},{competitor_name:'No Proof',our_price_gross:10,competitor_price_gross:20}],products);assert.equal(x.length,1);assert.equal(x[0].delta,-20);});
test('quiz correct and wrong XP deterministic',()=>{const s=STAGES[0];assert.equal(scoreQuiz(s.id,s.answer).points,100);assert.equal(scoreQuiz(s.id,2).points,0);});
test('old app data fields retained on extension',()=>{const d={outlets,products,sales:[],inventory:[],tasks:[]};initializeIntelligence(d,'demo');assert.ok(d.sales);assert.ok(d.intelligence.pos.length>0);});
