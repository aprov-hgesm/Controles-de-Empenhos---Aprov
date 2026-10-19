import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const file = readFileSync(join(process.cwd(), 'lib/admin2/customers/workspaceProfileEditContract.ts'), 'utf8');
const editor = readFileSync(join(process.cwd(), 'components/admin2/customers/AdminWorkspaceProfileEditor.tsx'), 'utf8');
const management = readFileSync(join(process.cwd(), 'components/admin2/customers/AdminCustomerManagement.tsx'), 'utf8');
const oldStore = readFileSync(join(process.cwd(), 'lib/platformAdminStore.ts'), 'utf8');
const shell = readFileSync(join(process.cwd(), 'components/admin2/shell/AdminCommandPreview.tsx'), 'utf8');
const legacy = readFileSync(join(process.cwd(), 'components/admin2/shell/AdminLegacyCapabilities.tsx'), 'utf8');
const directory = readFileSync(join(process.cwd(), 'components/admin2/customers/AdminCustomersDirectory.tsx'), 'utf8');
const compiled = ts.transpileModule(file, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
runInNewContext(compiled, { exports, Date }, { filename: 'workspaceProfileEditContract.js' });
const { workspaceEditInitialValues, validateWorkspaceProfileEdit, previewUpdatedWorkspace } = exports;
const original = {
  customerKey: 'workspace:sector-qa', workspaceId: 'sector-qa', name: 'Nome do Setor',
  ug: '123456', organizationName: 'Unidade QA', organizationShortName: 'UQA',
  sectionName: 'Aprovisionamento', authorizedEmail: 'qa@example.invalid',
  workspaceStatus: 'active', legacyWorkspace: false, updatedAt: '2026-10-18T00:00:00Z',
};

test('edição só altera metadados permitidos e preserva acesso/ID/status', () => {
  const next = workspaceEditInitialValues(original);
  next.workspaceName = 'Novo Setor';
  next.organizationName = 'Nova Organização';
  next.organizationShortName = 'NOM';
  next.sectionName = 'Seção nova';
  assert.equal(validateWorkspaceProfileEdit(original, next).length, 0);
  const result = previewUpdatedWorkspace(original, next, '2026-10-18T14:00:00Z');
  assert.equal(result.name, 'Novo Setor');
  assert.equal(result.organizationName, 'Nova Organização');
  assert.equal(result.workspaceId, 'sector-qa');
  assert.equal(result.ug, '123456');
  assert.equal(result.authorizedEmail, 'qa@example.invalid');
  assert.equal(result.workspaceStatus, 'active');
});

test('UG existente imutável; legado sem UG permite preenchimento único', () => {
  const input = workspaceEditInitialValues(original);
  input.ug = '654321';
  assert.match(validateWorkspaceProfileEdit(original,input).join(' '), /imutável/);
  const legacyNoUg = { ...original, ug: null };
  const blank = workspaceEditInitialValues(legacyNoUg);
  blank.ug = '654321';
  assert.equal(validateWorkspaceProfileEdit(legacyNoUg, blank).length, 0);
  blank.ug = 'abc';
  assert.match(validateWorkspaceProfileEdit(legacyNoUg, blank).join(' '), /seis dígitos/);
});

test('impede alteração de ID e protege workspace legado/fundador', () => {
  const input = workspaceEditInitialValues(original);
  input.workspaceId = 'another-workspace';
  assert.match(validateWorkspaceProfileEdit(original, input).join(' '), /ID/);
  const founded = { ...original, legacyWorkspace: true };
  assert.match(validateWorkspaceProfileEdit(founded,workspaceEditInitialValues(founded)).join(' '), /protegido/);
});

test('Gestão reaproveita transação auditada da main SOMENTE em Emulator demo-*', () => {
  assert.match(management,/commercialEmulatorWritesEnabled && !isLocal/);
  assert.match(management,/updateSectorWorkspaceProfile\(input, HGESM_SECTOR_EMAIL\)/);
  assert.match(management,/previewUpdatedWorkspace\(selected, input/);
  assert.match(management,/data-testid="admin2-edit-workspace"/);
  assert.match(editor,/data-testid="admin2-workspace-editor"/);
  assert.match(editor,/disabled={Boolean\(workspace\.ug\)}/);
  assert.match(editor,/ID imutável/);
  assert.match(oldStore,/A UG já vinculada ao setor é imutável/);
  assert.match(oldStore,/appendPlatformAuditEvent\(transaction/);
});

test('todas as capacidades históricas possuem correspondência explícita sem fakes', () => {
  const routes = {
    usage:'consumo', sessions:'sessoes', backups:'backups', security:'seguranca',
    finance:'assinaturas', reports:'consumo', settings:'assinaturas',
  };
  for (const [area,tab] of Object.entries(routes)) {
    assert.match(legacy,new RegExp(area + ': \\\\{'));
    assert.ok(legacy.includes("tab: '" + tab + "'"),tab);
  }
  assert.match(legacy,/href={['"]?\/admin\?tab=/) || assert.match(legacy,/href={['"]?/);
  assert.match(shell,/AdminLegacyCapabilities area={activeId}/);
  assert.match(shell,/activeId === 'workspaces'/);
  assert.match(shell,/activeId === 'finance'/);
  assert.match(directory,/initialMode === 'manage'/);
  assert.match(legacy,/não dispara leituras globais/);
});
