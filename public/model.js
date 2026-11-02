export const brands=['김영사','비채','주니어김영사'];
export const agencies=['한국출판문화산업진흥원','대한출판문화협회','한국출판인회의'];
export function eligible(item,range){return item.selected&&item.verification==='automatic-v1'&&item.date>=range.start&&item.date<=range.end&&/^https?:\/\//.test(item.url);}
export function report({items=[],notices=[],range,author='',department=''}){
  if(!range)return '';
  const out=[`안녕하세요.${department||author?' '+[department,author].filter(Boolean).join(' ')+'입니다.':''}`,'김영사 주간 언론 모니터링 공유드립니다.',`${range.start} ~ ${range.end}`,''];
  for(const brand of brands){out.push(brand);const rows=items.filter(x=>eligible(x,range)&&x.brands?.includes(brand)).sort((a,b)=>a.date.localeCompare(b.date));if(!rows.length)out.push('해당 기간 자동 확인된 기사 없음','');for(const x of rows)out.push(`[${x.source}] ${x.title} (${x.date.replaceAll('-','.')})`,x.url,'');}
  out.push('출판계 주요 공고 모니터링','');
  for(const agency of agencies){out.push(agency);const rows=notices.filter(x=>eligible(x,range)&&x.source===agency).sort((a,b)=>a.date.localeCompare(b.date));if(!rows.length)out.push('자동 확인된 공고 없음 — 수집 제한으로 누락 가능','');for(const x of rows)out.push(x.date.replaceAll('-','.'),x.title,x.url,'');}
  out.push('감사합니다.');if(author)out.push(author+' 드림.');return out.join('\r\n');
}
