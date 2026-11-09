#!/usr/bin/env node
// P0 diagnostic: public GET requests only, no cookies, tokens or user data.
const targets = [
  ["official", "https://emprovex.com.br/admin"],
  ["cloudrun43", "https://s686704c61cdc---emprovex-cloudrun-candidate-kvcz7oikxq-rj.a.run.app/admin"],
];
function assets(html, tag) {
  const re=tag==="link" ? /<link\b[^>]*>/gi : /<script\b[^>]*>/gi;
  return [...html.matchAll(re)]
    .map(m=>m[0])
    .filter(s=>tag==="script" ? /\bsrc=/.test(s) : /\brel=["']stylesheet["']/.test(s))
    .map(s=>s.match(/\b(?:href|src)=["']([^"']+)["']/)?.[1])
    .filter(Boolean)
    .map(s=>s.replaceAll("&amp;","&"));
}
async function fetchText(url) {
  const res=await fetch(url,{redirect:"follow",signal:AbortSignal.timeout(18000),headers:{"Cache-Control":"no-cache"}});
  const body=await res.text();
  return {res,body};
}
let bad=false;
for(const [kind,base] of targets) {
  try {
    const {res,body}=await fetchText(base+"?diag=emprovex-p0-20261109");
    console.log("\n"+kind+" PAGE",res.status,"type",res.headers.get("content-type"),
      "cache",res.headers.get("cache-control"),"bytes",body.length);
    const css=assets(body,"link"), js=assets(body,"script");
    console.log(kind,"stylesheet count",css.length,"scripts count",js.length,"admin text",body.includes("EMPROVEX // ADMIN"));
    if(!res.ok||css.length===0||js.length===0) bad=true;
    // Verificar todos os scripts, especialmente app/admin/page-*.js; antes apenas os 5 primeiros eram testados.
    for(const [type,files] of [["CSS",css],["JS",js]]) {
      for(const file of files) {
        try{
          const target=new URL(file,base).href;
          const {res:r,body:b}=await fetchText(target);
          const ct=r.headers.get("content-type")||"";
          console.log(kind,type, new URL(target).pathname, r.status,ct,
            "bytes",b.length,"cache",r.headers.get("cache-control"),
            "html-body",/<!doctype html/i.test(b.slice(0,120)));
          if(!r.ok || (type==="CSS"&&!/text\/css/i.test(ct)) ||
            (type==="JS"&&!/javascript|ecmascript/i.test(ct)))bad=true;
        }catch(e){ console.log(kind,type,file,"ERROR",String(e).slice(0,220));bad=true; }
      }
    }
  }catch(e){console.log(kind,"PAGE ERROR",String(e).slice(0,280));bad=true;}
}
if(bad)process.exitCode=1;
