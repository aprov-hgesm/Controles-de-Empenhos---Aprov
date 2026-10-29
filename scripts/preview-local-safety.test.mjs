import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { warehouseEmulatorLaunch } from './warehouse-emulator-launch.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('scripts de preview passam na validação sintática do Node', () => {
  for (const path of [
    'scripts/dev-preview-emulator.mjs',
    'scripts/e2e-browser-emulator.mjs',
    'tests/e2e/emulatedLegalAcceptance.mjs',
    'tests/e2e/emulatedBillingPortal.mjs',
  ]) {
    const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
    assert.equal(result.status, 0, path + ': ' + result.stderr);
  }
});

test('a prévia nunca usa o Firebase real nem importa credenciais administrativas', () => {
  const script = read('scripts/dev-preview-emulator.mjs');
  const runner = read('scripts/e2e-browser-emulator.mjs');
  const packageFile = JSON.parse(read('package.json'));
  assert.equal(packageFile.scripts['preview:local'], 'node scripts/dev-preview-emulator.mjs');
  assert.match(script, /demo-emprovex-security/);
  assert.match(script, /\.env\.production\.local/);
  assert.match(script, /FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON: ''/);
  assert.match(script, /NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS: '1'/);
  assert.match(script, /--only', 'auth,firestore'/);
  assert.match(script, /execArgument/);
  assert.match(runner, /PREVIEW_REQUIRES_DEMO_AUTH_AND_FIRESTORE_EMULATORS/);
  assert.match(runner, /chromium\.launch\(\{ headless: false \}\)/);
  assert.match(runner, /registerEmulatedBillingPortal\(context\)/);
  assert.match(runner, /registerEmulatedLegalAcceptance\(context\)/);
  assert.match(runner, /browser\.once\('disconnected'/);
  assert.match(runner, /page\.goto\(appBase \+ '\/login'/);
});

test('o preview não remove verificações reais de cobrança e aceite jurídico', () => {
  const legal = read('app/api/legal-acceptance/route.ts');
  const billing = read('app/api/billing/portal/route.ts');
  const fakeBilling = read('tests/e2e/emulatedBillingPortal.mjs');
  const fakeLegal = read('tests/e2e/emulatedLegalAcceptance.mjs');
  assert.match(legal, /verifyFirebaseRequest/);
  assert.match(legal, /getGoogleAccessToken/);
  assert.match(billing, /resolveBillingPortalSession/);
  assert.match(fakeBilling, /EMPROVEX_E2E_BASE_URL/);
  assert.match(fakeLegal, /EMPROVEX_E2E_BASE_URL/);
  assert.match(fakeLegal, /LEGAL_WORKSPACE_DENIED/);
});

test('Node 24 Windows abre npx.cmd via cmd.exe (evita spawn EINVAL)', () => {
  const launch = warehouseEmulatorLaunch('win32', 'C:\\Windows\\System32\\cmd.exe');
  assert.equal(launch.command, 'C:\\Windows\\System32\\cmd.exe');
  assert.deepEqual(launch.args.slice(0, 3), ['/d', '/s', '/c']);
  assert.match(launch.args[3], /^npx\.cmd --yes firebase-tools emulators:start /);
  assert.match(launch.args[3], /--only firestore$/);
  assert.doesNotMatch(launch.args[3], /[&|<>%]/);
  const linux = warehouseEmulatorLaunch('linux');
  assert.equal(linux.command, 'npx');
  assert.deepEqual(linux.args.slice(0, 3), ['--yes', 'firebase-tools', 'emulators:start']);
});

test('runner de emuladores usa o launch compatível com Windows', () => {
  const runner = read('scripts/e2e-browser-emulator.mjs');
  assert.match(runner, /warehouseEmulatorLaunch\(\)/);
  assert.match(runner, /warehouseLaunch\.command/);
  assert.match(runner, /warehouseLaunch\.args/);
  assert.match(runner, /spawnSync\('taskkill'/);
});
