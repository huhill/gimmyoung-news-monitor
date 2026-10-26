import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
const allow={limit:async()=>({success:true})};
const env={COLLECT_IP_LIMITER:allow,COLLECT_TOTAL_LIMITER:allow,NAVER_CLIENT_ID:'test-id',NAVER_CLIENT_SECRET:'test-secret',ASSETS:{fetch:async()=>new Response('app')}};
const req=(body={start:'2026-10-19',end:'2026-10-25'},origin='https://monitor.example')=>new Request('https://monitor.example/api/collect',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify(body)});
test('public page and config do not require a password or reveal secrets',async()=>{
 assert.equal(await(await worker.fetch(new Request('https://monitor.example/'),env)).text(),'app');
 const r=await worker.fetch(new Request('https://monitor.example/api/config'),env);assert.equal(r.status,200);const text=await r.text();assert.ok(!text.includes('test-secret'));assert.ok(!text.includes('test-id'));assert.match(r.headers.get('X-Robots-Tag'),/noindex/);
});
test('IP and aggregate limits block collection, missing limiter fails closed',async()=>{
 const deny={limit:async()=>({success:false})};
 for(const e of [{...env,COLLECT_IP_LIMITER:deny},{...env,COLLECT_TOTAL_LIMITER:deny}]){const r=await worker.fetch(req(),e);assert.equal(r.status,429);assert.equal(r.headers.get('Retry-After'),'60');}
 assert.equal((await worker.fetch(req(),{})).status,503);
});
test('method, origin, oversized body and invalid dates rejected',async()=>{
 assert.equal((await worker.fetch(new Request('https://monitor.example/api/collect'),env)).status,405);
 assert.equal((await worker.fetch(req(undefined,'https://evil.example'),env)).status,403);
 assert.equal((await worker.fetch(req({start:'invalid',end:'2026-10-25'}),env)).status,400);
 assert.equal((await worker.fetch(req({large:'x'.repeat(2000)}),env)).status,400);
});
test('missing Naver keys gives actionable error',async()=>{
 const r=await worker.fetch(req(),{...env,NAVER_CLIENT_SECRET:''});assert.equal(r.status,503);assert.match(await r.text(),/NAVER_CLIENT_SECRET/);
});
test('same range uses five-minute cache, different range fetches again, expired entry refetches',async()=>{
 const originalFetch=globalThis.fetch,originalCache=globalThis.caches;const map=new Map();let count=0;
 globalThis.caches={default:{match:async r=>map.get(r.url)?.clone(),put:async(r,response)=>{map.set(r.url,response.clone());}}};
 globalThis.fetch=async()=>{count++;return Response.json({total:1,items:[{title:'김영사 신간',description:'김영사',pubDate:'2026-10-20T00:00:00+09:00',link:'https://news.example/a',originallink:'https://news.example/a'}]});};
 try{
  const first=await(await worker.fetch(req(),env)).json();assert.equal(first.cached,false);assert.equal(count,3);
  const again=await(await worker.fetch(req(),env)).json();assert.equal(again.cached,true);assert.equal(count,3);assert.equal(again.collectedAt,first.collectedAt);
  await worker.fetch(req({start:'2026-10-20',end:'2026-10-25'}),env);assert.equal(count,6);
  const cacheKey='https://monitor.example/__news_cache_hub_v2/2026-10-19/2026-10-25';map.set(cacheKey,Response.json({...first,cacheUntil:'2000-01-01T00:00:00Z'}));
  assert.equal((await(await worker.fetch(req(),env)).json()).cached,false);assert.equal(count,9);
 }finally{globalThis.fetch=originalFetch;globalThis.caches=originalCache;}
});
test('Naver auth failure is not cached as a successful empty report',async()=>{
 const originalFetch=globalThis.fetch,originalCache=globalThis.caches;let puts=0;
 globalThis.caches={default:{match:async()=>undefined,put:async()=>{puts++;}}};globalThis.fetch=async()=>new Response('',{status:401});
 try{const r=await(await worker.fetch(req(),env)).json();assert.equal(puts,0);assert.ok(r.statuses.every(x=>x.state==='error'));assert.match(r.statuses[0].detail,/인증키/);}finally{globalThis.fetch=originalFetch;globalThis.caches=originalCache;}
});
