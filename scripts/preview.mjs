// UI-only loopback preview. Never deploy this server or use it as an auth bypass.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const root=new URL('../public/',import.meta.url);
const paths={'/':'index.html','/app.js':'app.js','/styles.css':'styles.css'};
const types={html:'text/html;charset=utf-8',js:'text/javascript;charset=utf-8',css:'text/css;charset=utf-8'};
createServer(async(req,res)=>{
  const path=new URL(req.url,'http://127.0.0.1').pathname;
  res.setHeader('Cache-Control','no-store');
  if(path==='/api/config'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({preview:true,newsReady:false}));return;}
  if(path==='/api/collect'){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'화면 미리보기에서는 실제 수집하지 않습니다.'}));return;}
  const name=paths[path];if(!name){res.writeHead(404);res.end();return;}
  try{res.setHeader('Content-Type',types[name.split('.').pop()]);res.end(await readFile(new URL(name,root)));}catch{res.writeHead(500);res.end('Preview error');}
}).listen(4173,'127.0.0.1',()=>console.log('Local preview: http://127.0.0.1:4173'));
