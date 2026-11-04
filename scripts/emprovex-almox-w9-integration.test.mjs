#!/usr/bin/env node
/** W9 R1-D: contratos estáticos da montagem; não substitui E2E/Emulator. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const portal = read('app/almoxarifado/page.tsx');
const operation = read('features/operational/components/OperationalWorkspace.tsx');
const login = read('app/login/page.tsx');
const gate = read('features/warehouse/components/WarehouseProtectedSurface.tsx');
const finance = read('features/almoxarifado/financeiro/AlmoxFinancialSurfaces.tsx');
const report = read('features/almoxarifado/relatorios/AlmoxarifadoReportsView.tsx');

test('W9: TSX de navegação e montagem é sintaticamente válido', () => {
  for (const [file, content] of [
    ['app/almoxarifado/page.tsx', portal],
    ['features/operational/components/OperationalWorkspace.tsx', operation],
  ]) {
    const result = ts.transpileModule(content, {
      fileName: file, reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
    });
    assert.deepEqual(result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error) ?? [], [], file);
  }
});

test('W9: financeiro usa hooks legados e W6 com modalidade setorial', () => {
  for (const name of ['AlmoxEmpenhosSurface', 'AlmoxNotasFiscaisSurface', 'AlmoxCronogramasSurface']) {
    assert.ok(operation.includes(name), name);
    assert.ok(finance.includes('export function ' + name), name);
  }
  for (const hook of ['useEmpenhoActions', 'useNotasFiscaisActions', 'useCronogramaActions']) {
    assert.ok(operation.includes(hook + '('), hook);
  }
  assert.match(operation, /sectorType,\s*user,/);
  assert.match(portal, /<OperationalWorkspace[\s\S]*sectorType="almoxarifado"/);
  assert.match(portal, /classification: 'FUNADOM'/);
  assert.doesNotMatch(portal, /createEmpenho\(|saveInvoice\(|saveCronograma\(/);
});

test('W9: portal monta módulos reais e preserva separação dos saldos', () => {
  for (const section of ['empenhos', 'notas-fiscais', 'cronogramas', 'fornecedores', 'consulta-itens', 'materiais', 'depositos', 'relatorios', 'siscofis']) {
    assert.ok(portal.includes("id: '" + section + "'"), section);
  }
  assert.match(portal, /<AlmoxCatalogoView/);
  assert.match(portal, /<AlmoxarifadoReportsView/);
  assert.match(portal, /<AlmoxSiscofisWorkbench/);
  assert.match(portal, /<WarehouseAccessBoundary>/);
  assert.match(portal, /financeiro[s]? e saldos físicos|saldos físicos são registros distintos/);
  assert.doesNotMatch(portal, /\(em preparação\)/);
});

test('W9: dados financeiros só entram com sessão e workspace congruentes; relatório nunca assume completude', () => {
  assert.match(portal, /firebaseUser\.uid === operationalData\.user\.uid/);
  assert.match(portal, /operationalData\.workspaceContext\.workspaceId === context\.workspaceId/);
  assert.match(portal, /operationalData\.workspaceContext\.sectorType === 'almoxarifado'/);
  assert.match(portal, /completeness: 'partial'/);
  assert.match(portal, /activeOperationalDataReady/);
  assert.match(report, /status: 'loading' \| 'unavailable'/);
  assert.match(gate, /requestWarehouseStatus\(currentUser/);
});

test('W9: Aprovisionamento e correções recentes de login e suporte preservados', () => {
  assert.match(operation, /if \(sectorType !== 'almoxarifado'\) return <EmpenhosView/);
  assert.match(operation, /if \(sectorType !== 'almoxarifado'\) return <NotasFiscaisView/);
  assert.match(operation, /if \(sectorType !== 'almoxarifado'\) return <CronogramasView/);
  assert.match(login, /sectorEntryPath\(workspaceContext\.sectorType\)/);
  assert.match(login, /EmprovexHelpOverlay/);
  assert.match(login, /resolvedEntryPath !== '\/central-empenhos'/);
});

test('W9: SISCOFIS real e baixa auxiliar indisponíveis no piloto', () => {
  assert.match(portal, /Somente dados sintéticos/);
  assert.match(portal, /não reservar nem baixar estoque/);
  const route = read('app/api/almoxarifado/confirm/route.ts');
  assert.match(route, /ALMOX|SISCOFIS|disabled|DISABLED|deny|DENIED|not implemented|NOT_IMPLEMENTED/i);
});

test('W9: workflow da produção continua restrito à main', () => {
  const stage = read('.github/workflows/emprovex-cloud-run-stage.yml');
  assert.match(stage, /branches: \[main\]/);
  assert.match(stage, /github\.ref == 'refs\/heads\/main'/);
  assert.doesNotMatch(stage, /almox-r1d-w9-pilot/);
});
