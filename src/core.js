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
  return { id: canonical(url), title, description, url, alias: canonical(raw.link), group: classify(title+' '+description, query), source: new URL(url).hostname.replace(/^www\./,''), date: new Date(t+9*3600000).toISOString().slice(0,10), selected: true };
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
