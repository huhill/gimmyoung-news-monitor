// Cloudflare counters are approximate and per location, not a worldwide daily cap.
function failure(message,status){return Response.json({error:message},{status,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Retry-After':'60'}});}
export async function collectionGate(request,env){
  if(!env.COLLECT_IP_LIMITER||!env.COLLECT_TOTAL_LIMITER)return failure('수집 제한 설정이 아직 반영되지 않았습니다. 최신 배포를 확인해주세요.',503);
  try{
    const ip=request.headers.get('CF-Connecting-IP')||'unknown';
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip));
    const key=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
    if(!(await env.COLLECT_IP_LIMITER.limit({key})).success)return failure('수집은 같은 네트워크에서 분당 약 6회까지 가능합니다. 1분 후 다시 시도해주세요.',429);
    if(!(await env.COLLECT_TOTAL_LIMITER.limit({key:'news-collection'})).success)return failure('수집 요청이 몰리고 있습니다. 1분 후 다시 시도해주세요.',429);
    return null;
  }catch{return failure('수집 제한 서비스를 확인할 수 없습니다. 잠시 후 다시 시도해주세요.',503);}
}
export async function limitedBody(request){
  const reader=request.body?.getReader();if(!reader)throw new Error('수집 기간을 입력해주세요.');
  let size=0,text='';const decoder=new TextDecoder();
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>1024){await reader.cancel();throw new Error('요청이 너무 큽니다.');}text+=decoder.decode(part.value,{stream:true});}
  return text+decoder.decode();
}
