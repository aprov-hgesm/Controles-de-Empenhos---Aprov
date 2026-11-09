import { test, expect } from '@playwright/test';
import { registerEmulatedBillingPortal } from './emulatedBillingPortal.mjs';
import { registerEmulatedLegalAcceptance } from './emulatedLegalAcceptance.mjs';

test('P0: fundador pode abrir Admin sem crash React e sem perder estilos', async ({ page }) => {
 const problems=[];
 page.on('pageerror', e=>problems.push('JS '+String(e.stack||e).slice(0,1700)));
 page.on('console', m=>{if(m.type()==='error') problems.push('console '+m.text().slice(0,900));});
 page.on('requestfailed', q=>problems.push('request '+new URL(q.url()).pathname+' '+q.failure()?.errorText));
 await registerEmulatedBillingPortal(page.context());
 await registerEmulatedLegalAcceptance(page.context());
 await page.goto('/central-empenhos');
 await expect(page.getByTestId('sector-login-email')).toBeVisible({timeout:20000});
 await page.getByTestId('sector-login-email').fill('aprov1hgesm@gmail.com');
 await page.getByTestId('sector-login-password').fill('Emprovex-Teste!2026');
 await page.evaluate(()=>sessionStorage.setItem('emprovex_profile_mode_v1','platformAdmin'));
 await page.getByTestId('sector-login-submit').click();
 await page.waitForTimeout(4500);
 const afterAuth = await page.evaluate(()=>({path:location.pathname,text:document.body.innerText.slice(0,650)}));
 console.log('ADMIN FOUNDER after login:',JSON.stringify(afterAuth));
 console.log('ADMIN FOUNDER login errors:',problems.slice(0,15).join('\\n'));
 await page.evaluate(()=>sessionStorage.setItem('emprovex_profile_mode_v1','platformAdmin'));
 await page.goto('/admin',{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(6500);
 const state=await page.evaluate(()=>({
   url:location.pathname,text:document.body.innerText.slice(0,500),
   cssSheets:document.styleSheets.length,font:getComputedStyle(document.body).fontFamily
 }));
 console.log('ADMIN FOUNDER E2E state:',JSON.stringify(state));
 console.log('ADMIN FOUNDER E2E errors:',problems.slice(0,20).join('\n'));
 expect(state.url).toBe('/admin');
 expect(state.text).not.toContain('Não foi possível abrir esta tela');
 expect(state.cssSheets).toBeGreaterThan(0);
 expect(state.text).toContain('EMPROVEX');
 expect(problems.filter(x=>/^JS /.test(x))).toEqual([]);
});
