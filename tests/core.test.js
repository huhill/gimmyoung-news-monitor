import test from 'node:test';
import assert from 'node:assert/strict';
import {rangeOf,normalizeNews,dedupe,classify,safeURL,clean} from '../src/core.js';
import worker,{collectNews} from '../src/worker.js';
import {authorize} from '../src/auth.js';
const range=rangeOf('2026-10-19','2026-10-25');
const raw=(date,url='https://news.example/a')=>({pubDate:date,originallink:url,link:url,title:'<b>김영사</b> 신간',description:'도서 소식'});
test('한국시간 경계: 월요일 포함, 다음 월요일 제외',()=>{
  assert.ok(normalizeNews(raw('2026-10-18T15:00:00Z'),'김영사',range));
  assert.equal(normalizeNews(raw('2026-10-18T14:59:59Z'),'김영사',range),null);
  assert.ok(normalizeNews(raw('2026-10-25T14:59:59Z'),'김영사',range));
  assert.equal(normalizeNews(raw('2026-10-25T15:00:00Z'),'김영사',range),null);
});
test('날짜 및 기간 검증',()=>{for(const [a,b] of [['2026-02-30','2026-03-01'],['2026-10-25','2026-10-19'],['2026-01-01','2026-03-01'],['bad','bad']])assert.throws(()=>rangeOf(a,b));});
test('주니어 포함 문자열, 공통, 확인 필요 분류',()=>{
  assert.equal(classify('주니어 김영사 신간','김영사'),'주니어김영사');
  assert.equal(classify('김영사 및 주니어김영사','김영사'),'공통');
  assert.equal(classify('책 소개','김영사'),'분류 확인 필요');
});
test('동일 링크 통합, 다른 매체 기사 유지',()=>{
  const a=normalizeNews(raw('2026-10-20', 'https://news.example/a?utm_source=test'),'김영사',range);
  const b=normalizeNews(raw('2026-10-20', 'https://news.example/a'),'김영사',range);
  const c=normalizeNews(raw('2026-10-20', 'https://other.example/a'),'김영사',range);
  assert.equal(dedupe([a,b,c]).length,2);
});
test('링크 및 검색 결과 정리',()=>{assert.equal(safeURL('javascript:alert(1)'),'');assert.equal(clean('<b>책</b> &amp; &#39;소식&#39;'),"책 & '소식'");});
test('인증 설정 누락과 위조 토큰은 차단',async()=>{
  const request=new Request('https://monitor.example/api/collect');
  assert.equal((await authorize(request,{})).status,503);
  const result=await worker.fetch(request,{});assert.equal(result.status,503);assert.match(result.headers.get('X-Robots-Tag'),/noindex/);
  const response=await worker.fetch(new Request('https://monitor.example/robots.txt'),{});assert.match(await response.text(),/Disallow: \//);
});
test('인증키 없는 뉴스 수집은 빈 결과 성공으로 보고하지 않음',async()=>{
  const result=await collectNews({},range);assert.equal(result.statuses[0].state,'setup');
});
test('JWT 서명, audience, 만료, 팀 이메일을 검증',async()=>{
  const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='test';
  const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({keys:[jwk]});
  const env={ACCESS_TEAM_DOMAIN:'test-team.cloudflareaccess.com',ACCESS_AUD:'test-aud',ALLOWED_EMAILS:'member@example.com'};
  const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const payload={iss:'https://test-team.cloudflareaccess.com',aud:['test-aud'],sub:'id',email:'member@example.com',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+60};
  async function req(p,tamper=false){const data=encode({alg:'RS256',kid:'test'})+'.'+encode(p);const sig=Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(data))).toString('base64url');return new Request('https://monitor.example/',{headers:{'Cf-Access-Jwt-Assertion':data+'.'+(tamper?'AA':sig)}});}
  try{assert.equal((await authorize(await req(payload),env)).ok,true);assert.equal((await authorize(await req({...payload,email:'outsider@example.com'}),env)).status,403);assert.equal((await authorize(await req({...payload,exp:1}),env)).status,401);assert.equal((await authorize(await req({...payload,aud:['wrong']}),env)).status,401);assert.equal((await authorize(await req(payload,true),env)).status,401);}finally{globalThis.fetch=original;}
});
test('검색어 세 개 수집 및 중복 통합',async()=>{
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;return Response.json({total:1,items:[raw('2026-10-20')]});};
  try{const r=await collectNews({NAVER_CLIENT_ID:'test',NAVER_CLIENT_SECRET:'test'},range);assert.equal(calls,3);assert.equal(r.items.length,1);assert.ok(r.statuses.every(x=>x.state==='ok'));}finally{globalThis.fetch=original;}
});
test('최신 결과 다음 페이지에서 기간 내 기사를 찾음',async()=>{
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async url=>{calls++;const start=new URL(url).searchParams.get('start');return Response.json(start==='1'?{total:101,items:Array.from({length:100},()=>raw('2026-10-26'))}:{total:101,items:[raw('2026-10-20')]});};
  try{const r=await collectNews({NAVER_CLIENT_ID:'test',NAVER_CLIENT_SECRET:'test'},range);assert.equal(calls,6);assert.equal(r.items.length,1);assert.ok(r.statuses.every(x=>x.state==='ok'));}finally{globalThis.fetch=original;}
});
test('실패한 검색어가 있어도 다른 검색어 결과는 보존',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async url=>new URL(url).searchParams.get('query')==='김영사'?new Response('',{status:429}):Response.json({total:1,items:[raw('2026-10-20')]});
  try{const r=await collectNews({NAVER_CLIENT_ID:'test',NAVER_CLIENT_SECRET:'test'},range);assert.equal(r.items.length,1);assert.equal(r.statuses[0].state,'error');assert.equal(r.statuses[1].state,'ok');}finally{globalThis.fetch=original;}
});
test('API 검색 상한에 도달하면 완료 대신 부분 수집',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({total:3000,items:Array.from({length:100},()=>raw('2026-10-26'))});
  try{const r=await collectNews({NAVER_CLIENT_ID:'test',NAVER_CLIENT_SECRET:'test'},range);assert.ok(r.statuses.every(x=>x.state==='partial'));}finally{globalThis.fetch=original;}
});
