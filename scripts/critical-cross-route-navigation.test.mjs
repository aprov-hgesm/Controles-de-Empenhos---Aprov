#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('P0: Administração e assinatura carregam a rota ao primeiro clique', () => {
  const header = read('components/layout/AppHeader.tsx');
  assert.match(header, /setActiveProfileMode\('platformAdmin'\);\s*(?:\/\/[^\n]*\n\s*)*window\.location\.assign\('\/admin'\)/);
  assert.match(header, /window\.location\.assign\('\/regularizacao'\)/);
  assert.doesNotMatch(header, /router\.(?:push|replace)\(/);
  const admin = read('components/admin/PlatformAdminView.tsx');
  assert.match(admin, /setActiveProfileMode\('sector'\);\s*(?:\/\/[^\n]*\n\s*)*window\.location\.replace\('\/login'\)/);
  assert.doesNotMatch(admin, /router\.(?:push|replace)\(/);
  assert.match(admin, /setActiveTab\(tab\)/, 'As abas administrativas continuam locais.');
  assert.match(read('app/admin/page.tsx'), /context\.status !== 'platformAdmin'/, 'Guarda administrativa preservada.');
});

test('P0: links entre áreas são navegações de documento, não transições travadas', () => {
  for (const path of ["features/warehouse/components/WarehouseSidebar.tsx","features/warehouse/mobile/WarehouseMobileShell.tsx","features/warehouse/mobile/WarehouseMobileHome.tsx","components/auth/EmprovexLogin.tsx","app/regularizacao/page.tsx"]) {
    const source = read(path);
    assert.doesNotMatch(source, /from ['"]next\/link['"]/);
    assert.doesNotMatch(source, /<Link(?:\s|>)/);
    assert.match(source, /<a(?:\s|>)/);
    assert.doesNotMatch(source, /<\/a(?=\r?\n)/, 'Âncoras devem fechar com >.');
  }
  assert.match(read('features/warehouse/components/WarehouseSidebar.tsx'), /href="\/login"/);
  assert.match(read('features/warehouse/components/WarehouseSidebar.tsx'), /href="\/operador-movel"/);
  assert.match(read('features/warehouse/mobile/WarehouseMobileShell.tsx'), /href="\/operador-movel"/);
  const billingShell = read('components/billing/BillingPortalShell.tsx');
  const returnButton = read('components/billing/BillingReturnButton.tsx');
  assert.ok(billingShell.includes('<BillingReturnButton'),
    'Assinaturas devem manter retorno condicionado ao entitlement.');
  assert.ok(returnButton.includes("window.location.assign('/login')"),
    'Retorno autorizado deve carregar /login como documento.');
  assert.ok(returnButton.includes('/api/billing/portal?view=access'),
    'O botão não pode contornar o gate financeiro.');
});

test('P0: navegação das abas da Central permanece local e sincronizada', () => {
  const shell = read('features/warehouse/components/WarehouseModuleShell.tsx');
  assert.match(shell, /setActiveSectionId\(target\.id\)/);
  assert.match(shell, /window\.history\.pushState\(/);
  assert.match(shell, /<WarehouseTabContent/);
  assert.match(read('features/warehouse/components/WarehouseProtectedSurface.tsx'), /requestWarehouseStatus/);
});

function listClientSources(directory) {
  const output = [];
  for (const entry of readdirSync(resolve(process.cwd(), directory), { withFileTypes: true })) {
    const nestedPath = directory + '/' + entry.name;
    if (entry.isDirectory()) {
      output.push(...listClientSources(nestedPath));
    } else if (/\.(?:jsx?|tsx?)$/.test(entry.name)) {
      output.push(nestedPath);
    }
  }
  return output;
}

test('P0: varredura completa do frontend bloqueia navegação RSC vulnerável', () => {
  const files = ['app', 'components', 'features', 'hooks', 'lib'].flatMap(listClientSources);
  assert.ok(files.length >= 350, 'A cobertura de fontes não pode regredir silenciosamente.');
  for (const file of files) {
    const content = read(file);
    assert.doesNotMatch(content, /router\.(?:push|replace)\s*\(/, file + ': use transição de documento entre rotas.');
    assert.doesNotMatch(content, /from\s*['"]next\/link['"]|<Link(?:\s|>)/, file + ': links internos devem carregar a superfície no primeiro clique.');
  }
  const session = read('hooks/useOperationalData.ts');
  assert.match(session, /window\.location\.replace\('\/admin'\)/);
  const delivery = read('features/warehouse/components/WarehouseDeliveriesOperational.tsx');
  assert.match(delivery, /href="\/login\?tab=cronogramas"/);
  const login = read('app/login/page.tsx');
  assert.match(login, /if \(tab === 'cronogramas'\) setActiveTab\('cronogramas'\)/);
  const mobile = read('features/warehouse/mobile/WarehouseMobilePositionCheck.tsx');
  assert.match(mobile, /new URLSearchParams\(/);
  assert.match(mobile, /href=\{transferHref\}/);
});
