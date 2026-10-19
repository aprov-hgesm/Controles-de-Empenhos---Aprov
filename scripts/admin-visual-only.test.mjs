import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (p) => readFileSync(p, 'utf8');
const view = read('components/admin/PlatformAdminView.tsx');
const style = read('components/admin/AdminVisualShell.module.css');
const signature = read('components/layout/chrome/AppShellSignature.tsx');
const beam = read('components/layout/OperationalNavigationBeam.module.css');

test('Admin original: oito abas e ações preservadas', () => {
  for (const id of ['overview','setores','novo-setor','consumo','sessoes','assinaturas','backups','seguranca']) {
    assert.ok(view.includes("id: '" + id + "'"), 'aba preservada: '+id);
    assert.ok(view.includes("activeTab === '" + id + "'"), 'conteúdo preservado: '+id);
    assert.ok(view.includes("data-testid={'admin-tab-' + tab.id}"));
  }
  for (const component of ['AdminCreateSectorPanel','AdminConsumptionHub','AdminSessionsPanel',
    'AdminBillingPanel','AdminBackupPanel','AdminSecurityPanel','EditSectorModal']) {
    assert.ok(view.includes('<'+component), 'mesmo componente funcional '+component);
  }
  for (const handler of ['onCreateSector(input)','onUpdateSector(input)',
    'onChangeSectorStatus(workspace.id, nextStatus)',
    'onDeleteSector(workspace.id, workspace.authorizedEmail)',
    'onLogout()','onTerminateSession','onResetSectorPassword']) {
    assert.ok(view.includes(handler),'mesmo comportamento '+handler);
  }
  assert.match(view, /aria-label="Áreas administrativas"/);
  assert.match(view, /data-layout="sidebar"/);
  assert.match(view, /lg:fixed lg:bottom-0 lg:left-0 lg:top-16/);
  assert.match(view, /data-testid="admin-light-main"/);
  assert.match(view, /data-testid="admin-light-content"/);
  assert.match(view, /lg:pl-72/);
  assert.match(view, /adminVisualStyles.layoutRoot/);
  assert.match(style, /\.layoutRoot/);
  assert.match(style, /transform: none !important/);
  assert.match(view, /emprovex-app-header fixed inset-x-0 top-0/);
  assert.match(view, /bg-\[#edf3fb\]/);
  assert.match(view, /new URLSearchParams\(window.location.search\)/);
  assert.match(view, /url.searchParams.set\('tab', tab\)/);
});

test('identidade visual reutiliza App Shell e detalhe ativo original, não reimplementa motor', () => {
  assert.match(view, /emprovex-app-header/);
  assert.match(view, /emprovex-app-sidebar/);
  assert.match(view, /emprovex-sidebar-operator/);
  assert.match(view, /emprovex-sidebar-nav-item/);
  assert.match(view, /emprovex-sidebar-system/);
  assert.match(view, /navigationBeamStyles.beam/);
  assert.match(view, /data-emprovex-nav-beam="true"/);
  assert.match(view, /<AppShellSignature variant="header" \/>/);
  assert.match(view, /<AppShellSignature variant="sidebar" \/>/);
  assert.match(view, /ADMIN_TAB_GROUPS/);
  assert.match(signature, /variant: 'header' \| 'sidebar'/);
  assert.match(beam, /animation-play-state: paused/);
  assert.match(beam, /prefers-reduced-motion: reduce/);
  assert.match(style, /scrollbar-width: thin/);
  assert.match(style, /background: #edf3fb/);
  assert.match(style, /background: rgba\(255, 255, 255, 0.96\)/);
  assert.match(style, /\.content :global\(input/);
  assert.match(style, /prefers-reduced-motion/);
});

test('não adiciona consultas, novas regras, chamadas nem URLs de produção', () => {
  assert.doesNotMatch(style, /fetch\s*\(|firebase|onSnapshot\s*\(/);
  assert.doesNotMatch(view, /from ['"][^'"]*(?:AdminCustomersDirectory|firebase\/firestore|admin2\/)/);
  assert.doesNotMatch(view, /window\.confirm\s*\(/);
});
