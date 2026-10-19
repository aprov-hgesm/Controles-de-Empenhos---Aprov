import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');
const contract = read('lib/admin2/customers/unifiedCustomerOnboarding.ts');
const sector = read('lib/sectorProvisioning.ts');
const provisioner = read('lib/server/sectorProvisioningAdmin.ts');
const onboarding = read('components/admin2/customers/AdminUnifiedCustomerCreate.tsx');
const management = read('components/admin2/customers/AdminCustomerManagement.tsx');
const directory = read('components/admin2/customers/AdminCustomersDirectory.tsx');
const billing = read('lib/billing.ts');

test('onboarding usa contrato já existente, trial obrigatório de 30 dias e ID compartilhado', () => {
  assert.match(contract, /ADMIN2_INITIAL_TRIAL_DAYS = 30/);
  assert.match(contract, /buildProvisionedSectorRecords/);
  assert.match(contract, /buildCommercialCustomer\(\s*workspace.id/);
  assert.match(contract, /buildInitialBillingAccount\(\s*workspace,/);
  assert.match(contract, /status !== 'trial'/);
  assert.match(contract, /grantTrial: true/);
  assert.match(billing, /defaultTrialDays: 30/);
  assert.match(billing, /monthlyPriceCents: EMPROVEX_FULL_PLAN_PRICE_CENTS/);
});

test('provisionamento seguro inclui comercial opcional no mesmo commit e no rollback', () => {
  assert.match(sector, /commercialCustomer\?: Omit<CommercialCustomerInput, 'workspaceId'>/);
  assert.match(sector, /validateCommercialCustomerInput/);
  assert.match(sector, /input.grantTrial !== true/);
  assert.match(provisioner, /const commercialCustomer = commercialInput/);
  assert.match(provisioner, /platformCustomers\/\$\{result.workspace.id\}/);
  assert.match(provisioner, /currentDocument: \{ exists: false \}/);
  assert.match(provisioner, /commitFirestoreWrites\(accessToken,/);
  assert.match(provisioner, /hasCommercialRecord = false/);
  assert.match(provisioner, /Boolean\(input.commercialCustomer\)/);
  assert.match(provisioner, /input.commercialCustomer\s*\n\s*\)/);
});

test('interface permite cadastro unificado sem chamar APIs reais na prévia', () => {
  assert.match(onboarding, /data-testid="admin2-unified-create"/);
  assert.match(onboarding, /createPreviewOnboarding\(input\)/);
  assert.doesNotMatch(onboarding, /fetch\s*\(|\bsignUp\s*\(|\bcreateUserWithEmailAndPassword\s*\(/);
  assert.match(onboarding, /setInput\(EMPTY\)/);
  assert.match(directory, /data-testid="admin2-unified-create-tab"/);
  assert.match(directory, /data-testid="admin2-management-tab"/);
  assert.match(directory, /onPreviewCreated/);
  assert.match(directory, /AdminUnifiedCustomerCreate/);
});

test('gestão comercial separada simula ações com confirmação e não escreve dados reais', () => {
  assert.match(management, /data-testid="admin2-customer-management"/);
  assert.match(management, /data-testid="admin2-subscription-confirm"/);
  assert.match(management, /'trial'/);
  assert.match(management, /'active'/);
  assert.match(management, /'exempt'/);
  assert.match(management, /'pending'/);
  assert.match(management, /'canceled'/);
  assert.match(management, /setOverride/);
  assert.match(management, /commercialEmulatorWritesEnabled && !isPreview/);
  assert.match(management, /grantBillingTrial\(workspace, actor, 30\)/);
  assert.match(management, /setBillingExemption\(workspace, true, actor\)/);
  assert.match(management, /setBillingCommercialStatus\(workspace, status, actor\)/);
  assert.match(management, /setOverride/);
  assert.doesNotMatch(management, /\b(?:setDoc|updateDoc|deleteDoc|runTransaction)\s*\(/);
  assert.match(management, /Redefinir senha · indisponível/);
});
