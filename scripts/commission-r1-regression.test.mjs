import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const types = read('lib/types.ts');
const actions = read('features/notas-fiscais/hooks/useNotasFiscaisActions.ts');
const view = read('features/notas-fiscais/components/NotasFiscaisView.tsx');
const workspace = read('features/operational/components/OperationalWorkspace.tsx');
const documents = read('features/relatorios/hooks/useDocumentActions.ts');
const firebase = read('lib/firebaseSync.ts');

test('identidade institucional é obtida do workspace atual, não de HGeSM fixo', () => {
  assert.doesNotMatch(view, /HGeSM/);
  assert.match(workspace, /organizationShortName: workspaceContext\.status === 'sector'/);
  assert.match(view, /da \{organizationShortName\}/);
  assert.match(view, /na \{organizationShortName\}/);
});

test('contrato legado da comissão é compatível com zero a três auxiliares e visto ausente', () => {
  assert.match(types, /auxiliares: MembroComissao\[\]/);
  assert.match(types, /vistoResponsavel\?: ComissaoVistoResponsavel/);
  assert.match(actions, /\.filter\(\(auxiliar\) => auxiliar\.nomeCompleto\.length > 0\)/);
  assert.doesNotMatch(actions, /!comissaoAux1Nome\s*\|\|\s*!comissaoAux2Nome/);
});

test('edição atualiza a mesma ID sem duplicar o mês e preserva dados se falhar', () => {
  assert.match(actions, /id: editing\?\.id \|\|/);
  assert.match(actions, /commission\.id !== editing\?\.id && commission\.mesReferencia === comissaoMes/);
  assert.match(actions, /await saveComissao\(user\.uid, newComissao\)/);
  assert.match(actions, /current\.map\(\(commission\) => commission\.id === editing\.id/);
  assert.match(firebase, /operationalDocRef\(scope, 'comissoes', comissao\.id\)/);
  assert.match(view, /startComissaoEditing\(com\)/);
  assert.match(view, /Cancelar edição/);
});

test('visto é selecionável e o legado usa Fiscal Administrativo', () => {
  assert.match(view, /<option value="FISCAL_ADMINISTRATIVO">Fiscal Administrativo<\/option>/);
  assert.match(view, /<option value="ORDENADOR_DESPESAS">Ordenador de Despesas<\/option>/);
  assert.match(documents, /matchingComissao\.vistoResponsavel === 'ORDENADOR_DESPESAS'/);
  assert.match(documents, /'Visto do FISCAL ADMINISTRATIVO'/);
});

test('PDF e histórico omitem auxiliares vazios, mantendo as três assinaturas do legado', () => {
  assert.match(documents, /\.filter\(\(aux\) => aux\?\.nomeCompleto\?\.trim\(\)\)/);
  assert.match(documents, /\.slice\(0, 3\)/);
  assert.doesNotMatch(documents, /const aux3 = matchingComissao\.auxiliares\[2\]/);
  assert.match(view, /\(com\.auxiliares \|\| \[\]\)\.filter/);
});
