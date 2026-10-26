const enc=new TextEncoder(), name='__Host-media_session', age=28800;
const attempts=new Map(); // Per-isolate throttle; not a distributed/global limit.
export const configured=e=>typeof e.APP_PASSWORD==='string'&&e.APP_PASSWORD.length>=12;
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const un64=s=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const key=e=>crypto.subtle.importKey('raw',enc.encode('media-session-v1:'+e.APP_PASSWORD),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
export async function sessionCookie(e,now=Date.now()) { const body=(Math.floor(now/1000)+age)+'.'+crypto.randomUUID(); const sig=b64(await crypto.subtle.sign('HMAC',await key(e),enc.encode(body))); return `${name}=${body}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`; }
export const clearCookie=()=>`${name}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
export async function authorize(r,e){
 if(!configured(e))return{ok:false,status:503};
 try {const token=(r.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1);if(!token||token.length>300)return{ok:false,status:401};const p=token.split('.'),now=Math.floor(Date.now()/1000);if(p.length!==3||!/^\d+$/.test(p[0])||Number(p[0])<=now||Number(p[0])>now+age)return{ok:false,status:401};const ok=await crypto.subtle.verify('HMAC',await key(e),un64(p[2]),enc.encode(p[0]+'.'+p[1]));return{ok,status:ok?200:401};}catch{return{ok:false,status:401};}
}
export async function login(r,e){
 if(!configured(e))return{status:503,error:'Cloudflare Settings에 APP_PASSWORD를 12자 이상으로 등록해주세요.'};
 if(r.headers.get('Origin')!==new URL(r.url).origin)return{status:403,error:'이 사이트의 로그인 화면에서 입력해주세요.'};
 if(!r.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded'))return{status:415,error:'잘못된 요청입니다.'};
 const ip=r.headers.get('CF-Connecting-IP')||'unknown',now=Date.now();for(const[k,v]of attempts)if(v.until<=now)attempts.delete(k);const a=attempts.get(ip)||{count:0,until:now+300000};if(a.count>=10||attempts.size>=10000)return{status:429,error:'시도가 너무 많습니다. 5분 후 다시 입력해주세요.'};a.count++;attempts.set(ip,a);
 const reader=r.body?.getReader();if(!reader)return{status:400,error:'비밀번호를 입력해주세요.'};let size=0,text='';const dec=new TextDecoder();while(true){const c=await reader.read();if(c.done)break;size+=c.value.length;if(size>4096){await reader.cancel();return{status:413,error:'입력값이 너무 깁니다.'};}text+=dec.decode(c.value,{stream:true});}text+=dec.decode();const candidate=new URLSearchParams(text).get('password')||'';
 const left=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(candidate))),right=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(e.APP_PASSWORD)));let diff=0;for(let i=0;i<left.length;i++)diff|=left[i]^right[i];if(diff)return{status:401,error:'비밀번호가 맞지 않습니다.'};attempts.delete(ip);return{status:303,cookie:await sessionCookie(e)};
}
export function loginPage(error=''){return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>김영사 미디어 모니터 · 로그인</title><link rel="stylesheet" href="/styles.css"></head><body class="login-page"><section class="login-card"><div class="eyebrow">GIMMYOUNG MEDIA DESK</div><h1>팀의 소식을 모으는 곳.</h1><p>공유받은 비밀번호를 입력해주세요.</p><form method="post" action="/login"><label for="password">비밀번호</label><input id="password" name="password" type="password" autocomplete="current-password" maxlength="256" required autofocus><p role="alert">${error}</p><button class="primary" type="submit">들어가기 →</button></form><small>로그인은 8시간 동안 유지됩니다.</small></section></body></html>`;}
