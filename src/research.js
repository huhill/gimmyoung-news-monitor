import {clean} from './core.js';
export async function readHTML(url){
  const u=new URL(url);
  if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.port||!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname)||/\.(local|localhost|internal|test|example|invalid)$/i.test(u.hostname))throw new Error('확인할 수 없는 주소입니다.');
  u.protocol='https:';
  const r=await fetch(u,{redirect:'manual',signal:AbortSignal.timeout(6000),headers:{Accept:'text/html'}});
  if(!r.ok||!r.headers.get('Content-Type')?.includes('text/html')){await r.body?.cancel();throw new Error(`원문 접근 불가 (${r.status})`);}
  const reader=r.body.getReader(),parts=[];let size=0;
  try{while(size<262144){const {done,value}=await reader.read();if(done)break;const part=value.subarray(0,262144-size);parts.push(part);size+=part.length;}}finally{await reader.cancel();}
  const bytes=new Uint8Array(size);let at=0;for(const p of parts){bytes.set(p,at);at+=p.length;}
  const charset=r.headers.get('Content-Type').match(/charset=["']?([^;\s"']+)/i)?.[1]||'utf-8';return new TextDecoder(charset).decode(bytes);
}
export function dateKST(value){
  if(!/^\d{4}-\d{2}-\d{2}(?:$|T|\s)/.test(String(value)))return '';
  const v=String(value).trim();const day=v.slice(0,10);
  if(new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day)return '';
  if(!/[Zz]|[+-]\d{2}:?\d{2}$/.test(v))return day;
  const t=Date.parse(v);return Number.isFinite(t)?new Date(t+9*3600000).toISOString().slice(0,10):'';
}
export function publicationDate(html){
  html=html.replace(/<!--[\s\S]*?-->/g,'');
  const values=[];
  for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){const a={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))a[m[1].toLowerCase()]=m[2]??m[3];if(['article:published_time','datepublished','pubdate'].includes((a.property||a.name||a.itemprop||'').toLowerCase()))values.push(a.content);}
  for(const script of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{const roots=JSON.parse(script[1]);const walk=(v,depth=0)=>{if(!v||depth>5)return;if(Array.isArray(v)){v.forEach(x=>walk(x,depth+1));return;}if(typeof v==='object'){const types=[v['@type']].flat();if(types.some(t=>/^(NewsArticle|Article|ReportageNewsArticle|BlogPosting)$/.test(t)))values.push(v.datePublished);if(v['@graph'])walk(v['@graph'],depth+1);}};walk(roots);}catch{}
  }
  const dates=[...new Set(values.map(v=>{try{return dateKST(v);}catch{return '';}}).filter(Boolean))];
  return dates.length===1?{date:dates[0],evidence:'원문의 최초 발행일 메타정보 — 원문 화면과 대조해주세요.'}:{date:'',evidence:dates.length?'원문 발행일 정보가 서로 달라 직접 확인이 필요합니다.':'최초 발행일을 자동 확인하지 못했습니다. 원문의 입력일을 확인해주세요.'};
}
// Use article text only. Navigation, recommended links and search snippets are not evidence.
export function articleText(html){
  const bodies=[];
  for(const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{const walk=(v,d=0)=>{if(!v||d>5)return;if(Array.isArray(v)){v.forEach(x=>walk(x,d+1));return;}if(typeof v==='object'){if([v['@type']].flat().some(t=>/^(NewsArticle|Article|ReportageNewsArticle)$/.test(t))&&typeof v.articleBody==='string')bodies.push(clean(v.articleBody));if(v['@graph'])walk(v['@graph'],d+1);}};walk(JSON.parse(m[1]));}catch{}
  }
  const unique=[...new Set(bodies.filter(x=>x.length>=50))];if(unique.length===1)return unique[0];if(unique.length>1)return '';
  html=html.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi,'');
  const stack=[],chunks=[];let active=0,blocked=0,containers=0;
  const specific=/(?:^|[\s_-])(?:article[-_]?body|article[-_]?text|article[-_]?content|article-view-content-div|news[-_]?body|news[-_]?content|articeBody|articeBodyContents|newsct_article|dic_area|article_txt|articleBodyContents)(?:$|[\s_-])/i;
  const hasSpecific=[...html.matchAll(/<(?:div|section|article)\b([^>]*)>/gi)].some(m=>[...m[1].matchAll(/(?:id|class|itemprop)\s*=\s*["']([^"']*)["']/gi)].some(a=>specific.test(a[1])||a[1]==='articleBody'));
  for(const token of html.match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g)||[]){
    if(token.startsWith('<!--'))continue;
    const close=token.match(/^<\/(\w+)/);if(close){const idx=stack.map(x=>x.tag).lastIndexOf(close[1].toLowerCase());if(idx>=0)for(const x of stack.splice(idx)){if(x.active)active--;if(x.blocked)blocked--;}continue;}
    const open=token.match(/^<(\w+)\b([^>]*)>/);if(open){
      const tag=open[1].toLowerCase(),attrs=open[2];const values=[...attrs.matchAll(/(?:id|class|itemprop)\s*=\s*["']([^"']*)["']/gi)].map(m=>m[1]);
      const skip=['script','style','nav','aside','footer','form'].includes(tag)||values.some(v=>/(?:^|[\s_-])(?:related|recommend|comment|advert|adbox|share|sidebar)(?:$|[\s_-])/i.test(v));
      const start=!active&&!blocked&&!skip&&(hasSpecific?values.some(v=>specific.test(v)||v==='articleBody'):tag==='article');
      if(!/^(?:meta|link|img|br|hr|input|source|wbr)$/.test(tag)&&!token.endsWith('/>')){stack.push({tag,active:start,blocked:skip});if(start){active++;containers++;}if(skip)blocked++;}
      if(active&&!blocked)chunks.push(' ');continue;
    }
    if(active&&!blocked)chunks.push(token);
  }
  const text=clean(chunks.join('')).replace(/\s+/g,' ').trim();return containers===1&&text.length>=50?text:'';
}
export function relatedBrands(text){
  const compact=text.replace(/\s+/g,'');const found=[];
  if(compact.replaceAll('주니어김영사','').includes('김영사'))found.push('김영사');
  if(/(?:출판사|출판브랜드|출판레이블)[‘’'"「」]?비채|비채[‘’'"」)]?(?:에서)?(?:펴냄|펴낸|출간|출판)|비채[·|/](?:\d|값)|[·|/]비채[·|/]/.test(compact))found.push('비채');
  if(compact.includes('주니어김영사'))found.push('주니어김영사');return found;
}
export async function confirmNews(items,range,sourceName){
  const counts={candidates:items.length,confirmed:0,unavailable:0,uncertain:0,outside:0,unrelated:0,limited:Math.max(0,items.length-24)};
  const results=new Array(Math.min(items.length,24));let next=0;
  await Promise.all(Array.from({length:4},async()=>{while(next<results.length){const i=next++,item=items[i];try{
    const html=await readHTML(item.url),{date}=publicationDate(html);if(!date){counts.uncertain++;continue;}if(date<range.start||date>range.end){counts.outside++;continue;}
    const text=articleText(html);if(!text){counts.uncertain++;continue;}const brands=relatedBrands(text);if(!brands.length){counts.unrelated++;continue;}
    results[i]={id:item.id,title:item.title,url:item.url,source:sourceName(item,html),date,brands,group:brands.length===1?brands[0]:'공통',selected:true,verification:'automatic-v1'};counts.confirmed++;
  }catch{counts.unavailable++;}}}));
  return {items:results.filter(Boolean),counts};
}
export function kpipaLinks(html,board){
  const links=new Map();for(const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    try{const u=new URL(clean(m[1]),'https://www.kpipa.or.kr');if(u.origin!=='https://www.kpipa.or.kr'||!new RegExp('^/p/'+board+'/\\d+$').test(u.pathname))continue;const title=clean(m[2]).replace(/\s+/g,' ').trim();if(title)links.set(u.href,{url:u.href,title});}catch{}
  }return [...links.values()];
}
export function noticeDate(html){const text=clean(html.replace(/<script\b[\s\S]*?<\/script>/gi,'')).replace(/\s+/g,' ');const m=text.match(/작성일\s*(\d{2}|\d{4})[.-](\d{2})[.-](\d{2})/);if(!m)return '';try{return dateKST(`${m[1].length===2?'20'+m[1]:m[1]}-${m[2]}-${m[3]}`);}catch{return '';}}
export async function collectNotices(range){
  const items=[],statuses=[];
  // A deliberately bounded first-page scan, never reported as exhaustive.
  for(const [board,label] of [['g1_2','사업공고'],['g1_1','KPIPA 소식'],['g1_5','보도자료']]){
    const name='한국출판문화산업진흥원 · '+label;
    try{const links=kpipaLinks(await readHTML('https://www.kpipa.or.kr/p/'+board),board);if(!links.length)throw new Error('목록을 읽지 못했습니다. 차단 또는 게시판 구조 변경을 확인해주세요.');
      let failures=0;await Promise.all(links.slice(0,6).map(async entry=>{try{const date=noticeDate(await readHTML(entry.url));if(!date){failures++;return;}if(date>=range.start&&date<=range.end)items.push({...entry,id:entry.url,date,source:'한국출판문화산업진흥원',verification:'automatic-v1',selected:true});}catch{failures++;}}));
      statuses.push({name,state:'partial',detail:`최근 게시물 최대 6건 확인 · 이전 페이지는 직접 확인 필요${failures?' · 일부 상세 페이지 확인 실패':''}`});
    }catch(e){statuses.push({name,state:'error',detail:e.message});}
  }
  for(const name of ['대한출판문화협회','한국출판인회의'])statuses.push({name,state:'pending',detail:'접근 제한으로 자동 수집 불가'});
  return {items,statuses};
}
