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

test('Consumo & Cotas: os cinco painéis explicam números reais em linguagem simples', () => {
  const hub = read('components/admin/AdminConsumptionHub.tsx');
  const google = read('components/admin/AdminGlobalUsagePanel.tsx');
  const ug = read('components/admin/AdminUsagePanel.tsx');
  const consolidated = read('components/admin/AdminConsolidatedUsagePanel.tsx');
  const reports = read('components/admin/AdminUsageReportsPanel.tsx');

  for (const component of [
    '<AdminGlobalUsagePanel',
    '<AdminConsolidatedUsagePanel',
    '<AdminUsagePanel',
    '<AdminUsageReportsPanel',
  ]) assert.ok(hub.includes(component), 'painel preservado: '+component);

  assert.match(hub, /admin-consumption-simple-summary/);
  assert.match(hub, /quanto o EMPROVEX usa do banco de dados/);
  assert.match(hub, /Não some nem compare as duas fontes/);
  assert.match(hub, /Sem dados/);
  assert.match(hub, /onRefreshUsage/);
  assert.match(hub, /onRefreshGlobalUsage/);

  assert.match(google, /admin-google-simple-guide/);
  assert.match(google, /data-testid="admin-firestore-primary-billing-quota"/);
  assert.match(google, /data-testid="google-usage-diagnostics"/);
  assert.match(google, /<details/);
  assert.match(google, /Leituras contabilizadas/);
  assert.match(google, /Gravações contabilizadas/);
  assert.match(google, /Read Units faturáveis/);
  assert.match(google, /Write Units faturáveis/);

  assert.match(ug, /admin-ug-simple-guide/);
  assert.match(ug, /Sem medição/);
  assert.match(ug, /data-testid="admin-usage-total-reads"/);
  assert.match(ug, /estimate\?\.estimatedDocumentReads \?\? null/);

  assert.match(consolidated, /admin-consolidated-simple-guide/);
  assert.match(consolidated, /data-testid="admin-usage-reconciliation-v2"/);
  assert.match(consolidated, /data-testid="admin-usage-alerts-panel"/);
  assert.match(reports, /admin-usage-history-simple-guide/);
  assert.match(reports, /Exportar CSV/);

  // Texto/explicação apenas: nenhum cliente de leitura/alteração adicionado.
  for (const source of [hub, google, ug, consolidated]) {
    assert.doesNotMatch(source, /(?:getDocs|onSnapshot|updateDoc|deleteDoc|addDoc|runTransaction|fetch)\s*\(/);
  }
});


test('UG R3: medição por módulo preserva baixo custo, segurança e compatibilidade', () => {
  const telemetry = read('lib/workspaceUsageTelemetry.ts');
  const read = readFileSync('lib/platformAdminUsage.ts', 'utf8');
  const panel = readFileSync('components/admin/AdminUsagePanel.tsx', 'utf8');
  const hub = readFileSync('components/admin/AdminConsumptionHub.tsx', 'utf8');
  const realtime = readFileSync('hooks/useOperationalRealtimeCollections.ts', 'utf8');
  const warehouse = readFileSync('lib/warehouse/telemetry.ts', 'utf8');
  const rules = readFileSync('firestore.rules', 'utf8');
  const security = readFileSync('scripts/firestore-multitenancy-security.test.mjs', 'utf8');

  for (const key of ['empenhos', 'notas', 'deposito', 'sessoes', 'outros']) {
    assert.ok(telemetry.includes("'"+key+"'"), 'categoria segura '+key);
    assert.ok(rules.includes("'"+key+"'"), 'regra de módulo '+key);
  }
  for (const marker of [
    'WORKSPACE_USAGE_INITIAL_FLUSH_MS = 60 * 1000',
    'WORKSPACE_USAGE_FLUSH_INTERVAL_MS = 15 * 60 * 1000',
    'sessionStorage',
    'moduleOperations: Object.fromEntries(',
    'increment(snapshot.moduleOperations[module])',
    'serverTimestamp()',
    'telemetryFlushes: increment(1)',
  ]) assert.ok(telemetry.includes(marker), 'buffer agregado preservado: '+marker);

  assert.match(read, /moduleBreakdownAvailable/);
  assert.match(read, /moduleOperations: readModuleOperations/);
  assert.match(panel, /admin-ug-modules-/);
  assert.match(panel, /Sem detalhamento por módulo/);
  assert.match(panel, /admin-ug-google-proxy-/);
  assert.match(hub, /globalUsage={props.globalUsage}/);
  assert.match(realtime, /snapshot.metadata.fromCache \? 0/);
  assert.match(warehouse, /recordWorkspaceDocumentReads\(scope, Math.floor\(count\), 'deposito'\)/);
  assert.match(rules, /workspaceModuleOperationsMonotonic/);
  assert.match(rules, /validWorkspaceModuleOperations/);
  assert.match(security, /UG R3 rejeita módulo inventado/);
  assert.match(security, /UG R3 impede reduzir atividade de outro módulo/);

  // O novo detalhamento não gera assinaturas nem leituras adicionais.
  assert.doesNotMatch(telemetry, /onSnapshot\s*\(|getDoc\s*\(/);
  assert.doesNotMatch(panel, /onSnapshot\s*\(|getDoc\s*\(|getDocs\s*\(/);
  assert.doesNotMatch(telemetry, /collectionGroup\s*\(/);
});
