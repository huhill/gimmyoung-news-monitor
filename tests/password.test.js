import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
import {authorize,sessionCookie,login} from '../src/auth.js';
const env={APP_PASSWORD:'test-only-long-passphrase',ASSETS:{fetch:async()=>new Response('protected app')}};
function request(password,origin='https://monitor.example'){return new Request('https://monitor.example/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({password})});}
test('正しい password grants cookie; incorrect and cross-origin rejected',async()=>{
  assert.equal((await login(request('wrong'),env)).status,401);
  assert.equal((await login(request(env.APP_PASSWORD,'https://other.example'),env)).status,403);
  const r=await worker.fetch(request(env.APP_PASSWORD),env);assert.equal(r.status,303);const cookie=r.headers.get('Set-Cookie');assert.match(cookie,/HttpOnly; Secure; SameSite=Strict/);
  const req=new Request('https://monitor.example/',{headers:{Cookie:cookie.split(';')[0]}});assert.equal((await authorize(req,env)).ok,true);assert.equal(await(await worker.fetch(req,env)).text(),'protected app');
  assert.equal((await authorize(req,{...env,APP_PASSWORD:'different-long-password'})).ok,false);
});
test('unauthenticated UI gets login; API stays denied; expiration and tampering rejected',async()=>{
  const page=await worker.fetch(new Request('https://monitor.example/'),env);assert.match(await page.text(),/type="password"/);
  assert.equal((await worker.fetch(new Request('https://monitor.example/api/config'),env)).status,401);
  const expired=await sessionCookie(env,Date.now()-9*3600000);
  assert.equal((await authorize(new Request('https://monitor.example/',{headers:{Cookie:expired}}),env)).ok,false);
  const cookie=await sessionCookie(env);assert.equal((await authorize(new Request('https://monitor.example/',{headers:{Cookie:cookie.replace(/=\d+/, '=9999999999')}}),env)).ok,false);
});
test('logout clears cookie and rejects cross-origin requests',async()=>{
 const r=await worker.fetch(new Request('https://monitor.example/logout',{method:'POST',headers:{Origin:'https://monitor.example'}}),env);assert.equal(r.status,303);assert.match(r.headers.get('Set-Cookie'),/Max-Age=0/);
 assert.equal((await worker.fetch(new Request('https://monitor.example/logout',{method:'POST'}),env)).status,403);
});
test('repeated wrong guesses receive 429',async()=>{for(let i=0;i<10;i++)await login(request('bad'),env);assert.equal((await login(request('bad'),env)).status,429);});
