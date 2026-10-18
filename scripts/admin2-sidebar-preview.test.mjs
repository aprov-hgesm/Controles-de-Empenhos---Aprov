import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const route = readFileSync(join(root, 'app/admin2-preview/page.tsx'), 'utf8');
const sidebar = readFileSync(join(root, 'components/admin2/shell/AdminCommandSidebar.tsx'), 'utf8');
const preview = readFileSync(join(root, 'components/admin2/shell/AdminCommandPreview.tsx'), 'utf8');
const sidebarCss = readFileSync(join(root, 'components/admin2/shell/AdminCommandSidebar.module.css'), 'utf8');
const previewCss = readFileSync(join(root, 'components/admin2/shell/AdminCommandPreview.module.css'), 'utf8');

test('rota de preview permanece indisponível em produção', () => {
  assert.match(route, /process\.env\.NODE_ENV\s*!==\s*'development'/);
  assert.match(route, /notFound\(\)/);
});

test('grupos da navegação e seções demonstrativas são preservados', () => {
  for (const group of ['Central', 'Negócio', 'Operação', 'Inteligência', 'Governança']) {
    assert.ok(sidebar.includes("heading: '" + group + "'"), group);
  }
  for (const section of ['overview', 'pending', 'customers', 'finance', 'support', 'workspaces', 'usage', 'sessions', 'backups', 'reports', 'security', 'audit', 'settings']) {
    assert.ok(sidebar.includes("id: '" + section + "'"), section);
  }
  assert.match(preview, /history\.pushState/);
  assert.match(preview, /popstate/);
  assert.match(preview, /searchParams\.set\('area'/);
});

test('sidebar é fixa à esquerda e não oferece recolhimento no desktop', () => {
  assert.match(preview, /data-testid="admin2-edge-to-edge-shell"/);
  assert.match(sidebar, /fixed bottom-0 left-0 top-\[72px\]/);
  assert.match(sidebar, /w-\[288px\]/);
  assert.match(preview, /lg:ml-\[288px\]/);
  assert.doesNotMatch(sidebar + preview, /Recolher menu|Expandir barra lateral|onToggleCollapsed|collapsed|data-compact|sidebar-toggle|localStorage/);
});

test('drawer mobile e acessibilidade continuam disponíveis', () => {
  assert.match(sidebar, /aria-current/);
  assert.match(sidebar, /aria-label="Menu administrativo"/);
  assert.match(sidebar, /aria-modal="true"/);
  assert.match(sidebar, /admin2-mobile-menu/);
  assert.match(sidebar, /aria-label="Abrir barra lateral administrativa"/);
  assert.match(sidebar, /event\.key === 'Escape'/);
  assert.match(sidebar, /event\.key !== 'Tab'/);
});

test('scrollbar premium utiliza trilho transparente, thumb e hover', () => {
  assert.match(sidebar, /data-testid="admin2-sidebar-scroll"/);
  assert.match(sidebar, /styles\.sidebarScroll/);
  assert.match(sidebarCss, /scrollbar-gutter:\s*stable/);
  assert.match(sidebarCss, /::-webkit-scrollbar-thumb/);
  assert.match(sidebarCss, /::-webkit-scrollbar-track/);
  assert.match(sidebarCss, /::-webkit-scrollbar-thumb:hover/);
  assert.match(sidebarCss, /scrollbar-color:/);
});

test('conteúdo claro inspirado no EMPROVEX e KPI com cores distintas', () => {
  assert.match(preview, /data-testid="admin2-light-content"/);
  assert.match(preview, /styles\.mainCanvas/);
  assert.match(preview, /styles\.hero/);
  assert.match(preview, /styles\.metric/);
  assert.match(preview, /tone="blue"/);
  assert.match(preview, /tone="teal"/);
  assert.match(preview, /tone="green"/);
  assert.match(preview, /tone="amber"/);
  assert.match(previewCss, /\.metricBlue/);
  assert.match(previewCss, /\.metricTeal/);
  assert.match(previewCss, /\.metricGreen/);
  assert.match(previewCss, /\.metricAmber/);
  assert.match(previewCss, /prefers-reduced-motion/);
});

test('prévia não executa Auth, billing, Firestore ou operações de tenants', () => {
  const combined = [route, sidebar, preview].join('\n');
  assert.doesNotMatch(combined, /from ['"].*(?:firebase|platformAccess|operationalPaths|workspaceContext|warehouseAccess|platformBillingStore)['"]/);
  assert.doesNotMatch(combined, /\b(?:onSnapshot|runTransaction|setDoc|updateDoc|deleteDoc|signInWithPopup)\s*\(/);
  assert.match(preview, /DEMO_CUSTOMERS/);
  assert.match(preview, /Nenhuma operação de Firestore/);
});
