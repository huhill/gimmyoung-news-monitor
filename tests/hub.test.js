import test from 'node:test';
import assert from 'node:assert/strict';
import {collectNews} from '../src/worker.js';
import {rangeOf} from '../src/core.js';
test('API HUB endpoint, JSON format and new authentication headers are used',async()=>{
 const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url:new URL(url),headers:options.headers});return Response.json({total:0,items:[]});};
 try{
  const r=await collectNews({NAVER_CLIENT_ID:'hub-id',NAVER_CLIENT_SECRET:'hub-secret'},rangeOf('2026-10-19','2026-10-25'));
  assert.equal(calls.length,3);assert.ok(r.statuses.every(s=>s.state==='ok'));
  for(const c of calls){assert.equal(c.url.origin,'https://naverapihub.apigw.ntruss.com');assert.equal(c.url.pathname,'/search/v1/news');assert.equal(c.url.searchParams.get('format'),'json');assert.equal(c.headers['X-NCP-APIGW-API-KEY-ID'],'hub-id');assert.equal(c.headers['X-NCP-APIGW-API-KEY'],'hub-secret');assert.equal(c.headers['X-Naver-Client-Id'],undefined);assert.ok(!c.url.href.includes('hub-secret'));}
 }finally{globalThis.fetch=original;}
});
