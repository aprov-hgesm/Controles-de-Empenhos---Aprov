import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function loadPureIdentity() {
  const generated = ts.transpileModule(source('lib/platformIdentity.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  assert.equal(generated.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length ?? 0, 0);
  const exports = {};
  runInNewContext(generated.outputText, { exports });
  return exports;
}

test('sectorType ausente preserva Aprovisionamento e roteamento legado', () => {
  const id = loadPureIdentity();
  assert.equal(id.resolveSectorType(undefined), 'aprovisionamento');
  assert.equal(id.sectorEntryPath(undefined), '/central-empenhos');
  assert.equal(id.sectorEntryPath('almoxarifado'), '/almoxarifado');
  assert.equal(id.isSectorType('company'), false);
});
test('setor desconhecido é rejeitado na validação estrutural', () => {
  const id = loadPureIdentity();
  const account = {
    email: 'qa.almox@example.com', accountType: 'sector', workspaceId: 'qa-almox',
    sectorType: 'company', ug: '160416', status: 'active',
    createdAt: '2026-10-31', updatedAt: '2026-10-31', createdBy: 'admin@example.com',
  };
  assert.ok(id.validatePlatformAccount(account).length > 0);
  account.sectorType = 'almoxarifado';
  assert.deepEqual(Array.from(id.validatePlatformAccount(account)), []);
});
test('isolamento exige UID, workspace ativo e modalidade consistente', () => {
  const access = source('lib/platformAccess.ts');
  assert.match(access, /UID_MISMATCH/);
  assert.match(access, /WORKSPACE_DISABLED/);
  assert.match(access, /SECTOR_TYPE_MISMATCH/);
  const warehouse = source('lib/server/warehouseAccess.ts');
  assert.match(warehouse, /accountUid !== verified\.uid/);
  assert.match(warehouse, /workspaceSectorType !== accountSectorType/);
});
test('portal não expõe CREM, TREM ou comissão alimentar', () => {
  const portal = source('app/almoxarifado/page.tsx');
  assert.match(portal, /WarehouseAccessBoundary/);
  assert.match(portal, /context\.sectorType !== 'almoxarifado'/);
  assert.doesNotMatch(portal, /CREM|TREM|comiss[aã]o de QR/i);
});
test('provisionamento não bloqueia mesmo UG entre modalidades nem herda preço', () => {
  const server = source('lib/server/sectorProvisioningAdmin.ts');
  assert.match(server, /platformSectorUgIndex/);
  assert.match(server, /ug === HGESM_UG && sectorType === 'aprovisionamento'/);
  assert.match(server, /const billingAccount = isAlmox \? null/);
  assert.match(server, /lockDocumentIds\(state\.email, state\.workspaceId, state\.ug, state\.sectorType\)/);
});
test('Rules propostas validam subtipo sem publicação', () => {
  const rules = source('firestore.rules');
  assert.match(rules, /sectorTypesMatch\(workspace, account\)/);
  assert.match(rules, /match \/platformSectorUgIndex\/\{indexId\}/);
});
test('contratos R1 W2-W4 existem e não implementam motor', () => {
  const contracts = source('lib/almoxarifado/contracts.ts');
  for (const key of ['ImportedRequestV1', 'RequestLineV1', 'SeparationPlanV1', 'SeparationSheetV1', 'TypedIssueV1']) {
    assert.ok(contracts.includes(key), key);
  }
});
