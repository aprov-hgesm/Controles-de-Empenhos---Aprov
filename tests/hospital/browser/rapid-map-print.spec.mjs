import {test,expect} from '@playwright/test';
import {readFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
const screenshots=join(process.env.RUNNER_TEMP||process.cwd(),'hospital-rapid-map-visual');
import {PDFDocument} from 'pdf-lib';

const origin='http://127.0.0.1:3100';
const future=offset=>{
 const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'})
  .formatToParts(new Date(Date.now()+offset*86400000));
 const v=type=>p.find(x=>x.type===type)?.value??'';
 return v('year')+'-'+v('month')+'-'+v('day');
};
async function unit(page){
 await page.goto(origin+'/cozinha-dietetica',{waitUntil:'domcontentloaded'});
 await page.getByLabel('E-mail institucional').fill('qa-uti@example.test');
 await page.getByLabel('Senha').fill('DemoLocal!2026');
 await page.getByRole('button',{name:/Entrar e validar vínculo/}).click();
 await expect(page.getByText('Vínculo verificado pelo servidor')).toBeVisible({timeout:30000});
 await page.getByRole('link',{name:/Acessar módulo hospitalar/}).click();
 await expect(page.getByText('EMPROVEX',{exact:true})).toBeVisible({timeout:30000});
 await page.getByRole('navigation',{name:'Navegação hospitalar por perfil'}).getByRole('button',{name:'Meus Mapas',exact:true}).click();
}
test('Recibo isolado: PDF A4 retrato, download funcional e status de envio correto',async({browser})=>{
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:900}});
 const page=await context.newPage();
 await unit(page);
 const maps=page.locator('[data-testid="hospital-page-mapas"]');
 await maps.getByRole('button',{name:'10h',exact:true}).click();
 await maps.getByLabel('Data local').fill(future(2));
 const existing=maps.getByRole('button',{name:/Enviado ·/}).first();
 await expect(existing).toBeVisible({timeout:30000});
 await existing.click();
 const receipt=page.locator('[data-testid="map-receipt"]');
 await expect(receipt).toBeVisible({timeout:30000});
 await expect(receipt).toContainText('Comprovante de envio');
 await expect(receipt).toContainText('Enviado pela unidade');
 await expect(receipt).toContainText('Recebido pela Cozinha');
 await expect(receipt).not.toContainText('Paciente Totalmente Fictício');
 mkdirSync(screenshots,{recursive:true});
 await receipt.screenshot({path:join(screenshots,'comprovante-envio-premium.png')});
 await expect(page.getByRole('button',{name:'Imprimir somente recibo'})).toHaveCount(0);
 const pending=page.waitForEvent('download');
 await page.locator('[data-testid="map-receipt-download"]').click();
 const downloaded=await pending;
 expect(downloaded.suggestedFilename()).toMatch(/^comprovante-envio-.*\.pdf$/);
 const bytes=readFileSync(await downloaded.path());
 expect(bytes.subarray(0,4).toString()).toBe('%PDF');
 const doc=await PDFDocument.load(bytes);
 expect(doc.getPageCount()).toBe(1);
 const size=doc.getPage(0).getSize();
 expect(size.height).toBeGreaterThan(size.width); // A4 portrait, not site-wide printing
 expect(Math.round(size.width)).toBe(595);
 await context.close();
});
test('Cadastro de textura pastosa não exige item pastoso no catálogo',async({browser})=>{
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 const page=await context.newPage();
 await unit(page);
 const maps=page.locator('[data-testid="hospital-page-mapas"]');
 await maps.getByLabel('Data local').fill(future(3));
 await maps.getByRole('button',{name:'06h',exact:true}).click();
 await maps.getByRole('button',{name:'Iniciar mapa de dietas'}).click();
 const form=page.locator('[data-testid="map-rapid-entry"]');
 await expect(form).toBeVisible({timeout:30000});
 await form.getByLabel('Consistência da dieta').selectOption('PASTOSA');
 await expect(form.getByText(/Cadastre ou habilite no catálogo/)).toHaveCount(0);
 await expect(form.getByText(/Nenhuma base oral ativa/)).toHaveCount(0);
 mkdirSync(screenshots,{recursive:true});
 await form.screenshot({path:join(screenshots,'consistencia-pastosa-sem-bloqueio.png')});
 await form.getByLabel('Nome completo do paciente').fill('Pessoa Fictícia Teste Pastosa');
 await form.getByLabel('Data de nascimento').fill('1995-02-15');
 await form.getByLabel('Número do leito').fill('99-TESTE');
 await form.getByRole('checkbox',{name:/Confirmo que esta dieta/}).check();
 await expect(form.getByRole('button',{name:'Salvar e concluir mapa'})).toBeEnabled();
 await form.getByRole('button',{name:'Salvar e concluir mapa'}).click();
 await expect(form).toHaveCount(0,{timeout:30000});
 await expect(maps.getByRole('cell',{name:/Pessoa Fictícia Teste Pastosa/}).first()).toBeVisible({timeout:30000});
 await expect(maps.getByRole('button',{name:'Enviar mapa de dietas à cozinha'})).toBeVisible();
 await context.close();
});
