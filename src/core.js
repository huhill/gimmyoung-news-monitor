export function rangeOf(start, end) {
  const valid = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && new Date(x + 'T00:00:00Z').toISOString().slice(0,10) === x;
  if (!valid(start) || !valid(end)) throw new Error('올바른 시작일과 종료일을 선택해주세요.');
  const from = Date.parse(start + 'T00:00:00+09:00');
  const until = Date.parse(end + 'T00:00:00+09:00') + 86400000;
  if (until <= from || until - from > 31 * 86400000) throw new Error('기간은 시작일부터 최대 31일까지 선택할 수 있습니다.');
  return { start, end, from, until };
}
export function clean(text = '') {
  return String(text).replace(/<[^>]*>/g, '').replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, n) => ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[n])).replace(/&#(x[\da-f]+|\d+);/gi, (_, n) => {const v=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n); return v<=0x10ffff?String.fromCodePoint(v):'';}).trim();
}
export function safeURL(value) {
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; }
}
export function canonical(value) {
  const safe = safeURL(value); if (!safe) return '';
  const u = new URL(safe); u.hash = '';
  for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(k)) u.searchParams.delete(k);
  u.searchParams.sort(); return u.href;
}
export function classify(text, query) {
  const s = text.replace(/\s/g, '');
  const junior = s.includes('주니어김영사');
  const general = s.replaceAll('주니어김영사', '').includes('김영사');
  if (junior && general) return '공통';
  if (junior || query.replace(/\s/g,'') === '주니어김영사') return '주니어김영사';
  return general ? '김영사' : '분류 확인 필요';
}
export function normalizeNews(raw, query, range) {
  const t = Date.parse(raw.pubDate);
  if (!Number.isFinite(t) || t < range.from || t >= range.until) return null;
  const url = safeURL(raw.originallink) || safeURL(raw.link); if (!url) return null;
  const title = clean(raw.title), description = clean(raw.description);
  return { id: canonical(url), title, description, url, alias: canonical(raw.link), group: classify(title+' '+description, query), source: pressName(url), date: new Date(t+9*3600000).toISOString().slice(0,10), selected: true };
}
export function dedupe(items) {
  const result = [], seen = new Map();
  for (const item of items) {
    const existing = seen.get(item.id) || (item.alias && seen.get(item.alias));
    if (existing) {
      if (existing.group === '분류 확인 필요' && item.group !== existing.group) existing.group = item.group;
      seen.set(item.id, existing); if(item.alias) seen.set(item.alias,existing);
    } else { result.push(item); seen.set(item.id,item); if(item.alias) seen.set(item.alias,item); }
  }
  return result.sort((a,b)=>b.date.localeCompare(a.date));
}

// Match explicit hosts; do not label an unknown affiliate as its parent newspaper.
const PRESS_NAMES = {
  "beopbo.com": "법보신문",
  "view.asiae.co.kr": "아시아경제",
  "weekly.chosun.com": "주간조선",
  "biz.chosun.com": "조선비즈",
  "health.chosun.com": "헬스조선",
  "san.chosun.com": "월간산",
  "monthly.chosun.com": "월간조선",
  "chosun.com": "조선일보",
  "weekly.donga.com": "주간동아",
  "shindonga.donga.com": "신동아",
  "sports.donga.com": "스포츠동아",
  "woman.donga.com": "여성동아",
  "donga.com": "동아일보",
  "thescoop.co.kr": "더스쿠프",
  "joongang.co.kr": "중앙일보",
  "joongang.joins.com": "중앙일보",
  "hankyung.com": "한국경제",
  "mk.co.kr": "매일경제",
  "sedaily.com": "서울경제",
  "fnnews.com": "파이낸셜뉴스",
  "mt.co.kr": "머니투데이",
  "moneytoday.co.kr": "머니투데이",
  "edaily.co.kr": "이데일리",
  "asiae.co.kr": "아시아경제",
  "ajunews.com": "아주경제",
  "heraldcorp.com": "헤럴드경제",
  "biz.heraldcorp.com": "헤럴드경제",
  "news.heraldcorp.com": "헤럴드경제",
  "khan.co.kr": "경향신문",
  "h21.hani.co.kr": "한겨레21",
  "hani.co.kr": "한겨레",
  "hankookilbo.com": "한국일보",
  "seoul.co.kr": "서울신문",
  "segye.com": "세계일보",
  "munhwa.com": "문화일보",
  "kmib.co.kr": "국민일보",
  "naeil.com": "내일신문",
  "yna.co.kr": "연합뉴스",
  "yonhapnews.co.kr": "연합뉴스",
  "newsis.com": "뉴시스",
  "news1.kr": "뉴스1",
  "news.kbs.co.kr": "KBS",
  "imnews.imbc.com": "MBC",
  "news.sbs.co.kr": "SBS",
  "news.jtbc.co.kr": "JTBC",
  "ytn.co.kr": "YTN",
  "yonhapnewstv.co.kr": "연합뉴스TV",
  "mbn.co.kr": "MBN",
  "news.tvchosun.com": "TV조선",
  "ichannela.com": "채널A",
  "nocutnews.co.kr": "노컷뉴스",
  "ohmynews.com": "오마이뉴스",
  "pressian.com": "프레시안",
  "mediatoday.co.kr": "미디어오늘",
  "dailian.co.kr": "데일리안",
  "newspim.com": "뉴스핌",
  "newstomato.com": "뉴스토마토",
  "inews24.com": "아이뉴스24",
  "etnews.com": "전자신문",
  "dt.co.kr": "디지털타임스",
  "zdnet.co.kr": "지디넷코리아",
  "sisain.co.kr": "시사IN",
  "sisajournal.com": "시사저널",
  "sisaweek.com": "시사위크",
  "sisafocus.co.kr": "시사포커스",
  "busan.com": "부산일보",
  "kookje.co.kr": "국제신문",
  "imaeil.com": "매일신문",
  "yeongnam.com": "영남일보",
  "kwnews.co.kr": "강원일보",
  "kado.net": "강원도민일보",
  "kyeongin.com": "경인일보",
  "kgnews.co.kr": "경기신문",
  "kyeonggi.com": "경기일보",
  "incheonilbo.com": "인천일보",
  "daejonilbo.com": "대전일보",
  "joongdo.co.kr": "중도일보",
  "cctoday.co.kr": "충청투데이",
  "jbnews.com": "중부매일",
  "jjan.kr": "전북일보",
  "jeonmae.co.kr": "전국매일신문",
  "kwangju.co.kr": "광주일보",
  "namdonews.com": "남도일보",
  "jnilbo.com": "전남일보",
  "knnews.co.kr": "경남신문",
  "idomin.com": "경남도민일보",
  "ksilbo.co.kr": "경상일보",
  "jejunews.com": "제주일보",
  "ihalla.com": "한라일보",
  "readersnews.com": "독서신문",
  "ibabynews.com": "베이비뉴스",
  "news-paper.co.kr": "뉴스페이퍼",
  "readingnews.kr": "한국독서교육신문",
  "kyosu.net": "교수신문",
  "dhnews.co.kr": "대학저널",
  "dailysmart.co.kr": "스마트경제",
  "hankooki.com": "한국아이닷컴",
  "daily.hankooki.com": "데일리한국",
  "sports.hankooki.com": "스포츠한국",
  "sportschosun.com": "스포츠조선",
  "sportsseoul.com": "스포츠서울",
  "sports.khan.co.kr": "스포츠경향",
  "starin.edaily.co.kr": "이데일리 스타in",
  "hobbyen.co.kr": "하비엔"
};
export function pressName(value) {
  const safe = safeURL(value); if (!safe) return '';
  const host = new URL(safe).hostname.toLowerCase().replace(/\.$/, '');
  const normalized = host.replace(/^www\./, '');
  if (PRESS_NAMES[host]) return PRESS_NAMES[host];
  if (PRESS_NAMES[normalized]) return PRESS_NAMES[normalized];
  // Only conventional mobile host aliases are inferred.
  const mobile = normalized.replace(/^(m|mobile)\./, '');
  return PRESS_NAMES[mobile] || normalized;
}
