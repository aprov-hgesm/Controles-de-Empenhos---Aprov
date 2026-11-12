import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';

const origin='http://127.0.0.1:3100';
const screenshots=join(process.env.RUNNER_TEMP||process.cwd(),'hospital-w12-premium-visual');
const accounts=[
  {name:'cozinha',email:'qa-cozinha@example.test',expected:['Painel da Cozinha','Produção','Distribuição','Ocorrências','Relatórios'],denied:'Pacientes'},
  {name:'unidade-uti',email:'qa-uti@example.test',expected:['Início','Pacientes','Dietas prescritas','Meus Mapas','Acompanhamento'],denied:'Produção'},
  {name:'nutricao',email:'qa-nutricao@example.test',expected:['Auditoria nutricional'],denied:'Administração hospitalar'},
  {name:'administracao',email:'qa-admin@example.test',expected:['Administração hospitalar'],denied:'Pacientes'},
];

async function login(page,email){
  await page.goto(origin+'/cozinha-dietetica',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'Cozinha Dietética'})).toBeVisible();
  await page.getByLabel('E-mail institucional').fill(email);
  await page.getByLabel('Senha').fill('DemoLocal!2026');
  await page.getByRole('button',{name:/Entrar e validar vínculo/}).click();
  await expect(page.getByText('Vínculo verificado pelo servidor')).toBeVisible({timeout:30000});
  await page.getByRole('link',{name:/Acessar módulo hospitalar/}).click();
  await expect(page.getByText('EMPROVEX',{exact:true})).toBeVisible({timeout:30000});
}

for(const profile of accounts){
 test('W12 premium shell authenticated real UI: '+profile.name,async({browser})=>{
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage();
  await login(page,profile.email);
  for(const label of profile.expected){
   await expect(page.getByRole('navigation',{name:'Navegação hospitalar por perfil'}).getByRole('button',{name:label,exact:true})).toBeVisible();
  }
  await expect(page.getByRole('navigation',{name:'Navegação hospitalar por perfil'}).getByRole('button',{name:profile.denied,exact:true})).toHaveCount(0);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  mkdirSync(screenshots,{recursive:true});
  await page.screenshot({path:join(screenshots,profile.name+'-desktop.png'),fullPage:true});
  if(profile.name==='cozinha'){
   await page.getByRole('button',{name:'Produção',exact:true}).click();
   await expect(page.locator('[data-testid="hospital-page-producao"]')).toBeVisible();
   await page.screenshot({path:join(screenshots,'cozinha-producao-desktop.png'),fullPage:true});
  }
  if(profile.name==='unidade-uti'){
   await page.getByRole('button',{name:'Pacientes',exact:true}).click();
   await expect(page.getByRole('button',{name:'+ Novo paciente'})).toBeVisible();
   await page.getByRole('button',{name:'+ Novo paciente'}).click();
   await expect(page.getByRole('form',{name:'Cadastro rápido de paciente'})).toBeVisible();
   await page.screenshot({path:join(screenshots,'unidade-cadastro-desktop.png'),fullPage:true});
  }
  await context.close();
 });
}

test('W12 premium mobile drawer, keyboard close and navigation',async({browser})=>{
 const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 await login(page,'qa-cozinha@example.test');
 await page.getByRole('button',{name:'Abrir menu'}).click();
 await expect(page.getByRole('button',{name:'Distribuição',exact:true})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('button',{name:'Abrir menu'})).toBeVisible();
 await page.getByRole('button',{name:'Abrir menu'}).click();
 await page.getByRole('button',{name:'Distribuição',exact:true}).click();
 await expect(page.locator('[data-testid="hospital-page-distribuicao"]')).toBeVisible();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
 expect(overflow).toBeLessThanOrEqual(2);
 mkdirSync(screenshots,{recursive:true});
 await page.screenshot({path:join(screenshots,'cozinha-distribuicao-mobile.png'),fullPage:true});
 await context.close();
});
