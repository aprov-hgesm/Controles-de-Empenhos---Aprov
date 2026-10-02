#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

const page = read('app/page.tsx');
const operationalData = read('hooks/useOperationalData.ts');
const realtime = read('hooks/useOperationalRealtimeCollections.ts');
const inicioSnapshot = read('features/inicio/hooks/useInicioOperationalSnapshot.ts');
const warehouse = read('features/warehouse/components/WarehouseProtectedSurface.tsx');
const gate = read('components/legal/LegalAcceptanceGate.tsx');
const rootLayout = read('app/layout.tsx');
const regularization = read('app/regularizacao/page.tsx');
const login = read('components/auth/EmprovexLogin.tsx');
const platformAccess = read('lib/platformAccess.ts');
const lifecycle = read('lib/server/sectorLifecycleAdmin.ts');
const rules = read('firestore.rules');
const migration = read('scripts/saas-r1-legacy-vip.mjs');
const policy = JSON.parse(read('ops/saas-r1-legacy-vip.json'));

assert.equal(policy.cutoffDate, '2026-10-02');
assert.equal(policy.exemptionSource, 'legacy_vip');
assert.equal(policy.requireExplicitAllowlistForApply, true);

assert.match(page, /<LegalAcceptanceGate/);
assert.match(page, /acceptedLegalIdentityKey/);
assert.match(operationalData, /acceptedLegalIdentityKey === legalIdentityKey/);
assert.match(realtime, /enabled: enabled && plan\.empenhos/);
assert.match(inicioSnapshot, /!enabled\s*\|\| activeTab !== 'inicio'/);
assert.match(warehouse, /<LegalAcceptanceGate/);
assert.doesNotMatch(rootLayout, /LegalAcceptanceGate/);
assert.doesNotMatch(regularization, /LegalAcceptanceGate/);
assert.match(login, /Esqueci minha senha/);

assert.doesNotMatch(platformAccess, /billingAccounts/);
assert.doesNotMatch(lifecycle, /billingAccounts/);
assert.match(rules, /legacyVipCutoff/);
assert.match(rules, /exemptionSource/);
assert.match(migration, /requireExplicit: true/);
assert.match(migration, /billingCycles não são lidos, reprecificados ou apagados/);
assert.match(migration, /workspace fundador não pode entrar/i);

const billingSource = read('lib/billing.ts');
const compiled = ts.transpileModule(billingSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const billing = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

const base = billing.buildInitialBillingAccount(
  {
    id: 'legacy-workspace',
    ug: '160416',
    authorizedEmail: 'legacy@example.com',
  },
  'admin@example.com',
  false,
  30,
  '2026-10-01T12:00:00.000Z'
);
const legacy = billing.buildBillingExemptionUpdate(
  base,
  true,
  'admin@example.com',
  '2026-10-02T12:00:00.000Z',
  'legacy_vip'
);
assert.equal(legacy.status, 'exempt');
assert.equal(legacy.monthlyPriceCents, 0);
assert.equal(legacy.exemptionSource, 'legacy_vip');
assert.equal(legacy.legacyVipCutoff, '2026-10-02');
assert.throws(
  () => billing.buildBillingExemptionUpdate(
    legacy,
    false,
    'admin@example.com',
    '2026-10-03T12:00:00.000Z'
  ),
  /permanente/
);

const manual = billing.buildBillingExemptionUpdate(
  base,
  true,
  'admin@example.com',
  '2026-10-02T12:00:00.000Z',
  'manual'
);
const restored = billing.buildBillingExemptionUpdate(
  manual,
  false,
  'admin@example.com',
  '2026-10-03T12:00:00.000Z'
);
assert.equal(restored.status, 'active');
assert.equal(restored.monthlyPriceCents, 7000);
assert.equal(restored.exemptionSource, undefined);

console.log('SAAS-I INTEGRATION VERIFY: READY');
