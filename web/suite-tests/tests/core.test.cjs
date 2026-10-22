const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../src/core.js');
const near=(a,b,eps=.000001)=>assert.ok(Math.abs(a-b)<eps, `${a} ≉ ${b}`);

test('Preiskalkulation: 6 Euro Kosten, 30% Ziel-WE, 7% USt = 21,40 Euro brutto',()=>near(C.suggestedPrice(6,30,7),21.4));
test('Preiskalkulation mit 19% USt',()=>near(C.suggestedPrice(6,30,19),23.8));
test('Unzulässiger Ziel-WE wird abgewiesen',()=>{assert.equal(C.suggestedPrice(5,0,7),null);assert.equal(C.suggestedPrice(5,110,7),null);});
test('Kennzahlen sind netto und mengen-gewichtet',()=>{
 const items=[{name:'Speise',quantity:2,grossPrice:10.7,costNet:3,vat:7},{name:'Getränk',quantity:1,grossPrice:11.9,costNet:2,vat:19}];
 const m=C.totals(items);
 near(m.revenueNet,30);near(m.totalCostNet,8);near(m.contribution,22);near(m.foodCostPct,8/30*100);
});
test('Negativer Deckungsbeitrag bleibt sichtbar',()=>{
 const m=C.metrics({quantity:2,grossPrice:5.35,costNet:7,vat:7});
 near(m.contributionUnit,-2);near(m.contribution,-4);
});
test('Median Split unterscheidet vier Quadranten',()=>{
 const data=[{id:1,name:'Star',quantity:100,grossPrice:21.4,costNet:2,vat:7},{id:2,name:'Renner',quantity:90,grossPrice:10.7,costNet:7,vat:7},{id:3,name:'Schläfer',quantity:10,grossPrice:21.4,costNet:2,vat:7},{id:4,name:'Penner',quantity:5,grossPrice:10.7,costNet:7,vat:7}];
 const vals=Object.fromEntries(C.classify(data).list.map(x=>[x.name,x.quadrant]));
 assert.deepEqual(vals,{Star:'star',Renner:'runner',Schläfer:'sleeper',Penner:'loser'});
});
test('Deutsche Zahlen werden korrekt gelesen',()=>{near(C.parseNumberDE('1.234,56 €'),1234.56);near(C.parseNumberDE('17,90'),17.9);near(C.parseNumberDE('17.90'),17.9);assert.ok(Number.isNaN(C.parseNumberDE('foo')));});
test('CSV Semikolon und Dezimal-Komma',()=>{
 const csv='Produkt;Kategorie;Menge;Bruttopreis;Wareneinsatz netto;USt\n"Burger; Premium";Burger;120;17,90;4,50;7';
 const parsed=C.parseCSV(csv);assert.equal(parsed.items.length,1);assert.equal(parsed.items[0].name,'Burger; Premium');near(parsed.items[0].grossPrice,17.9);
});
test('CSV Komma mit quotierten Dezimalzahlen',()=>{
 const csv='Produkt,Menge,Bruttopreis,Wareneinsatz netto,USt\nSteak,23,"29,50","12,30",7';
 const parsed=C.parseCSV(csv);assert.equal(parsed.items.length,1);near(parsed.items[0].costNet,12.3);
});
test('CSV meldet fehlerhafte Zeilen und importiert gültige',()=>{
 const csv='Produkt;Menge;Bruttopreis;Wareneinsatz netto;USt\nGut;10;19,90;5,00;7\nSchlecht;abc;19,90;5,00;7';
 const x=C.parseCSV(csv);assert.equal(x.items.length,1);assert.equal(x.errors.length,1);
});
test('CSV weist unvollständige Kopfzeile ab',()=>assert.throws(()=>C.parseCSV('Produkt;Menge\nX;5'),/Pflichtspalte/));
test('Hinweise referenzieren reale Produkttitel aus den übergebenen Daten',()=>{
 const data=[{name:'ItemOne',quantity:100,grossPrice:10.7,costNet:8,vat:7},{name:'ItemTwo',quantity:1,grossPrice:10.7,costNet:2,vat:7}];
 const i=C.insights(data,30);assert.ok(i.length>0);assert.ok(i.some(x=>(x.title+' '+x.detail).includes('ItemOne')||(x.title+' '+x.detail).includes('ItemTwo')));
});

test('DB I, DB II und Schwund werden getrennt berechnet',()=>{
 const p={name:'Testgericht',quantity:10,grossPrice:10.7,vat:7,costDetail:{ingredientsNet:3,wastePct:10,packagingNet:.5,laborNet:.75,feesNet:.25,otherNet:.2}};
 const c=C.costBreakdown(p),m=C.metrics(p);
 near(c.goodsNet,3.3);near(c.variableNet,5);near(m.db1Unit,6.7);near(m.contributionUnit,5);near(m.db1,67);near(m.db2,50);
});
test('Outlet- und Monatsumsatz berücksichtigt transaktionsbezogene Preise',()=>{
 const products=[{id:'x',name:'Drink',category:'Bar',vat:19,costNet:2,grossPrice:12,quantity:0}];
 const rows=[{id:'a',productId:'x',outletId:'bar',month:'2026-08',quantity:5,grossPrice:11.9},{id:'b',productId:'x',outletId:'restaurant',month:'2026-08',quantity:3,grossPrice:23.8}];
 const whole=C.reportSales(rows,products);near(whole.revenueNet,110);near(whole.db1,94);near(C.reportSales(rows,products,{outletId:'bar'}).revenueNet,50);near(C.reportSales(rows,products,{month:'2026-08',outletId:'restaurant'}).db2,54);
});
test('Lebenszyklus-Trend unterscheidet Wachstum, Reife, Rückgang und fehlende Monate',()=>{
 const sale=(month,quantity)=>({productId:'a',month,quantity});
 const growth=[sale('2026-04',10),sale('2026-05',10),sale('2026-06',20),sale('2026-07',20)];
 assert.equal(C.lifecycle(growth,'a').phase,'growth');near(C.lifecycle(growth,'a').changePct,100);
 assert.equal(C.lifecycle(growth.map((x,i)=>({...x,quantity:10})),'a').phase,'maturity');
 assert.equal(C.lifecycle(growth.map((x,i)=>({...x,quantity:i<2?20:5})),'a').phase,'decline');
 assert.equal(C.lifecycle([sale('2026-04',10),sale('2026-05',10),sale('2026-07',20),sale('2026-08',20)],'a').phase,'incomplete');
 assert.equal(C.lifecycle([sale('2026-07',5)],'a','2026-07').phase,'introduction');
 assert.equal(C.lifecycle([sale('2026-07',5)],'a').phase,'insufficient');
});
test('Marktvergleich verlangt identische Einheiten',()=>{
 const same=C.marketComparison(15,12,'250 g','250 g');
 assert.equal(same.comparable,true);near(same.differencePct,25);
 assert.equal(C.marketComparison(15,12,'250 g','300 g').comparable,false);
 assert.equal(C.marketComparison(15,0,'250 g','250 g').difference,null);
});
