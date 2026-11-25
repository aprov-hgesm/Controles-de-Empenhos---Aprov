// Read-only release verification. Never requests authenticated data.
const [origin,source,mode='canonical']=process.argv.slice(2);
if(!origin||!/^[a-f0-9]{40}$/.test(source||''))throw new Error('Expected HTTPS origin and full source SHA');
const host=new URL(origin);if(host.protocol!=='https:')throw new Error('HTTPS required');
const expected='g'+source.slice(0,12);
const url=new URL('/controle-credito',host);
if(mode==='fresh')url.searchParams.set('releasecheck',expected+'-'+Date.now());
const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(20000)});
if(!r.ok)throw new Error('Credit HTML HTTP '+r.status);
const html=await r.text(),cache=r.headers.get('cache-control')||'';
if(!/no-store/i.test(cache))throw new Error('Credit HTML lacks no-store: '+cache);
const scripts=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m=>new URL(m[1].replaceAll('&amp;','&'),url)).filter(u=>u.origin===url.origin&&u.pathname.startsWith('/_next/static/')&&u.pathname.endsWith('.js'));
if(!scripts.length||scripts.some(s=>s.searchParams.get('dpl')!==expected))throw new Error('Credit HTML references a different deployment: '+scripts.map(s=>s.searchParams.get('dpl')).join(','));
const required=['Localizar e selecionar NC','Atualizando somente os registros','nc-choices','Prazo da Administração','Relatório geral resumido','nc-linked'];
const found=new Set();
for(let i=0;i<scripts.length;i+=6){
  await Promise.all(scripts.slice(i,i+6).map(async s=>{const res=await fetch(s,{signal:AbortSignal.timeout(20000)});if(!res.ok)throw new Error('Asset '+res.status+' '+s.pathname);const text=await res.text();const decoded=text.replace(/\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})|\\x([0-9a-fA-F]{2})/g,(match,point,unit,byte)=>{const n=parseInt(point||unit||byte,16);return n<=0x10ffff?String.fromCodePoint(n):match;});for(const mark of required)if(decoded.includes(mark))found.add(mark);}));
}
if(required.some(m=>!found.has(m)))throw new Error('Missing expected credit UI markers: '+required.filter(m=>!found.has(m)).join(', '));
console.log('CREDIT RELEASE VERIFIED',url.origin,expected,cache,'assets='+scripts.length,'markers='+[...found].join('|'));
