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
const customerUi = readFileSync(join(root, 'components/admin2/customers/AdminCustomersDirectory.tsx'), 'utf8');
const customerStore = readFileSync(join(root, 'lib/admin2/customers/customerWorkspaceDirectory.ts'), 'utf8');
const customerContract = readFileSync(join(root, 'lib/admin2/customers/customerWorkspaceContract.ts'), 'utf8');
const customerV2Ui = readFileSync(join(root, 'components/admin2/customers/AdminCustomerDetailV2.tsx'), 'utf8');
const customerV2Read = readFileSync(join(root, 'lib/admin2/customers/customer360Read.ts'), 'utf8');

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

test('laboratório continua inacessível em produção, mas Clientes usa login seguro', () => {
  assert.match(route, /NODE_ENV/);
  assert.match(preview, /AdminCustomersDirectory/);
  assert.doesNotMatch(preview, /DEMO_CUSTOMERS/);
  assert.match(customerUi, /onAuthStateChanged\(auth/);
  assert.match(customerUi, /candidate\.getIdTokenResult\(\)/);
  assert.match(customerUi, /HGESM_SECTOR_EMAIL/);
  assert.match(customerUi, /emailVerified === true/);
  assert.match(customerUi, /sign_in_provider === 'google\.com'/);
  assert.match(customerUi, /authState !== 'authorized' \|\| !user/);
  assert.match(customerUi, /signInWithPopup\(auth, googleProvider\)/);
  assert.match(customerUi, /Acesso administrativo não autorizado/);
});

test('consultas reais paginadas e sem listeners globais ou writes', () => {
  assert.match(customerStore, /getDocs\(query\(collection\(db, WORKSPACES_PATH\)/);
  assert.match(customerStore, /ADMIN2_CUSTOMER_PAGE_SIZE \+ 1/);
  assert.match(customerStore, /startAfter\(previousPageLast\)/);
  assert.match(customerStore, /where\('ug', '==', term\)/);
  assert.match(customerStore, /endAt\(term \+ '\\uf8ff'\)/);
  assert.match(customerStore, /getDoc\(doc\(db, BILLING_ACCOUNTS_PATH, workspaceId\)\)/);
  assert.doesNotMatch(customerStore + customerUi, /\b(?:onSnapshot|setDoc|addDoc|updateDoc|deleteDoc|runTransaction|writeBatch)\s*\(/);
  assert.match(customerV2Ui, /readCustomerBilling\(customer\.workspaceId\)/);
  assert.match(customerUi, /data-testid="admin2-real-customers"/);
  assert.match(customerV2Ui, /data-testid="admin2-customer-360"/);
});

test('projeção preserva IDs e não transforma workspace em conta comercial', () => {
  assert.match(customerContract, /customerKey: 'workspace:' \+ workspaceId/);
  assert.match(customerContract, /ADMIN2_CUSTOMER_PAGE_SIZE = 10/);
  assert.match(customerContract, /workspace\.institutionalProfile/);
  assert.match(customerContract, /billing\.workspaceId !== workspaceId/);
  assert.match(customerUi, /não uma base de clientes comerciais independente/);
  assert.match(customerV2Ui, /Consulta somente leitura/);
});

test('isolamento de produção e área operacional permanecem intactos', () => {
  const previewShell = [route, sidebar, preview].join('\n');
  assert.doesNotMatch(previewShell, /from ['"].*(?:operationalPaths|workspaceContext|warehouseAccess|platformBillingStore)['"]/);
  assert.doesNotMatch(customerStore + customerUi + customerV2Read + customerV2Ui, /\b(?:setDoc|updateDoc|deleteDoc|runTransaction|signOut)\s*\(/);
  assert.match(preview, /indicadores ilustrativos/);
});

test('V2 carrega competências e auditoria só nas seções correspondentes', () => {
  assert.match(customerUi, /<AdminCustomerDetailV2/);
  assert.match(customerV2Ui, /tab === 'finance'/);
  assert.match(customerV2Ui, /tab === 'activity'/);
  assert.match(customerV2Ui, /tab === 'relationship'/);
  assert.match(customerV2Ui, /readCustomerCyclePage\(workspaceId/);
  assert.match(customerV2Ui, /readCustomerAuditSample\(workspaceId\)/);
  assert.match(customerV2Ui, /role="tablist"/);
  assert.match(customerV2Ui, /não representa necessariamente os eventos mais recentes/);
  assert.match(customerV2Ui, /Ainda não cadastrado/);
});

test('V2 não cria consultas globais e limita fetches por workspace', () => {
  assert.match(customerV2Read, /orderBy\(documentId\(\), 'desc'\)/);
  assert.match(customerV2Read, /startAt\(prefix \+ '\\uf8ff'\)/);
  assert.match(customerV2Read, /limit\(ADMIN2_CYCLE_PAGE_SIZE \+ 1\)/);
  assert.match(customerV2Read, /where\('workspaceId', '==', workspaceId\)/);
  assert.match(customerV2Read, /limit\(ADMIN2_AUDIT_SAMPLE_LIMIT\)/);
  assert.doesNotMatch(customerV2Read, /\bonSnapshot\s*\(/);
  assert.doesNotMatch(customerV2Read, /\b(?:setDoc|updateDoc|deleteDoc|runTransaction|writeBatch)\s*\(/);
});
