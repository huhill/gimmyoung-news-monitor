import { collectionGate, limitedBody } from './limits.js';
import { rangeOf, normalizeNews, dedupe, clean, pressName } from './core.js';
// Read publisher-provided metadata, never infer a publisher from the headline.
export function metadataPress(html) {
  for (const tag of html.replace(/<!--[\s\S]*?-->/g, '').match(/<meta\b[^>]*>/gi) || []) {
    const attrs = {};
    for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4];
    if ((attrs.property || attrs.name || '').toLowerCase() !== 'og:site_name') continue;
    const name = clean(attrs.content || '').replace(/[<>\u0000-\u001f]/g, '').trim();
    if (name.length >= 2 && name.length <= 60 && !/https?:\/\/|�/.test(name)) return name;
  }
  return '';
}
export async function discoverPress(items, origin) {
  const groups = new Map();
  for (const item of items) {
    const u = new URL(item.url), host = u.hostname.toLowerCase();
    if (pressName(item.url) !== host.replace(/^www\./, '')) continue;
    // Only public DNS-style HTTPS destinations; never follow arbitrary redirects.
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) || /\.(localhost|local|internal|test|example|invalid)$/.test(host) || u.username || u.password || (u.port && u.port !== '443')) continue;
    u.protocol = 'https:';
    if (!groups.has(host)) groups.set(host, {url:u.href, items:[]});
    groups.get(host).items.push(item);
  }
  const cache = globalThis.caches?.default;
  // Bound additional requests and latency, even for large search results.
  await Promise.all([...groups].slice(0, 6).map(async ([host, group]) => {
    try {
      const key = new Request(origin + '/__press_metadata_v1/' + host);
      const hit = await cache?.match(key).catch(() => undefined);
      let name;
      if (hit) name = (await hit.json()).name;
      else {
        const response = await fetch(group.url, {redirect:'manual', signal:AbortSignal.timeout(3500), headers:{Accept:'text/html'}});
        if (!response.ok || !response.headers.get('Content-Type')?.includes('text/html')) { await response.body?.cancel(); return; }
        const reader = response.body.getReader(), chunks = []; let size = 0;
        try {
          while (size < 131072) { const {done,value} = await reader.read(); if(done)break; const part=value.subarray(0,131072-size);chunks.push(part);size+=part.length; }
        } finally { await reader.cancel(); }
        const bytes = new Uint8Array(size); let offset=0;
        for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
        const charset = response.headers.get('Content-Type').match(/charset=["']?([^;\s"']+)/i)?.[1] || 'utf-8';
        name = metadataPress(new TextDecoder(charset).decode(bytes));
        await cache?.put(key, Response.json({name}, {headers:{'Cache-Control':`public,max-age=${name ? 86400 : 600}`}})).catch(() => {});
      }
      if (name) for (const item of group.items) item.source = name;
    } catch { /* Metadata failure must never discard otherwise valid news. */ }
  }));
  return items;
}
const institutions = [
  { name:'대한출판문화협회', url:'https://member.kpa21.or.kr/kpa_bbs/', detail:'자동 접근 확인 화면이 확인되어 수집 연결 대기 중입니다.' },
  { name:'한국출판인회의', url:'https://www.kopus.org/publishernotice/', detail:'접근 오류가 확인되어 수집 연결 대기 중입니다.' },
  { name:'한국출판문화산업진흥원', url:'https://www.kpipa.or.kr/p/g1_2', detail:'게시판 전용 수집기 연결 전입니다. 원문에서 확인해주세요.' }
];
function secure(response) {
  const r=new Response(response.body,response);
  for(const [k,v] of Object.entries({
    'X-Robots-Tag':'noindex, nofollow, noarchive, nosnippet',
    'Cache-Control':'private, no-store',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer',
    'X-Frame-Options':'DENY',
    'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
  })) r.headers.set(k,v);
  return r;
}
const json=(data,status=200)=>secure(Response.json(data,{status}));
export async function collectNews(env, range) {
  const items=[], statuses=[];
  if(!env.NAVER_CLIENT_ID || !env.NAVER_CLIENT_SECRET) return {items, statuses:[{name:'네이버 뉴스',state:'setup',detail:'네이버 검색 API 인증키를 서버에 등록해야 합니다.'}]};
  for(const query of ['김영사','주니어김영사','주니어 김영사']) {
    let complete=false;
    try {
      for(let start=1; start<=901; start+=100) {
        const u=new URL('https://naverapihub.apigw.ntruss.com/search/v1/news');
        u.search=new URLSearchParams({query,display:'100',sort:'date',start:String(start),format:'json'});
        const r=await fetch(u,{headers:{'X-NCP-APIGW-API-KEY-ID':env.NAVER_CLIENT_ID,'X-NCP-APIGW-API-KEY':env.NAVER_CLIENT_SECRET},signal:AbortSignal.timeout(12000)});
        if(!r.ok) throw new Error(r.status===401?'네이버 인증키가 올바르지 않습니다. Client ID와 Client Secret을 확인해주세요.':r.status===403?'네이버 애플리케이션의 검색 API 권한을 확인해주세요.':r.status===429?'네이버 API 호출 한도에 도달했습니다. 잠시 후 다시 시도해주세요.':`검색 서버 응답 오류 (${r.status})`);
        const data=await r.json(); if(!Array.isArray(data.items)) throw new Error('검색 응답 형식을 확인할 수 없습니다.');
        for(const raw of data.items) { const item=normalizeNews(raw,query,range); if(item) items.push(item); }
        if(data.items.length<100 || start+data.items.length-1>=data.total || data.items.some(x=>Date.parse(x.pubDate)<range.from)) {complete=true;break;}
      }
      statuses.push({name:query,state:complete?'ok':'partial',detail:complete?'검색 완료':'검색 결과 1,000건 한도에 도달했습니다. 선택 기간의 일부 기사가 누락될 수 있습니다.'});
    } catch(e) { statuses.push({name:query,state:'error',detail:e.name==='TimeoutError'?'검색 응답 시간이 초과되었습니다. 다시 시도해주세요.':e.message}); }
  }
  return {items:dedupe(items),statuses};
}
export default { async fetch(request,env) {
  const url=new URL(request.url);
  if(url.pathname==='/robots.txt') return secure(new Response('User-agent: *\nDisallow: /\n',{headers:{'Content-Type':'text/plain;charset=utf-8'}}));
  if(url.pathname==='/login'||url.pathname==='/logout')return secure(new Response(null,{status:303,headers:{Location:'/'}}));
  if(url.pathname==='/api/config') return json({newsReady:!!(env.NAVER_CLIENT_ID&&env.NAVER_CLIENT_SECRET),institutions});
  if(url.pathname==='/api/collect') {
    if(request.method!=='POST') return json({error:'허용되지 않은 요청입니다.'},405);
    if(request.headers.get('Origin')!==url.origin) return json({error:'동일 사이트에서만 수집할 수 있습니다.'},403);
    if(!request.headers.get('Content-Type')?.startsWith('application/json')) return json({error:'JSON 요청이 필요합니다.'},415);
    const gate=await collectionGate(request,env);
    if(gate)return gate;
    let range;
    try {const text=await limitedBody(request); const body=JSON.parse(text); range=rangeOf(body.start,body.end);} catch(e) {return json({error:e.message},400);}
    if(!env.NAVER_CLIENT_ID||!env.NAVER_CLIENT_SECRET)return json({error:'Cloudflare에 NAVER_CLIENT_ID와 NAVER_CLIENT_SECRET을 Secret으로 등록해주세요.'},503);
    const cache=globalThis.caches?.default;
    const cacheKey=new Request(url.origin+'/__news_cache_hub_v3/'+range.start+'/'+range.end);
    try {const hit=await cache?.match(cacheKey);if(hit){const data=await hit.json();if(Date.parse(data.cacheUntil)>Date.now())return json({...data,cached:true});}}catch{/* Cache failure must not prevent collection. */}
    const result=await collectNews(env,range);
    await discoverPress(result.items,url.origin);
    const data={...result,start:range.start,end:range.end,collectedAt:new Date().toISOString(),cached:false,institutions:institutions.map(x=>({...x,state:'pending'}))};
    if(result.statuses.every(x=>x.state==='ok')){
      data.cacheUntil=new Date(Date.now()+300000).toISOString();
      try {await cache?.put(cacheKey,Response.json(data,{headers:{'Cache-Control':'public,max-age=300'}}));}catch{/* Best-effort edge cache. */}
    }
    return json(data);
  }
  if(url.pathname.startsWith('/api/')) return json({error:'찾을 수 없는 경로입니다.'},404);
  return secure(await env.ASSETS.fetch(request));
}};

