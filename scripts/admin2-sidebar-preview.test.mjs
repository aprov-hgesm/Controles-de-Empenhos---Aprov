import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const route = readFileSync(join(root, 'app/admin2-preview/page.tsx'), 'utf8');
const sidebar = readFileSync(join(root, 'components/admin2/shell/AdminCommandSidebar.tsx'), 'utf8');
const preview = readFileSync(join(root, 'components/admin2/shell/AdminCommandPreview.tsx'), 'utf8');

test('rota de preview não é renderizada em produção', () => {
  assert.match(route, /process\.env\.NODE_ENV\s*!==\s*'development'/);
  assert.match(route, /notFound\(\)/);
});

test('sidebar reproduz os grupos planejados e rotas demonstrativas', () => {
  for (const group of ['Central', 'Negócio', 'Operação', 'Inteligência', 'Governança']) {
    assert.ok(sidebar.includes("heading: '" + group + "'"), group);
  }
  for (const section of ['overview', 'pending', 'customers', 'finance', 'support', 'workspaces', 'usage', 'sessions', 'backups', 'reports', 'security', 'audit', 'settings']) {
    assert.ok(sidebar.includes("id: '" + section + "'"), section);
  }
});

test('prévia possui compactação local, drawer mobile e acessibilidade mínima', () => {
  assert.match(preview, /localStorage\.getItem/);
  assert.match(preview, /localStorage\.setItem/);
  assert.match(sidebar, /aria-current/);
  assert.match(sidebar, /aria-label="Menu administrativo"/);
  assert.match(sidebar, /aria-modal="true"/);
  assert.match(sidebar, /motion-reduce:transition-none/);
  assert.match(sidebar, /admin2-sidebar-toggle/);
  assert.match(sidebar, /admin2-mobile-menu/);
});

test('prévia não importa Firebase, sessão de cliente ou mutação operacional', () => {
  const combined = [route, sidebar, preview].join('\n');
  assert.doesNotMatch(combined, /from ['"].*(?:firebase|platformAccess|operationalPaths|workspaceContext|warehouseAccess|platformBillingStore)['"]/);
  assert.doesNotMatch(combined, /\b(?:onSnapshot|runTransaction|setDoc|updateDoc|deleteDoc|signInWithPopup)\s*\(/);
  assert.match(preview, /DEMO_CUSTOMERS/);
  assert.match(preview, /Nenhuma operação de Firestore/);
});

test('prévia preserva URLs e histórico da navegação', () => {
  assert.match(preview, /history\.pushState/);
  assert.match(preview, /popstate/);
  assert.match(preview, /searchParams\.set\('area'/);
});
