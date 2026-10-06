#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

const billing = read('lib/billing.ts');
const billingStore = read('lib/platformBillingStore.ts');
const provisioning = read('lib/server/sectorProvisioningAdmin.ts');
const lifecycle = read('lib/server/sectorLifecycleAdmin.ts');
const access = read('lib/platformAccess.ts');
const capacity = read('lib/platformCapacity.ts');
const sessionControl = read('lib/platformSessionControl.ts');
const legalVersions = read('lib/legalVersions.ts');
const legalAcceptance = read('lib/legalAcceptance.ts');
const page = read('app/page.tsx');
const warehouseSurface = read('features/warehouse/components/WarehouseProtectedSurface.tsx');
const health = read('app/api/health/route.ts');
const login = read('components/auth/EmprovexLogin.tsx');
const packageJson = read('package.json');

assert.match(billing, /EMPROVEX_FULL_PLAN_PRICE_CENTS = 7000/);
assert.match(billing, /defaultTrialDays:\s*30/);
assert.match(billing, /dueBusinessDay:\s*5/);
assert.match(billing, /gracePeriodDays:\s*10/);
assert.match(billing, /BillingExemptionSource = 'founder' \| 'manual' \| 'legacy_vip'/);
assert.match(billingStore, /Plano Completo EMPROVEX possui mensalidade fixa de R\$ 70,00 na R1/);
assert.match(billing, /competência|BillingCycle/i);
assert.doesNotMatch(access, /billingAccounts/);
assert.doesNotMatch(lifecycle, /billingAccounts\//);

assert.match(provisioning, /platformUgIndex\/\$\{ug\}/);
assert.match(provisioning, /billingAccounts\/\$\{result\.workspace\.id\}/);
assert.match(provisioning, /currentDocument:\s*\{ exists: false \}/);
assert.match(provisioning, /emailVerified:\s*true/);
assert.match(access, /signInProvider !== FOUNDER_AUTH_PROVIDER/);
assert.match(access, /signInProvider !== SECTOR_AUTH_PROVIDER/);
assert.match(access, /account\.firebaseUid && account\.firebaseUid !== user\.uid/);
assert.match(access, /workspace\.status !== 'active'/);
assert.match(access, /UG_MISMATCH/);
assert.doesNotMatch(login, /createUserWithEmailAndPassword/);

assert.match(legalVersions, /legalBundleVersion:\s*'saas-r1-2026-10-01'/);
assert.match(legalAcceptance, /legalAcceptances/);
assert.match(legalAcceptance, /record\.workspaceId === normalized\.workspaceId/);
assert.match(legalAcceptance, /record\.uid === normalized\.uid/);
assert.match(page, /<LegalAcceptanceGate/);
assert.match(warehouseSurface, /<LegalAcceptanceGate/);

assert.match(lifecycle, /WAREHOUSE_ACCESS_COLLECTION = 'warehouseAccess'/);
assert.match(lifecycle, /sessionRevocations/);
assert.match(lifecycle, /sessionSlots/);
assert.match(lifecycle, /Fail closed primeiro/);
assert.match(lifecycle, /warehouse_reactivation_compensation/);

assert.match(capacity, /DEFAULT_EXTERNAL_SECTOR_SESSION_LIMIT:\s*SimultaneousSessionLimit = null/);
assert.match(capacity, /LEGACY_SESSION_SLOT_IDS = \['slot-1', 'slot-2'\]/);
assert.match(capacity, /SESSION_LEASE_DURATION_MS = 30 \* 60 \* 1000/);
assert.match(capacity, /SESSION_HEARTBEAT_INTERVAL_MS = 15 \* 60 \* 1000/);
assert.match(sessionControl, /subscribeWorkspaceSessionRevocation/);
assert.match(sessionControl, /invalidateLocalSession\('lease-lost'\)/);

assert.match(health, /export async function GET/);
assert.match(health, /status:\s*'ok'/);
assert.match(health, /Cache-Control/);
assert.match(health, /no-store/);
assert.doesNotMatch(health, /firebase|firestore|getDoc|getDocs|billingAccounts|process\.env|apiKey|secret/i);

const pkg = JSON.parse(packageJson);
assert.equal(pkg.dependencies.jspdf, '^4.2.1');
assert.equal(pkg.dependencies['jspdf-autotable'], '^5.0.8');

console.log('SAAS R1 FINAL AUDIT CONTRACT GUARD: READY');
console.log('Commercial contract: R$ 70 / 30d trial / 5th business day / 10d grace');
console.log('Identity: founder Google-only / external password-only / UID+workspace+UG fail-closed');
console.log('Legal: versioned gate active on main and Warehouse surfaces');
console.log('Lifecycle: billing-decoupled / session revocation / warehouseAccess sync');
console.log('Sessions: unlimited external capacity / 30m lease / 15m heartbeat / legacy slot compatibility');
console.log('Health: tiny public no-store endpoint without operational dependencies');
console.log('PDF stack: jsPDF 4.2.1 / AutoTable 5.0.8');
