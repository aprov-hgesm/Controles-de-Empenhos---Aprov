import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
function compile(file, deps = {}) {
  const built = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  assert.equal(built.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length ?? 0, 0);
  const exports = {};
  runInNewContext(built.outputText, {
    exports,
    require(id) {
      assert.ok(Object.hasOwn(deps, id), 'Dependência inesperada: ' + id);
      return deps[id];
    },
  });
  return exports;
}
const identity = compile('lib/platformIdentity.ts');
const company = compile('lib/companyProvisioning.ts', { './platformIdentity': identity });
const input = () => ({
  workspaceId: 'empresa-qa',
  legalName: 'Empresa QA Exemplo',
  cnpj: '11.222.333/0001-81',
  responsibleName: 'Responsável QA',
  authorizedEmail: 'empresa.qa@example.com',
  initialPassword: 'SenhaFakeQA123!',
  city: 'Santa Maria',
  state: 'RS',
});

test('setores legados permanecem no Aprovisionamento', () => {
  assert.equal(identity.resolveSectorType(undefined), 'aprovisionamento');
  assert.equal(identity.sectorEntryPath(undefined), '/central-empenhos');
  assert.equal(identity.isSectorType('company'), false);
});

test('CNPJ empresarial normalizado com validação de dígitos', () => {
  assert.equal(company.isValidCompanyCnpj(input().cnpj), true);
  assert.equal(company.normalizeCompanyCnpj('11.222.333/0001-81'), '11222333000181');
  assert.equal(company.isValidCompanyCnpj('00.000.000/0000-00'), false);
});

test('provisionamento não herda UG, cobrança ou perfil militar', () => {
  const result = company.buildProvisionedCompanyRecords(input(), 'admin@example.com', 'qa-uid');
  assert.equal(result.account.accountType, 'company');
  assert.equal(result.workspace.workspaceType, 'company');
  assert.equal(result.account.firebaseUid, 'qa-uid');
  assert.equal(result.account.authProvider, 'password');
  assert.equal(result.workspace.companyProfile.cnpj, '11222333000181');
  assert.equal('ug' in result.workspace, false);
  assert.equal('ug' in result.account, false);
  assert.equal('institutionalProfile' in result.workspace, false);
  assert.equal('grantTrial' in result.workspace, false);
  assert.equal(identity.validatePlatformAccount(result.account).length, 0);
  assert.equal(identity.validateCompanyWorkspace(result.workspace).length, 0);
  assert.ok(identity.validateWorkspace(result.workspace).length > 0);
});

test('empresa inválida não cria conta, e UID/password são obrigatórios', () => {
  assert.ok(company.validateCompanyProvisioningInput({ ...input(), cnpj: '00000000000000' }).length);
  assert.throws(() => company.buildProvisionedCompanyRecords(input(), 'admin@example.com', ''));
  const account = company.buildProvisionedCompanyRecords(input(), 'admin@example.com', 'qa-uid').account;
  assert.ok(identity.validatePlatformAccount({ ...account, firebaseUid: '' }).length);
  assert.ok(identity.validatePlatformAccount({ ...account, authProvider: 'google.com' }).length);
});

test('gateway autoriza empresa pelo servidor antes do shell operacional', () => {
  const gateway = read('app/login/page.tsx');
  const operation = read('app/login/OperationalEntry.tsx');
  assert.match(gateway, /resolveCompanySession\(user\)/);
  assert.match(gateway, /if \(stage === 'operational'\)/);
  assert.match(gateway, /import\('\.\/OperationalEntry'\)/);
  assert.match(operation, /checkSectorBillingAccess/);
  assert.match(operation, /useOperationalData/);
  assert.doesNotMatch(gateway, /useOperationalData/);
});

test('login Google do fundador e interface recente continuam disponíveis', () => {
  assert.match(read('app/login/page.tsx'), /signInWithPopup\(auth, googleProvider\)/);
  assert.match(read('components/auth/EmprovexLogin.tsx'), /Entrar com Google — HGeSM/);
  assert.equal(identity.isFounderSignInProvider('google.com'), true);
  assert.equal(identity.isFounderSignInProvider('password'), true);
});

test('sessão empresarial valida provedor, e-mail, UID, workspace e status', () => {
  const server = read('lib/server/companySession.ts');
  for (const required of [
    "verified.signInProvider !== 'password'",
    "accountUid !== verified.uid",
    "readString(account, 'accountType') !== 'company'",
    "readString(workspace, 'workspaceType') !== 'company'",
    "readString(workspace, 'status') !== 'active'",
    "readNestedString(workspace, 'companyProfile', 'registrationStatus') !== 'active'",
    "candidate.emailVerified !== true",
  ]) assert.ok(server.includes(required), 'Guarda empresarial ausente: ' + required);
  // Either legacy single-tenant or W10-III selected context must still perform
  // verified company-session checks. The selected adapter wraps W0 live Auth.
  assert.match(read('app/api/company/session/route.ts'),
    /verify(?:Selected)?CompanySession/);
  assert.match(read('lib/server/companyProfiles/integration.ts'), /verifyCompanySession/);
  assert.match(read('components/company/CompanySessionGate.tsx'), /stage: 'checking'/);
});

test('criação empresarial exige fundador, índice CNPJ e bloqueios transacionais', () => {
  const endpoint = read('app/api/admin/provision-company/route.ts');
  const service = read('lib/server/companyProvisioningAdmin.ts');
  assert.match(endpoint, /verifyFounderSession/);
  assert.match(endpoint, /assertAdminMutationEnabled/);
  assert.match(service, /platformCnpjIndex/);
  assert.match(service, /platformAuthUidIndex/);
  assert.match(service, /platformProvisioningLocks/);
  assert.match(service, /getGoogleAccessToken/);
  assert.match(read('lib/server/sectorProvisioningAdmin.ts'), /isCloudRunRuntime\(\)/);
});

test('Admin mostra empresa separada do diretório militar e preserva setor legado', () => {
  const admin = read('components/admin/PlatformAdminView.tsx');
  const store = read('lib/platformAdminStore.ts');
  assert.match(admin, /admin-unified-client-create/);
  assert.match(admin, /<AdminCreateCompanyPanel/);
  assert.match(admin, /<AdminCompaniesPanel/);
  assert.match(admin, /<AdminCreateSectorPanel/);
  assert.match(admin, /value="setor"/);
  assert.match(admin, /value="empresa"/);
  assert.doesNotMatch(admin, /initialSectorType=/);
  assert.match(admin, /workspaces=\{visibleWorkspaces\}/);
  assert.match(store, /\.filter\(isSectorWorkspace\)/);
  assert.match(store, /account\.accountType !== 'company'/);
});

test('empresa não herda Rules, coleções nem o ledger operacional', () => {
  const rules = read('firestore.rules');
  const gate = read('components/company/CompanySessionGate.tsx');
  const portal = read('app/empresa/page.tsx');
  assert.match(rules, /account\.accountType == 'sector'/);
  assert.doesNotMatch(gate, /useOperationalData|warehouseDb|getEmpenhos/);
  assert.match(portal, /Em preparação/);
  assert.doesNotMatch(portal, /useOperationalData|warehouseDb/);
});


test('W0: falha empresarial não monta shell sem identidade setorial/fundadora verificada', () => {
  const gateway = read('app/login/page.tsx');
  assert.match(gateway, /resolveAuthenticatedWorkspaceContext\(user\)/);
  assert.match(gateway, /institutional\.status === 'sector'/);
  assert.match(gateway, /institutional\.status === 'platformAdmin'/);
  assert.doesNotMatch(gateway, /catch\(\(\) => setStage\('operational'\)\)/);
  assert.match(read('lib/platformAccess.ts'), /account\.accountType === 'sector'/);
});

test('W0: flag empresarial positiva, server guard, ownership e namespace isolado', () => {
  const provision = read('lib/server/companyProvisioningAdmin.ts');
  const route = read('app/api/admin/provision-company/route.ts');
  const guard = read('lib/server/companyAuthz/index.ts');
  const contracts = read('lib/company/contracts/index.ts');
  assert.match(provision, /EMPROVEX_COMPANY_PILOT_ENABLED/);
  assert.match(route, /assertCompanyPilotProvisioningEnabled/);
  assert.match(guard, /verifyCompanySession/);
  assert.match(guard, /COMPANY_SCOPE_FORBIDDEN/);
  assert.match(contracts, /supplierCompanyWorkspaces/);
  assert.match(contracts, /COMPANY_CONTRACT_VERSION = 'company-r1-v1'/);
  assert.match(read('lib/server/companySession.ts'), /platformAuthUidIndex/);
});
