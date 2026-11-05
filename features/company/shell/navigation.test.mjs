import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const read = (path) => readFileSync(new URL('../../../' + path, import.meta.url), 'utf8');
const source = read('features/company/shell/navigation.ts');
const result = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
const output = {};
runInNewContext(result.outputText, { exports: output });

test('W4: manifest TypeScript compiles and exposes 14 unique routes', () => {
  assert.equal(result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length ?? 0, 0);
  assert.equal(output.COMPANY_SHELL_MODULES.length, 14);
  const slugs = Array.from(output.COMPANY_SHELL_MODULES, module => module.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  assert.deepEqual(slugs, [
    '', 'pedidos-om', 'empenhos', 'compras', 'fornecedores', 'catalogo', 'cronogramas',
    'estoque', 'entregas', 'notas-fiscais', 'financeiro', 'clientes', 'relatorios', 'configuracoes',
  ]);
  assert.equal(output.companyShellHref('pedidos-om'), '/empresa/pedidos-om');
  assert.equal(output.companyShellHref(''), '/empresa');
  assert.equal(output.companyShellModuleBySlug('logistica').slug, 'entregas');
  assert.equal(output.companyShellModuleBySlug('fora-do-escopo'), undefined);
});

test('W4: filtering uses Portuguese labels and group, never queries operational data', () => {
  const modules = output.COMPANY_SHELL_MODULES;
  const search = output.filterCompanyShellModules(modules, '  FINANCEIRO ');
  assert.deepEqual(Array.from(search, item => item.slug), ['financeiro']);
  const grouped = output.filterCompanyShellModules(modules, '', 'Relacionamento');
  assert.deepEqual(Array.from(grouped, item => item.slug).sort(), ['fornecedores', 'catalogo', 'clientes'].sort());
  assert.equal(modules.filter(item => item.kind === 'preparing').length, 12);
  assert.equal(modules.filter(item => item.kind === 'identity').length, 1);
});

test('W4: isolated portal has no operational military imports and states preparation', () => {
  for (const path of [
    'app/empresa/page.tsx', 'app/empresa/[section]/page.tsx',
    'components/company/CompanySessionGate.tsx', 'components/company/CompanyNavigation.tsx',
    'components/company/CompanyModulePlaceholder.tsx',
    'components/company/CompanyFeedback.tsx', 'features/company/shell/navigation.ts',
  ]) {
    const content = read(path);
    assert.doesNotMatch(content, /useOperationalData|warehouseDb|features\/warehouse|lib\/billing|useEmpenhos|\/central-depositos/);
  }
  assert.match(read('app/empresa/page.tsx'), /Em preparação/);
  assert.match(read('components/company/CompanyModulePlaceholder.tsx'), /Em preparação/);
  assert.match(read('components/company/CompanyNavigation.tsx'), /aria-current/);
  assert.match(read('components/company/CompanySessionGate.tsx'), /aria-checked=\{essential\}/);
  assert.match(read('components/company/CompanyNavigation.tsx'), /motion-reduce:transition-none/);
  assert.match(read('components/company/CompanySessionGate.tsx'), /resolveCompanySession\(user\)/);
});
