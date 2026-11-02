export const brands=['김영사','비채','주니어김영사'];
export const agencies=['한국출판문화산업진흥원','대한출판문화협회','한국출판인회의'];
export function parseTable(text){
  text=text.replace(/^\uFEFF/,'');
  const delimiter=text.split(/\r?\n/)[0].includes('\t')?'\t':',';
  const rows=[];let row=[],cell='',quote=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quote&&text[i+1]==='"'){cell+='"';i++;}else quote=!quote;}
    else if(!quote&&(c===delimiter||c==='\n')){row.push(cell.trim());cell='';if(c==='\n'){rows.push(row);row=[];}}
    else if(c!=='\r')cell+=c;
  }
  if(quote)throw new Error('따옴표가 닫히지 않은 CSV입니다.');
  row.push(cell.trim());if(row.some(Boolean))rows.push(row);
  return rows.filter(r=>r.some(Boolean));
}
export function catalogFromTable(text){
  const rows=parseTable(text),header=rows.shift()||[];
  const find=names=>header.findIndex(h=>names.includes(h.toLowerCase().replace(/\s/g,'')));
  const title=find(['도서명','책제목','서명','title']),brand=find(['브랜드','출판사','출판브랜드','brand']),author=find(['저자','저자명','author']),isbn=find(['isbn','isbn13','isbn-13']);
  if(title<0||brand<0)throw new Error('첫 행에 도서명과 브랜드(또는 출판사) 열이 필요합니다. 저자·ISBN은 선택입니다.');
  const result=[];let skipped=0;
  for(const row of rows){const b=(row[brand]||'').replace(/\s/g,'');if(!row[title]||!brands.includes(b)){skipped++;continue;}result.push({title:row[title].slice(0,200),brand:b,author:(row[author]||'').slice(0,100),isbn:(row[isbn]||'').replace(/[^\dX]/gi,'')});}
  return {books:result,skipped};
}
export function mergeCatalog(old,added){const map=new Map();for(const b of [...old,...added])map.set(b.isbn||b.brand+'|'+b.title,b);return [...map.values()];}
export function suggestBooks(item,books){const text=(item.title+' '+(item.description||'')).replace(/\s/g,'');return books.filter(b=>b.title.replace(/\s/g,'').length>=3&&text.includes(b.title.replace(/\s/g,''))).slice(0,20).map(b=>({title:b.title,brand:b.brand}));}
export function eligible(item,range){return item.selected&&item.review==='confirmed'&&item.date>=range.start&&item.date<=range.end&&/^https?:\/\//.test(item.url);}
export function report({items=[],notices=[],range,author='',department='',demo=false}){
  if(!range)return '';
  const out=[];if(demo)out.push('[화면 예시 · 실제 수집 결과가 아닙니다]','');
  out.push(`안녕하세요.${department||author?' '+[department,author].filter(Boolean).join(' ')+'입니다.':''}`,'김영사 주간 언론 모니터링 공유드립니다.',`${range.start} ~ ${range.end}`,'');
  for(const brand of brands){
    out.push(brand);const groups=new Map();
    for(const x of items.filter(x=>eligible(x,range)).sort((a,b)=>a.date.localeCompare(b.date))){
      const matches=(x.books||[]).filter(b=>b.brand===brand);
      const labels=matches.length?matches.map(b=>'《'+b.title+'》'):x.group===brand?[x.category==='publisher'?'출판사 관련':'도서 확인 필요']:[];
      for(const label of new Set(labels)){if(!groups.has(label))groups.set(label,[]);groups.get(label).push(x);}
    }
    if(!groups.size)out.push('공유할 확인 완료 기사 없음','');
    for(const [label,rows] of groups){out.push(label);for(const x of rows)out.push(`[${x.source}] ${x.title} (${x.date.replaceAll('-','.')})`,x.url,'');}
  }
  out.push('출판계 주요 공고 모니터링','');
  for(const agency of agencies){out.push(agency);const rows=notices.filter(x=>x.source===agency&&eligible(x,range)).sort((a,b)=>a.date.localeCompare(b.date));if(!rows.length)out.push('공유할 확인 완료 공고 없음 — 기관 게시판 확인 필요','');for(const x of rows)out.push(x.date.replaceAll('-','.'),x.title,x.url,'');}
  out.push('감사합니다.');if(author)out.push(author+' 드림.');return out.join('\r\n');
}
