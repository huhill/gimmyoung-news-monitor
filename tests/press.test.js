import test from 'node:test';
import assert from 'node:assert/strict';
import { metadataPress, discoverPress } from '../src/worker.js';
test('publisher metadata supports attribute order, entities, and rejects missing names', () => {
  assert.equal(metadataPress(`<meta content='새신문 &amp; 뉴스' property='og:site_name'>`), '새신문 & 뉴스');
  assert.equal(metadataPress('<title>기사 제목 - 임의 이름</title>'), '');
  assert.equal(metadataPress('<!-- <meta property="og:site_name" content="광고"> -->'), '');
});
test('unknown publishers resolved once per host, cached, known names retained, failures preserved', async () => {
  const oldFetch=globalThis.fetch,oldCache=globalThis.caches; const map=new Map();let calls=0;
  globalThis.caches={default:{match:async r=>map.get(r.url)?.clone(),put:async(r,v)=>map.set(r.url,v)}};
  globalThis.fetch=async(u,options)=>{calls++;assert.equal(options.redirect,'manual');assert.equal(options.headers['X-NCP-APIGW-API-KEY'],undefined);if(u.includes('blocked'))return new Response('',{status:403});return new Response('<meta property="og:site_name" content="새신문">',{headers:{'Content-Type':'text/html;charset=utf-8'}});};
  const items=[{url:'https://newpress.co.kr/a',source:'newpress.co.kr'},{url:'https://newpress.co.kr/b',source:'newpress.co.kr'},{url:'https://donga.com/a',source:'동아일보'},{url:'https://blocked.co.kr/a',source:'blocked.co.kr'},{url:'http://127.0.0.1/a',source:'127.0.0.1'}];
  try {
    await discoverPress(items,'https://monitor.example');assert.deepEqual(items.map(x=>x.source),['새신문','새신문','동아일보','blocked.co.kr','127.0.0.1']);assert.equal(calls,2);
    await discoverPress(items.slice(0,2),'https://monitor.example');assert.equal(calls,2);
  }finally{globalThis.fetch=oldFetch;globalThis.caches=oldCache;}
});

