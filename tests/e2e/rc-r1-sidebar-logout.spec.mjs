import { test, expect } from '@playwright/test';

for (const viewport of [{width:545,height:374},{width:390,height:844},{width:844,height:390},{width:1440,height:1000}]) {
  test(`sidebar logout is reachable and revokes UI access at ${viewport.width}x${viewport.height}`, async ({page}) => {
    await page.goto('/');
    await page.getByTestId('sector-login-email').fill('sector-lifecycle@example.test');
    await page.getByTestId('sector-login-password').fill('Emprovex-Teste!2026');
    await page.getByTestId('sector-login-submit').click();
    const legal=page.getByRole('heading',{name:'Termos e Privacidade'});
    const nav=page.getByRole('navigation',{name:'Navegação principal'});
    await expect(nav.or(legal)).toBeVisible({timeout:20000});
    if(await legal.isVisible().catch(()=>false)) {
      await page.getByRole('checkbox',{name:'Li e aceito os Termos de Serviço e a Política de Privacidade.'}).check();
      await page.getByRole('button',{name:'Aceitar e continuar'}).click();
    }
    await expect(nav).toBeVisible();
    await page.setViewportSize(viewport);
    if(viewport.width<1024) await page.getByRole('button',{name:'Abrir menu principal'}).click();
    const logout=page.getByTestId('logout');
    await logout.scrollIntoViewIfNeeded();
    await expect(logout).toBeVisible();
    await expect.poll(()=>logout.evaluate(button=>{
      const r=button.getBoundingClientRect();
      return button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
    })).toBe(true);
    await logout.click();
    await expect(page.getByTestId('sector-login-email')).toBeVisible({timeout:20000});
    await page.reload();
    await expect(page.getByTestId('sector-login-email')).toBeVisible();
    await page.goto('/adm-deposito/estoque');
    await expect(page.getByTestId('sector-login-email')).toBeVisible({timeout:20000});
  });
}
