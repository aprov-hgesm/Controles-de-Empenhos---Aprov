#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  for (const path of ["features/warehouse/components/WarehouseSidebar.tsx","features/warehouse/mobile/WarehouseMobileShell.tsx","features/warehouse/mobile/WarehouseMobileHome.tsx","components/billing/BillingPortalShell.tsx","components/auth/EmprovexLogin.tsx","app/regularizacao/page.tsx"]) {
    const source = read(path);
    assert.doesNotMatch(source, /from ['"]next\/link['"]/);
    assert.doesNotMatch(source, /<Link(?:\s|>)/);
    assert.match(source, /<a(?:\s|>)/);
    assert.doesNotMatch(source, /<\/a(?=\r?\n)/, 'Âncoras devem fechar com >.');
  }
  assert.match(read('features/warehouse/components/WarehouseSidebar.tsx'), /href="\/login"/);
  assert.match(read('features/warehouse/components/WarehouseSidebar.tsx'), /href="\/operador-movel"/);
  assert.match(read('features/warehouse/mobile/WarehouseMobileShell.tsx'), /href="\/operador-movel"/);
  assert.match(read('components/billing/BillingPortalShell.tsx'), /href="\/login"/);
});

test('P0: navegação das abas da Central permanece local e sincronizada', () => {
  const shell = read('features/warehouse/components/WarehouseModuleShell.tsx');
  assert.match(shell, /setActiveSectionId\(target\.id\)/);
  assert.match(shell, /window\.history\.pushState\(/);
  assert.match(shell, /<WarehouseTabContent/);
  assert.match(read('features/warehouse/components/WarehouseProtectedSurface.tsx'), /requestWarehouseStatus/);
});
