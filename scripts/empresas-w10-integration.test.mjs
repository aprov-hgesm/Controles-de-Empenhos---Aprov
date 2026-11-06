import test from 'node:test';
import assert from 'node:assert/strict';
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
