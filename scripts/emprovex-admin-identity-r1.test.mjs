import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const compile = (p, deps = {}) => {
  const transpiled = ts.transpileModule(read(p), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  assert.equal(transpiled.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length ?? 0, 0);
  const exports = {};
  runInNewContext(transpiled.outputText, {
    exports,
    require(id) {
      assert.ok(Object.hasOwn(deps, id), 'Dependência pura não esperada: ' + id);
      return deps[id];
    },
  });
  return exports;
};
const identity = compile('lib/platformIdentity.ts');
const company = compile('lib/companyProvisioning.ts', { './platformIdentity': identity });
const goodInput = () => ({
  workspaceId: 'empresa-qa',
  legalName: 'Empresa QA Exemplo',
  tradeName: 'Empresa QA',
  cnpj: '11.222.333/0001-81',
  responsibleName: 'Responsável QA',
  authorizedEmail: 'empresa.qa@example.com',
  initialPassword: 'SenhaFakeQA123!',
  city: 'Santa Maria',
  state: 'RS',
});
test('conta legada continua no Aprovisionamento; modalidade Almox roteada', () => {
  assert.equal(identity.resolveSectorType(undefined), 'aprovisionamento');
  assert.equal(identity.sectorEntryPath(undefined), '/central-empenhos');
  assert.equal(identity.sectorEntryPath('almoxarifado'), '/almoxarifado');
  assert.equal(identity.isSectorType('company'), false);
});
test('fundador por senha preservado e provider Google apenas compatível no backend', () => {
  assert.equal(identity.FOUNDER_AUTH_PROVIDER, 'password');
  assert.equal(identity.isFounderSignInProvider('password'), true);
  assert.equal(identity.isFounderSignInProvider('google.com'), true);
  const publicUi = read('components/auth/EmprovexLogin.tsx');
  assert.doesNotMatch(publicUi, /Entrar com Google — HGeSM/);
  assert.match(publicUi, /Entrar com e-mail e senha/);
  assert.doesNotMatch(read('app/login/page.tsx'), /signInWithPopup/);
});
test('cadastro empresarial usa conta e workspace próprios, sem UG e sem cobrança herdada', () => {
  assert.equal(company.isValidCompanyCnpj(goodInput().cnpj), true);
  const out = company.buildProvisionedCompanyRecords(goodInput(), 'admin@example.com', 'uid-company-qa');
  assert.equal(out.account.accountType, 'company');
  assert.equal(out.account.authProvider, 'password');
  assert.equal(out.account.firebaseUid, 'uid-company-qa');
  assert.equal(out.workspace.workspaceType, 'company');
  assert.equal(out.workspace.companyProfile.cnpj, '11222333000181');
  assert.equal('ug' in out.account, false);
  assert.equal('ug' in out.workspace, false);
  assert.equal('grantTrial' in out.account, false);
  assert.equal(identity.validatePlatformAccount(out.account).length, 0);
  assert.ok(identity.validateWorkspace(out.workspace).length > 0);
});
test('cadastro empresarial recusa UID ausente, provedor incorreto e CNPJ inválido', () => {
  const out = company.buildProvisionedCompanyRecords(goodInput(), 'admin@example.com', 'uid-company-qa');
  assert.ok(identity.validatePlatformAccount({ ...out.account, firebaseUid: '' }).length > 0);
  assert.ok(identity.validatePlatformAccount({ ...out.account, authProvider: 'google.com' }).length > 0);
  assert.equal(company.isValidCompanyCnpj('00.000.000/0000-00'), false);
});
test('login empresarial depende de sessão server-side e não monta o setor antecipadamente', () => {
  const gateway = read('app/login/page.tsx');
  const operational = read('app/login/OperationalEntry.tsx');
  const companyServer = read('lib/server/companySession.ts');
  assert.match(gateway, /resolveCompanySession\(user\)/);
  assert.match(gateway, /if \(stage === 'operational'\)/);
  assert.match(gateway, /import\('\.\/OperationalEntry'\)/);
  assert.match(companyServer, /accountUid !== verified\.uid/);
  assert.match(companyServer, /readString\(account, 'accountType'\) !== 'company'/);
  assert.match(companyServer, /readString\(workspace, 'workspaceType'\) !== 'company'/);
  assert.match(companyServer, /readString\(workspace, 'status'\) !== 'active'/);
  assert.match(operational, /sectorEntryPath\(workspaceContext\.sectorType\)/);
});
test('Admin reaproveita os dois cadastros numa entrada única de três modalidades', () => {
  const admin = read('components/admin/PlatformAdminView.tsx');
  const sector = read('components/admin/AdminCreateSectorPanel.tsx');
  assert.match(admin, /admin-unified-client-create/);
  for (const type of ['aprovisionamento', 'almoxarifado', 'empresa']) {
    assert.ok(admin.includes('value="' + type + '"'));
  }
  assert.match(admin, /<AdminCreateCompanyPanel/);
  assert.match(admin, /<AdminCreateSectorPanel/);
  assert.match(sector, /initialSectorType/);
});
test('provisionamento empresarial protegido e baixa W5 ainda desabilitada', () => {
  const admin = read('app/api/admin/provision-company/route.ts');
  const server = read('lib/server/companyProvisioningAdmin.ts');
  const confirm = read('app/api/almoxarifado/confirm/route.ts');
  assert.match(admin, /verifyFounderSession/);
  assert.match(admin, /assertAdminMutationEnabled/);
  assert.match(server, /platformCnpjIndex/);
  assert.match(server, /platformAuthUidIndex/);
  assert.match(confirm, /ALMOX_OUTBOUND_DISABLED_PENDING_OPERATIONAL_APPROVAL|423/);
});
