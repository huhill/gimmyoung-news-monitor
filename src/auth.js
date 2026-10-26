let cached = { domain: '', expires: 0, keys: [] };
const decode = x => Uint8Array.from(atob(x.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0));
const parse = x => JSON.parse(new TextDecoder().decode(decode(x)));
export async function authorize(request, env) {
  const domain = env.ACCESS_TEAM_DOMAIN, aud = env.ACCESS_AUD;
  const allowed = (env.ALLOWED_EMAILS || '').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  if (!domain || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain) || !aud || !allowed.length) return {ok:false, status:503};
  try {
    const token = request.headers.get('Cf-Access-Jwt-Assertion');
    if (!token || token.length > 16000) return {ok:false,status:401};
    const parts = token.split('.'); if(parts.length!==3) return {ok:false,status:401};
    const header=parse(parts[0]), payload=parse(parts[1]), now=Date.now()/1000;
    if(header.alg!=='RS256' || !header.kid || payload.iss!==`https://${domain}` || !Array.isArray(payload.aud) || !payload.aud.includes(aud) || !Number.isFinite(payload.exp) || payload.exp<=now || !Number.isFinite(payload.iat) || payload.iat>now+30 || (payload.nbf!==undefined && (!Number.isFinite(payload.nbf) || payload.nbf>now+30)) || !payload.sub || typeof payload.email!=='string') return {ok:false,status:401};
    if(cached.domain!==domain || cached.expires<Date.now()) {
      const response=await fetch(`https://${domain}/cdn-cgi/access/certs`, {signal:AbortSignal.timeout(8000)});
      if(!response.ok) throw new Error('keys');
      const data=await response.json(); if(!Array.isArray(data.keys)) throw new Error('keys');
      cached={domain,expires:Date.now()+300000,keys:data.keys};
    }
    const jwk=cached.keys.find(k=>k.kid===header.kid && k.kty==='RSA'); if(!jwk) return {ok:false,status:401};
    const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    const verified=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]));
    if(!verified) return {ok:false,status:401};
    return allowed.includes(payload.email.toLowerCase()) ? {ok:true,email:payload.email} : {ok:false,status:403};
  } catch { return {ok:false,status:401}; }
}
