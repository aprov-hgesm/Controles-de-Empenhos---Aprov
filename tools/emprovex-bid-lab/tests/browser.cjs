// Optional QA: PLAYWRIGHT_MODULE=/path/to/playwright node tests/browser.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{
 const extension=path.resolve(__dirname,'../extension');
 const context=await chromium.launchPersistentContext('',{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 try{
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const ready=()=>page.locator('#emprovex-bot').waitFor();
  const best=v=>page.waitForFunction(v=>JSON.parse(document.querySelector('#portal-state').textContent).best===v,v);
  const stopped=()=>page.waitForFunction(()=>document.querySelector('#emprovex-bot').shadowRoot.querySelector('#status').textContent==='stopped');
  const arm=()=>page.getByRole('button',{name:'Ativar simulação'}).click();
  const rival=async v=>{await page.locator('#rival').fill(v);await page.locator('#competitor').click();};
  await page.goto('http://127.0.0.1:8790');await ready();await arm();await best('9.9000');
  await rival('8.6000');await best('8.5000');await rival('8.4000');await stopped();
  assert.equal(await page.locator('#history li').count(),4);
  await page.reload();await ready();assert.equal(await page.locator('#emprovex-bot #status').textContent(),'Desarmado');
  await arm();await page.locator('#change').click();await stopped();
  await page.reload();await ready();await page.locator('#direction').selectOption('forward');
  await page.locator('#emprovex-bot #limit').fill('10.5000');await arm();await best('10.1000');
  await page.getByRole('button',{name:'Parar',exact:true}).click();await stopped();
  assert.deepEqual(errors,[]);
  console.log('PASS: extensão real Chromium; lance reverso, piso, reinício desarmado, troca de identidade, lance crescente e parada; zero erros de página.');
 }finally{await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
