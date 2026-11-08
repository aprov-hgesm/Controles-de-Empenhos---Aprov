import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTenantRequestBoundary, fiscalSubmissionGate, safeConnection, safeIssues } from '../features/company/fiscal/flow.mjs';
import { createFiscalBrowserApi } from '../features/company/fiscal/api.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const page = read('components/company/CompanyOperationalModule.tsx');
const route = read('app/api/company/fiscal/nfe/route.ts');
const fiscal = read('components/company/fiscal/FiscalIssuanceWorkspace.tsx');
const workflow = read('.github/workflows/emprovex-empresas-w10.yml');
const profileA = { companyId: 'empresa-a', workspaceId: 'empresa-a',
  cnpj: '11222333000181', name: 'A', legalName: 'Empresa A' };
const profileB = { companyId: 'empresa-b', workspaceId: 'empresa-b',
  cnpj: '44555666000191', name: 'B', legalName: 'Empresa B' };

test('W10-IV monta o W15 apenas na aba empresarial notas-fiscais', () => {
  assert.match(page, /import\s*\{\s*FiscalIssuanceWorkspace\s*\}\s*from\s*'\.\/fiscal\/FiscalIssuanceWorkspace'/);
  const invoiceCase = page.split("case 'notas-fiscais':")[1]?.split("case 'financeiro':")[0] ?? '';
  assert.match(invoiceCase, /<FiscalIssuanceWorkspace\s+key=/);
  assert.match(invoiceCase, /getIdToken=\{getIdToken\}/);
  assert.doesNotMatch(page.split("case 'estoque':")[1]?.split("case 'notas-fiscais':")[0] ?? '', /FiscalIssuanceWorkspace/);
});

test('ao trocar CNPJ a UI fiscal desmonta e descarta dados do tenant anterior', () => {
  assert.match(page, /key=\{session\?\.workspaceId\s*\|\|\s*'sem-perfil'\}/);
  assert.match(fiscal, /createTenantRequestBoundary/);
  assert.doesNotMatch(fiscal, /<CompanyProfileSwitcher/);
  assert.match(read('components/company/CompanySessionGate.tsx'), /<CompanyProfileSwitcher/);
  const boundary = createTenantRequestBoundary();
  boundary.rotate(profileA.companyId);
  const pendingA = boundary.capture(profileA.companyId);
  boundary.rotate(profileB.companyId);
  assert.equal(pendingA.signal.aborted, true);
  assert.equal(pendingA.current(), false);
});

test('financeiro W8 permanece separado sem transição automática por NF-e', () => {
  const invoiceCase = page.split("case 'notas-fiscais':")[1]?.split("case 'financeiro':")[0] ?? '';
  assert.match(invoiceCase, /<FinanceWorkspace\s+getIdToken=/);
  assert.match(invoiceCase, /não autorizam NF-e, atesto ou baixa automática/);
  assert.match(page, /case 'financeiro':/);
});

test('GET fiscal usa fiscal:read live e POST exige fiscal:issue', () => {
  assert.match(route, /return handle\(request, 'fiscal:read'\)/);
  assert.match(route, /return handle\(request, 'fiscal:issue'\)/);
  assert.match(route, /requireCompanyContext\(request, \{ action \}\)/);
  assert.doesNotMatch(route, /accountsReceivable:(read|write)/);
});

test('endpoint de NF-e segue 503 fail-closed, sem efeitos colaterais', () => {
  assert.match(route, /NFE_INTEGRATION_PENDING/);
  assert.match(route, /status:\s*503/);
  assert.doesNotMatch(route, /createFiscalStore|createFiscalTransport|emitInvoice|fetch\(/);
  assert.match(route, /Cache-Control/);
  assert.match(route, /no-store/);
});

test('a mera conexão WLG em homologação não habilita POST fiscal', () => {
  const connection = safeConnection({ok:true,connection:{
    provider:'wlg',issuerCnpj:profileA.cnpj,status:'connected',
    environment:'homologacao',verifiedAt:'2026-11-06T00:00:00Z'
  }},profileA);
  const gate = fiscalSubmissionGate({
    profile:profileA,connection,capabilities:null,
    draft:{companyId:profileA.companyId,issuerCnpj:profileA.cnpj,orderId:'pedido-1',
      recipientCnpj:'77888999000166',recipientName:'OM A',
      series:1,number:1,items:[{itemId:'item-1'}]},
    confirmed:true,busy:false,uncertain:false,
  });
  assert.equal(gate.allowed,false);
  assert.equal(gate.code,'BACKEND_DISABLED');
});

test('metadados fiscais de B não podem aparecer em A', () => {
  const docs = safeIssues({ok:true,items:[
    {id:'a-1',companyId:profileA.companyId,issuerCnpj:profileA.cnpj,status:'processing'},
    {id:'b-1',companyId:profileB.companyId,issuerCnpj:profileB.cnpj,status:'authorized',
      accessKey:'1'.repeat(44),authorizationProtocol:'100',authorizationVerified:true},
  ]},profileA);
  assert.deepEqual(docs.map(x=>x.id),['a-1']);
  assert.equal(docs[0].accessKey,null);
});

test('requisição fiscal usa Bearer e never retries POST 503 de integração', async () => {
  let count = 0;
  const api = createFiscalBrowserApi({
    getIdToken:async()=> 'qa-token',
    fetchImpl:async (_url,options) => {
      count++;
      assert.equal(options.headers.Authorization,'Bearer qa-token');
      assert.equal(options.credentials,'same-origin');
      assert.equal(options.cache,'no-store');
      return {ok:false,status:503,json:async()=>({ok:false,code:'NFE_INTEGRATION_PENDING'})};
    }
  });
  await assert.rejects(api.submit({action:'create_draft'},'fixed-once'),{code:'NFE_INTEGRATION_PENDING'});
  assert.equal(count,1);
});

test('CI de integração incorpora a suíte W15 e regressão W10-IV', () => {
  assert.match(workflow, /node --test tests\/company\/fiscal\/flow\.test\.mjs/);
  assert.match(workflow, /node --test scripts\/empresas-w10-stage4-fiscal\.test\.mjs/);
});
