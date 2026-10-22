import {test} from 'node:test';import assert from 'node:assert/strict';
import worker,{verifySignature} from '../src/worker.mjs';
test('Webhook verification must reject missing/invalid headers',async()=>{
 assert.equal(await verifySignature('data',null,'a'.repeat(64)),false);
 assert.equal(await verifySignature('data','sha256='+'0'.repeat(64),'a'.repeat(64)),false);
});
test('HMAC SHA-256 verification accepts only exact body',async()=>{
 const secret='x'.repeat(40);const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('payload'));
 const header='sha256='+[...new Uint8Array(signature)].map(x=>x.toString(16).padStart(2,'0')).join('');assert.equal(await verifySignature('payload',header,secret),true);assert.equal(await verifySignature('payload2',header,secret),false);
});
test('AI API denies without configured Supabase secrets',async()=>{const request=new Request('https://glb.test/api/market/analyze',{method:'POST',headers:{origin:'https://glb.test','content-type':'application/json'},body:JSON.stringify({org:'00000000-0000-0000-0000-000000000001'})});const res=await worker.fetch(request,{});assert.equal(res.status,503);});
test('POS webhook requires configured ingress secret',async()=>{const request=new Request('https://glb.test/api/pos/ingest',{method:'POST',body:'{}'});const res=await worker.fetch(request,{});assert.equal(res.status,503);});
test('POS webhook denies invalid HMAC even with staging config',async()=>{const request=new Request('https://glb.test/api/pos/ingest',{method:'POST',body:'{}'});const res=await worker.fetch(request,{POS_INGEST_SECRET:'x'.repeat(40),POS_INGEST_ORG:'00000000-0000-0000-0000-000000000001',SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'secret'});assert.equal(res.status,403);});
