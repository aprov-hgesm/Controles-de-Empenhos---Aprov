import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const files = new Map([['/', ['simulator/index.html','text/html']],['/portal.mjs',['simulator/portal.mjs','text/javascript']],['/engine.mjs',['extension/engine.mjs','text/javascript']]]);
createServer(async (req,res) => {
  if (req.headers.host !== '127.0.0.1:8790' || req.method !== 'GET') {res.writeHead(403);res.end();return;}
  const entry = files.get(req.url);
  if (!entry) {res.writeHead(404);res.end();return;}
  try {const data=await readFile(new URL(entry[0],import.meta.url));res.writeHead(200,{'Content-Type':entry[1]+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; frame-ancestors 'none'"});res.end(data);}
  catch {res.writeHead(500);res.end('Arquivo indisponível');}
}).listen(8790,'127.0.0.1',()=>console.log('Laboratório: http://127.0.0.1:8790 — apenas simulação.'));
