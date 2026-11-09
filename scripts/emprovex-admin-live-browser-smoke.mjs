#!/usr/bin/env node
// Diagnóstico público do /admin. Não utiliza credenciais, usuários ou cookies.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const urls = [
  ['official', 'https://emprovex.com.br/admin'],
  ['cloudrun42', 'https://s6c9b02062661---emprovex-cloudrun-candidate-kvcz7oikxq-rj.a.run.app/admin'],
];
await mkdir('artifacts/admin-p0', { recursive: true });
const browser=await chromium.launch({headless:true, args:['--disable-dev-shm-usage']});
let failures=0;
for(const [key,url] of urls) {
 const context=await browser.newContext({viewport:{width:1400,height:900},ignoreHTTPSErrors:false});
 const page=await context.newPage();
 const errors=[],requests=[],consoleErrors=[],badResponses=[];
 page.on('pageerror',e=>errors.push(String(e.stack||e).slice(0,1500)));
 page.on('requestfailed',req=>requests.push(req.method()+' '+new URL(req.url()).pathname+' '+(req.failure()?.errorText||'')));
 page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text().slice(0,600));});
 page.on('response',res=>{if(res.status()>=400)badResponses.push(String(res.status())+' '+new URL(res.url()).pathname)});
 let loaded='';
 try {const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});loaded=String(r?.status());await page.waitForTimeout(8500);}
 catch(e){loaded=String(e).slice(0,300);failures++;}
 const state=await page.evaluate(()=>{
  const el=document.querySelector('h1')||document.querySelector('main')||document.body;
  const s=getComputedStyle(el);
  return {title:document.title,text:(document.body.innerText||'').slice(0,900),font:s.fontFamily,
    bg:s.backgroundColor,cssSheetCount:document.styleSheets.length,htmlMode:document.documentElement.dataset.visualMode,
    readyState:document.readyState,scriptCount:document.scripts.length};
 }).catch(e=>({evaluateError:String(e)}));
 await page.screenshot({path:'artifacts/admin-p0/'+key+'.png',fullPage:false}).catch(()=>{});
 console.log('\nBROWSER '+key+' load='+loaded+' finalURL='+page.url()+' state='+JSON.stringify(state));
 for(const [label,items] of [['pageerror',errors],['console_error',consoleErrors],['request_failed',requests],['response>=400',badResponses]]) {
  console.log(key+' '+label+' count='+items.length);
  for(const msg of [...new Set(items)].slice(0,14))console.log('  '+msg);
 }
 if(errors.length)failures++;
 await context.close();
}
await browser.close();
if(failures>0)process.exitCode=1;
