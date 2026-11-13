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
  if(profile.name==='cozinha')await expect(page.getByText('Consultando mapas autorizados…')).toBeHidden({timeout:30000});
  if(profile.name==='administracao')await expect(page.getByText('Carregando / salvando informações reais…')).toBeHidden({timeout:30000});
  if(profile.name==='nutricao')await expect(page.getByText('Carregando…',{exact:true})).toBeHidden({timeout:30000});
  await page.waitForTimeout(350); // allow visual transitions to finish before taking QA evidence
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  mkdirSync(screenshots,{recursive:true});
  await page.screenshot({path:join(screenshots,profile.name+'-desktop.png'),fullPage:true});
  if(profile.name==='cozinha'){
   await expect(page.getByRole('heading',{name:'Mapas das unidades'})).toBeVisible();
   const card=page.locator('[data-testid="kitchen-map-UTI-10"]');
   await expect(card).toBeVisible({timeout:30000});
   await expect(card.getByRole('button',{name:'Confirmar recebimento'})).toBeVisible();
   await card.getByRole('button',{name:'Confirmar recebimento'}).click();
   await expect(card.getByText('A cozinha recebeu o mapa',{exact:true})).toBeVisible({timeout:20000});
   await card.getByRole('button',{name:'Abrir produção'}).click();
   await expect(page.locator('[data-mode="operations"]')).toBeVisible();
   await expect(page.locator('[data-testid="hospital-page-producao"]')).toBeVisible();
   await expect(page.getByText('Consultando mapas autorizados…')).toBeHidden({timeout:30000});
   await page.screenshot({path:join(screenshots,'cozinha-producao-desktop.png'),fullPage:true});
  }
  if(profile.name==='unidade-uti'){
   await page.getByRole('button',{name:'Pacientes',exact:true}).click();
   await expect(page.getByRole('button',{name:'+ Novo paciente'})).toBeVisible();
   await page.getByRole('button',{name:'+ Novo paciente'}).click();
   await expect(page.getByRole('form',{name:'Cadastro rápido de paciente'})).toBeVisible();
   await page.screenshot({path:join(screenshots,'unidade-cadastro-desktop.png'),fullPage:true});
   await expect(page.getByRole('textbox',{name:'Identificador institucional'})).toHaveCount(0);
   await page.getByRole('navigation',{name:'Navegação hospitalar por perfil'}).getByRole('button',{name:'Acompanhamento',exact:true}).click();
   await expect(page.getByText('A cozinha recebeu o mapa',{exact:true})).toBeVisible({timeout:30000});
   await page.getByRole('button',{name:'Registrar alteração'}).click();
   await page.getByRole('textbox',{name:'Descrição da alteração'}).fill('Leito 01: solicitação de alteração de refeição; conferir com a equipe.');
   await page.getByRole('button',{name:'Enviar ocorrência à cozinha'}).click();
   await expect(page.getByText(/Alteração registrada e encaminhada/)).toBeVisible();
   await page.screenshot({path:join(screenshots,'unidade-acompanhamento-desktop.png'),fullPage:true});
  }
  await context.close();
 });
}

test('Kitchen receives and resolves feedback with a real audit, no automatic delivery',async({browser})=>{
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 const page=await context.newPage();
 await login(page,'qa-cozinha@example.test');
 const card=page.locator('[data-testid="kitchen-map-UTI-10"]');
 await expect(card).toBeVisible({timeout:30000});
 await card.getByRole('button',{name:'Acompanhar mapa'}).click();
 await expect(card.getByText('Ocorrência pendente')).toBeVisible({timeout:30000});
 await card.getByRole('textbox',{name:'Como a ocorrência foi tratada'}).fill('Recebida pela cozinha e corrigida após contato telefônico com a unidade fictícia.');
 await card.getByRole('button',{name:'Registrar solução'}).click();
 await expect(card.getByText('Ocorrência tratada')).toBeVisible({timeout:30000});
 await expect(card.getByText('Dietas entregues nos leitos')).toHaveCount(0);
 await page.screenshot({path:join(screenshots,'cozinha-tratamento-ocorrencia.png'),fullPage:true});
 await context.close();
});

test('W12 premium mobile drawer, keyboard close and navigation',async({browser})=>{
 const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 await login(page,'qa-cozinha@example.test');
 await page.getByRole('button',{name:'Abrir menu'}).click();
 await expect(page.getByRole('navigation',{name:'Navegação hospitalar por perfil'}).getByRole('button',{name:'Distribuição',exact:true})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('button',{name:'Abrir menu'})).toBeVisible();
 await page.getByRole('button',{name:'Abrir menu'}).click();
 await page.getByRole('navigation',{name:'Navegação hospitalar por perfil'}).getByRole('button',{name:'Distribuição',exact:true}).click();
 await expect(page.locator('[data-testid="hospital-page-distribuicao"]')).toBeVisible();
 await expect(page.getByText('Consultando pedidos autorizados…')).toBeHidden({timeout:30000});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
 expect(overflow).toBeLessThanOrEqual(2);
 mkdirSync(screenshots,{recursive:true});
 await page.screenshot({path:join(screenshots,'cozinha-distribuicao-mobile.png'),fullPage:true});
 await context.close();
});
