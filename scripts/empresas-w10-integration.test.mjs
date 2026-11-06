import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {runInNewContext} from 'node:vm';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('W10: 10 módulos conectados a componentes reais, sem importar domínios militares',()=>{
  const page=read('components/company/CompanyOperationalModule.tsx');
  for(const component of [
    'CompanyOrdersPanel','CompanyCommitmentsPanel','CompanyCustomersPanel',
    'SourceSuppliersWorkspace','CatalogWorkspace','CompanyPurchasesWorkspace',
    'InventoryWorkspace','AllocationWorkspace','FinanceWorkspace','FinanceInsights',
    'CompanyNeReview','CompanyTeamWorkspace'
  ]) assert.match(page,new RegExp(component));
  assert.doesNotMatch(page,/features\/warehouse|\/central-depositos|lib\/billing/);
  assert.match(read('app/empresa/[section]/page.tsx'),/CompanyOperationalModule/);
});
test('W10: index created atomically with acceptance and permissions checked live',()=>{
  assert.match(read('lib/server/companyMembership/firestore.ts'),/writes\.push\(\{/);
  assert.match(read('lib/server/companyMembership/index.ts'),/existingUpdateTime: index\?\.updateTime/);
  assert.match(read('lib/server/companyAuthz/index.ts'),/checkLiveMemberCapability/);
  assert.match(read('lib/server/companySession.ts'),/companyMemberAuthIndex/);
  assert.match(read('lib/server/companySession.ts'),/checkLiveMemberCapability/);
});
test('W10: pilot stays off by default and W9/W11 are pending',()=>{
  assert.match(read('lib/server/companyAuthz/index.ts'),/EMPROVEX_COMPANY_PILOT_ENABLED === '1'/);
  assert.match(read('lib/company/integration/deliveryRoutingContract.ts'),/requiresHumanApproval: true/);
  assert.doesNotMatch(read('components/company/CompanyOperationalModule.tsx'),/RouteProposal.*dispatch/);
});


test('W10: primeiro acesso do convidado exige cadastro e verificação do email, sem grant no cliente',()=>{
  const source = read('app/empresa-convite/page.tsx');
  assert.match(source,/createUserWithEmailAndPassword/);
  assert.match(source,/sendEmailVerification/);
  assert.match(source,/getIdToken\(true\)/);
  assert.match(source,/\/api\/company\/members\/accept/);
  assert.doesNotMatch(source,/localStorage\.setItem|document\.cookie|company:write/);
});
test('W10: proposta de rota é cobertura explícita, nunca despacho automático',()=>{
  const source = read('lib/company/integration/deliveryRoutingContract.ts');
  const out={};
  const c=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
  assert.equal(c.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length??0,0);
  runInNewContext(c.outputText,{exports:out});
  const base={companyId:'company-a',workspaceId:'company-a',source:'manual',status:'draft',
    stops:[{candidateDeliveryId:'delivery-1',sequence:1}],unassigned:[],requiresHumanApproval:true};
  assert.equal(out.proposalNeedsReview(['delivery-1'],base),false);
  assert.equal(out.proposalNeedsReview(['delivery-1','delivery-2'],base),true);
  assert.equal(out.proposalNeedsReview(['delivery-1'],{...base,stops:[
    {candidateDeliveryId:'delivery-1',sequence:1},
    {candidateDeliveryId:'delivery-2',sequence:1}
  ]}),true);
});
