import test from 'node:test';
import assert from 'node:assert/strict';
import {publicationDate,articleText,relatedBrands,confirmNews,kpipaLinks,noticeDate,collectNotices} from '../src/research.js';
import {report} from '../public/model.js';
const range={start:'2026-10-26',end:'2026-11-01'};
const prose='이 기사는 새로 출간된 책의 내용과 의미를 소개합니다. 독자들이 이해할 수 있도록 주요 주제와 배경을 자세히 설명합니다. ';
const page=body=>'<meta property="article:published_time" content="2026-10-30"><div id="articleBody">'+prose+body+'</div>';
test('only article body is evidence, not navigation, related cards, comments or scripts',()=>{
 const html='<nav>김영사</nav><aside>주니어김영사</aside>'+page('일반 기사입니다.<div class="related">김영사 신간</div>')+'<script>"<div id=\"articleBody\">김영사</div>"</script>';
 assert.deepEqual(relatedBrands(articleText(html)),[]);
 assert.equal(articleText('<main>'+prose+'김영사</main>'),'');
 assert.deepEqual(relatedBrands(articleText(page('주니어 김영사 펴냄'))),['주니어김영사']);
 assert.deepEqual(relatedBrands(articleText(page('출판사 비채의 신간과 김영사 책'))),['김영사','비채']);
 assert.deepEqual(relatedBrands(articleText(page('비채 레스토랑에서 식사했다.'))),[]);
});
test('structured article body is supported; ambiguous bodies fail closed',()=>{
 const ld=b=>'<script type="application/ld+json">'+JSON.stringify({'@type':'NewsArticle',articleBody:b})+'</script>';
 assert.equal(articleText(ld(prose+'김영사')),prose+'김영사');assert.equal(articleText(ld(prose+'김영사')+ld(prose+'다른기사')),'');
});
test('date parsing ignores modified-only and rejects conflicting dates',()=>{
 assert.equal(publicationDate('<meta property="article:modified_time" content="2026-10-30">').date,'');
 assert.equal(publicationDate('<meta content="2026-10-25T16:00:00Z" property="article:published_time">').date,'2026-10-26');
 assert.equal(publicationDate(page('김영사')+'<meta name="pubdate" content="2026-10-29">').date,'');
});
test('automatic pipeline exposes only approved items and explains every omission',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async u=>{const path=new URL(u).pathname;if(path==='/blocked')return new Response('',{status:403});let html=path==='/old'?page('김영사').replace('2026-10-30','2025-10-30'):path==='/unknown'?'<article>'+prose+'김영사</article>':page(path==='/unrelated'?'비채 레스토랑':'김영사 펴냄');return new Response(html,{headers:{'Content-Type':'text/html'}});};
 try{const items=['ok','blocked','old','unknown','unrelated'].map(id=>({id,title:id,url:'https://news.co.kr/'+id}));const r=await confirmNews(items,range,()=> '뉴스');assert.deepEqual(r.items.map(x=>x.id),['ok']);assert.equal(r.items[0].verification,'automatic-v1');assert.deepEqual(r.counts,{candidates:5,confirmed:1,unavailable:1,uncertain:1,outside:1,unrelated:1,limited:0});}finally{globalThis.fetch=original;}
});
test('automatic request budget caps article requests, preserving accounting',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response(page('김영사'),{headers:{'Content-Type':'text/html'}});};
 try{const r=await confirmNews(Array.from({length:30},(_,i)=>({id:String(i),url:'https://news.co.kr/'+i})),range,()=> '뉴스');assert.equal(calls,24);assert.equal(r.items.length,24);assert.equal(r.counts.limited,6);}finally{globalThis.fetch=original;}
});
test('report cannot promote legacy manual approvals, uses brands and dates only',()=>{
 const x={title:'자동 기사',url:'https://news.co.kr/a',source:'뉴스',date:'2026-10-30',selected:true,verification:'automatic-v1',brands:['김영사','비채']};
 const out=report({range,items:[x,{...x,title:'예전수동',verification:undefined,review:'confirmed'},{...x,title:'기간밖',date:'2025-10-30'}]});assert.equal(out.split('자동 기사').length-1,2);assert.ok(!out.includes('예전수동'));assert.ok(!out.includes('기간밖'));assert.ok(!out.includes('도서 확인 필요'));
});
test('official notice links and explicitly labelled date only',()=>{
 assert.equal(kpipaLinks('<a href="/p/g1_2/2188">공고</a><a href="https://evil.com/p/g1_2/1">가짜</a>','g1_2').length,1);assert.equal(noticeDate('<span>작성일</span> 26.10.30 11:48'),'2026-10-30');assert.equal(noticeDate('행사 기간 26.10.30'),'');
});
test('blocked notices are never reported as successful zero',async()=>{const original=globalThis.fetch;globalThis.fetch=async()=>new Response('',{status:403});try{const r=await collectNotices(range);assert.equal(r.items.length,0);assert.ok(r.statuses.every(x=>x.state!=='ok'));}finally{globalThis.fetch=original;}});
