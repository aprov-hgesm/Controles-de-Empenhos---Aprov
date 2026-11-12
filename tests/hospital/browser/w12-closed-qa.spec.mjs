import {test,expect} from '@playwright/test';
import {join} from 'node:path';
import {mkdirSync} from 'node:fs';

const origin='http://127.0.0.1:3333';
const out=join(process.env.RUNNER_TEMP||process.cwd(),'hospital-w12-visual');
const devices=[
 {name:'android-viewport',viewport:{width:393,height:852},isMobile:true,hasTouch:true},
 {name:'desktop-viewport',viewport:{width:1440,height:900},isMobile:false,hasTouch:false}
];

for(const device of devices){
 test('W12 locked hospital landing responsive and keyboard-accessible — '+device.name,async({browser})=>{
  const context=await browser.newContext({viewport:device.viewport,
   isMobile:device.isMobile,hasTouch:device.hasTouch,deviceScaleFactor:1});
  const page=await context.newPage();
  const response=await page.goto(origin+'/cozinha-dietetica',{waitUntil:'domcontentloaded'});
  expect(response.status()).toBe(200);
  await expect(page.getByRole('heading',{name:'Cozinha Dietética'})).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Acesso hospitalar não habilitado');
  await expect(page.getByRole('link',{name:'Voltar ao portal'})).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link',{name:'Voltar ao portal'})).toBeFocused();
  const body=await page.locator('body').innerText();
  expect(body).not.toContain('Paciente Fictício');
  mkdirSync(out,{recursive:true});
  await page.screenshot({path:join(out,device.name+'-locked.png'),fullPage:true});
  const workspace=await page.goto(origin+'/cozinha-dietetica/app',{waitUntil:'domcontentloaded'});
  expect(workspace.status()).toBe(200);
  await expect(page.getByRole('alert')).toContainText('Ambiente hospitalar indisponível');
  await page.screenshot({path:join(out,device.name+'-workspace-closed.png'),fullPage:true});
  await context.close();
 });
}

test('W12 manifest PWA and install-icons available without any clinical cache',async({request})=>{
 const manifest=await request.get(origin+'/manifest.webmanifest');
 expect(manifest.status()).toBe(200);
 const m=await manifest.json();
 expect(m.display).toBe('standalone');
 expect(m.icons.length).toBeGreaterThanOrEqual(2);
 const icon=await request.get(origin+'/api/install-icon/192');
 expect(icon.status()).toBe(200);
 expect(icon.headers()['content-type']).toContain('image/');
 const clinical=await request.get(origin+'/api/hospital/patients?operation=patient.search&unitId=UTI');
 expect([401,403,503]).toContain(clinical.status());
 expect(clinical.headers()['cache-control']).toContain('no-store');
});
