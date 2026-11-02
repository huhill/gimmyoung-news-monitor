import test from 'node:test';
import assert from 'node:assert/strict';
import {publicationDate,issueTicket,verifyArticle,kpipaLinks,noticeDate,collectNotices} from '../src/research.js';
import {catalogFromTable,mergeCatalog,report,suggestBooks} from '../public/model.js';
test('CSV and Excel paste accept quoted commas, merge ISBN and retain old books',()=>{
 const a=catalogFromTable('도서명,브랜드,저자,ISBN\n"책, 하나",비채,저자,123\n다른 책,김영사,,456');
 const b=catalogFromTable('도서명\t출판사\t저자\tISBN\n새 제목\t비채\t작가\t123');
 const merged=mergeCatalog(a.books,b.books);assert.equal(merged.length,2);assert.equal(merged[0].title,'새 제목');
 assert.equal(catalogFromTable('도서명,브랜드\n무관,다른출판사').skipped,1);
 assert.throws(()=>catalogFromTable('제목만\n책'));assert.throws(()=>catalogFromTable('도서명,브랜드\n"닫히지 않음'));
 assert.equal(suggestBooks({title:'새 제목 소개'},merged)[0].brand,'비채');
});
test('report excludes unreviewed/out-of-range items and repeats multi-book article only by book',()=>{
 const range={start:'2026-10-26',end:'2026-11-01'};
 const base={title:'확인한 기사',date:'2026-10-30',url:'https://news.co.kr/a',source:'언론사',selected:true,review:'confirmed',group:'공통',books:[{brand:'비채',title:'책 A'},{brand:'김영사',title:'책 B'}]};
 const output=report({range,items:[base,{...base,title:'미검수',review:'pending'},{...base,title:'기간외',date:'2025-01-01'}]});
 assert.equal(output.split('확인한 기사').length-1,2);assert.ok(!output.includes('미검수'));assert.ok(!output.includes('기간외'));assert.ok(output.indexOf('김영사\r\n')<output.indexOf('비채\r\n'));
});
test('original date parser ignores modified time, detects conflicting dates and uses KST',()=>{
 assert.equal(publicationDate('<meta property="article:modified_time" content="2026-10-30">').date,'');
 assert.equal(publicationDate('<meta content="2026-10-25T16:00:00Z" property="article:published_time">').date,'2026-10-26');
 assert.equal(publicationDate('<script type="application/ld+json">{"@type":"NewsArticle","datePublished":"2026-10-30","dateModified":"2026-11-01"}</script>').date,'2026-10-30');
 assert.equal(publicationDate('<meta property="article:published_time" content="2026-10-30"><meta name="pubdate" content="2026-10-29">').date,'');
});
test('article check rejects URL tampering and expiry before any network fetch',async()=>{
 const ticket=await issueTicket('https://news.co.kr/a','secret');
 await assert.rejects(()=>verifyArticle({url:'https://news.co.kr/b',...ticket},'secret'));
 await assert.rejects(()=>verifyArticle({url:'https://news.co.kr/a',...ticket,expires:0},'secret'));
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('<meta name="pubdate" content="2026-10-30">',{headers:{'Content-Type':'text/html'}});
 try{assert.equal((await verifyArticle({url:'https://news.co.kr/a',...ticket},'secret')).date,'2026-10-30');}finally{globalThis.fetch=original;}
});
test('notice parser accepts official detail links and labelled registration date only',()=>{
 assert.equal(kpipaLinks('<a href="/p/g1_2/2188">공고</a><a href="https://evil.com/p/g1_2/1">가짜</a>','g1_2').length,1);
 assert.equal(noticeDate('<span>작성일</span> <time>26.10.30 11:48</time>'),'2026-10-30');
 assert.equal(noticeDate('행사 기간 26.10.30'),'');
});
test('blocked notice sources never become no-notice success',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('blocked',{status:403});
 try{const r=await collectNotices({start:'2026-10-26',end:'2026-11-01'});assert.equal(r.items.length,0);assert.ok(r.statuses.every(s=>s.state!=='ok'));}finally{globalThis.fetch=original;}
});
