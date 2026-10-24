#!/usr/bin/env node
/**
 * EMPROVEX CI LEAN: unidade por diff. Nunca substitui os gates de release.
 * Executa todos os testes aplicáveis e retorna FAIL se qualquer teste falhar.
 */
import { execFileSync, spawnSync } from 'node:child_process';

const base = process.env.GITHUB_BASE_REF?.trim();
const diffArgs = base
  ? ['diff', '--name-only', '--diff-filter=ACMR', 'origin/' + base + '...HEAD']
  : ['diff', '--name-only', '--diff-filter=ACMR', 'HEAD^', 'HEAD'];

let files;
try {
  files = execFileSync('git', diffArgs, { encoding: 'utf8' })
    .split(/\r?\n/).map((p) => p.trim()).filter(Boolean);
} catch (error) {
  console.error('[CI LEAN] Diff indisponível: falha fechada.', error);
  process.exit(1);
}

const warehouse = /^(?:lib\/warehouse\/|lib\/server\/warehouse[^/]*\.ts$|features\/warehouse\/|components\/warehouse\/|app\/central-depositos\/|app\/api\/central-depositos\/|scripts\/(?:warehouse-|verify-adm-deposito|mobile-r1-|mobile-k-))/;
const tests = new Set();
const add = (name) => tests.add(name);
const groups = [
  [/material|siscofis/i, ['test:adm-deposito-material', 'test:adm-deposito-siscofis']],
  [/ledger|movement|balance|transaction/i, ['test:adm-deposito-ledger', 'test:adm-deposito-stock-operational']],
  [/transfer|location|structure|destination|archive/i, ['test:adm-deposito-locations', 'test:adm-deposito-ledger']],
  [/inventory|adjustment/i, ['test:adm-deposito-inventory', 'test:mobile-r1-inventory']],
  [/outbound|withdrawal|return|consumption/i, ['test:adm-deposito-outbound-return', 'test:adm-deposito-barcode-outbound']],
  [/lot|fefo|stock/i, ['test:adm-deposito-stock-operational']],
  [/barcode|label/i, ['test:adm-deposito-barcode-outbound']],
  [/intake|invoice|queue|manual.entry/i, ['test:adm-deposito-nf-stock', 'test:adm-deposito-manual-entry']],
  [/layout|croquis|depot|archive/i, ['test:adm-deposito-depot-layout', 'test:warehouse-depot-registration-r1']],
  [/isometric|3d|visualclarity/i, ['test:warehouse-isometric-camera']],
  [/logistics|alert/i, ['test:adm-deposito-logistics']],
  [/mobile/i, ['test:mobile-k-canonical-ops']],
];
const warehouseFiles = files.filter((p) => warehouse.test(p));
for (const path of warehouseFiles) {
  for (const [pattern, scripts] of groups) {
    if (pattern.test(path)) scripts.forEach(add);
  }
  if (/^lib\/server\/warehouse(?:FirestoreTransaction|Admin|LedgerAndArchive|StructureWrite|Transfer)/.test(path)
    || /^app\/api\/central-depositos\/operations\//.test(path)) {
    ['test:adm-deposito-ledger', 'test:adm-deposito-inventory',
      'test:adm-deposito-outbound-return', 'test:adm-deposito-locations'].forEach(add);
  }
}
// Saida Móvel R2 — scanner dual e FEFO automatico seguro.
if (files.some(p => /^(?:features\/warehouse\/mobile\/WarehouseMobile(?:Outbound|IntakeAllocation)\.tsx|lib\/warehouse\/(?:mobileOutboundPlan\.mjs|mobileScanner\.ts|mobileOutbound\.ts)|app\/api\/central-depositos\/operations\/route\.ts|lib\/server\/warehouseMobileTrust\.mjs|scripts\/mobile-outbound-unified\.test\.mjs)$/.test(p))) {
  add('test:mobile-outbound-unified');
}
// Navegação por estado React: contrato isolado, sem Firestore ou produção.
if (files.some((p) => /^(?:features\/warehouse\/components\/Warehouse(?:ModuleShell|Sidebar|TabNavigation|TabContent|SectionContent|SectionLoading|LandingOperational|HomeOperational)\.tsx|scripts\/warehouse-react-tab-navigation\.test\.mjs)$/.test(p))) {
  add('test:warehouse-react-tab-navigation');
}
// Leitura móvel via IAM: validar os seis fluxos e o endpoint autenticado.
if (files.some(p => /^(?:lib\/warehouse\/mobileBarcodeReadClient\.ts|lib\/server\/warehouseMobileBarcodeRead\.ts|lib\/server\/warehouseMobileTrust\.mjs|lib\/server\/warehouseMobileRead\.ts|lib\/warehouse\/mobileReadSdkBridge\.ts|lib\/warehouse\/mobile(?:MaterialRead|LocationRead|InventoryClient|DestinationClient|LocationBarcodeResolver)\.ts|app\/api\/central-depositos\/mobile-read\/route\.ts|app\/api\/central-depositos\/mobile-barcode\/route\.ts|scripts\/mobile-server-barcode-read\.test\.mjs|features\/warehouse\/mobile\/WarehouseMobile(?:IntakeAllocation|Transfer|Inventory|Outbound|ItemQuery|ManualEntry)\.tsx)$/.test(p))) {
  add('test:mobile-server-barcode-read');
}
// Este teste verifica os detalhes no topo da experiência, as consultas
// limitadas e a ausência de operações diretas no Firestore.
if (files.some((p) => /^(?:features\/warehouse\/components\/Warehouse(?:StockOperational|LogisticsReports)\.tsx|scripts\/warehouse-stock-report-ux\.test\.mjs)$/.test(p))) {
  add('test:warehouse-stock-report-ux');
}
// Prévia operacional emulada: Node válido, portas locais e projeto demo isolado.
if (files.some(p => /^(?:scripts\/dev-warehouse-isolated\.mjs|scripts\/warehouse-isolated-dev\.test\.mjs|firebase\.warehouse-server-only-browser-test\.json)$/.test(p))) {
  add('test:warehouse-isolated-dev');
}
// Central unica: cadastro, gerenciamento, regras server-only e leitura IAM.
if (files.some((p) => /^(?:firebase\.json|firestore\.warehouse\.server-only\.rules|scripts\/verify-emprovex-warehouse-isolation\.mjs|lib\/server\/warehouse(?:CroquiRead|LedgerAndArchive)\.ts|lib\/warehouse\/croquiReadRepository\.ts|features\/warehouse\/components\/Warehouse(?:CroquisR1Operational|DepotQuickCreate|DepotsOperational)\.tsx|scripts\/warehouse-croqui-fusion\.test\.mjs)$/.test(p))) {
  add('test:warehouse-croqui-fusion');
}
// Croqui de edição: clique direito, rotação, medidas, subposições e 3D sem luminárias.
if (files.some((p) => /^(?:lib\/warehouse\/layoutOrientation\.ts|lib\/server\/warehouseStructureLayoutApply\.ts|features\/warehouse\/components\/Warehouse(?:DepotLayoutEditor|CroquisR1Operational|Depot20x6Demo|IsometricPreview)\.tsx|scripts\/warehouse-context-menu\.test\.mjs)$/.test(p))) {
  add('test:warehouse-context-menu');
}
// UX: não mostrar os IDs internos e exibir apenas o código do local no card 2D.
if (files.some((p) => /^(?:lib\/warehouse\/croquiCardLabel\.ts|features\/warehouse\/components\/WarehouseDepotLayoutEditor\.tsx|scripts\/warehouse-croqui-card-code\.test\.mjs)$/.test(p))) {
  add('test:warehouse-croqui-card-code');
}
// Geometria: detectar intersecao de locais no navegador e no servidor.
if (files.some((p) => /^(?:lib\/warehouse\/layoutCollision\.ts|lib\/server\/warehouse(?:StructureLayoutApply|RemainingWrites)\.ts|features\/warehouse\/components\/Warehouse(?:CroquisR1Operational|DepotLayoutEditor|Depot20x6Demo)\.tsx|scripts\/warehouse-croqui-collision\.test\.mjs)$/.test(p))) {
  add('test:warehouse-croqui-collision');
}
// Sequenciamento: duplicar 3 de 10 gera 11; apos inativar 2, reutilizar 2 com novo ID.
if (files.some((p) => /^(?:lib\/warehouse\/locationCodeSequence\.ts|lib\/server\/warehouseStructureLayoutApply\.ts|features\/warehouse\/components\/Warehouse(?:CroquisR1Operational|Depot20x6Demo)\.tsx|scripts\/warehouse-location-code-sequence\.test\.mjs)$/.test(p))) {
  add('test:warehouse-location-sequence');
}
// Central 2D: validar cadastro transacional, idempotencia, conflitos e estoque.
if (files.some((p) => /^(?:lib\/server\/warehouseStructureLayoutApply\.ts|lib\/warehouse\/croquiStructureRepository\.ts|features\/warehouse\/components\/Warehouse(?:CroquisR1Operational|DepotsOperational|DepotLayoutEditor)\.tsx|scripts\/warehouse-croqui-unified\.test\.mjs)$/.test(p))) {
  add('test:warehouse-croqui-unified');
}
// Demo visual 20×6 m: validar sempre geometria, integridade e isolamento.
if (files.some((p) => /^(?:lib\/warehouse\/demoDepot20x6\.ts|features\/warehouse\/components\/WarehouseDepot20x6Demo\.tsx|app\/visual-lab\/deposito-20x6\/page\.tsx|scripts\/warehouse-3d-demo-20x6\.test\.mjs)$/.test(p))) {
  add('test:warehouse-3d-demo-20x6');
}
// R363: shell instalável com marca institucional; sem cache offline e sem operações de domínio.
if (files.some((p) => /^(?:app\/(?:manifest\.ts|layout\.tsx|api\/install-icon\/\[size\]\/route\.tsx)|public\/emprovex-logo\.png|next\.config\.ts|scripts\/pwa-installability\.test\.mjs)$/.test(p))) {
  add('test:pwa-installability');
}
// R361: remover somente o JSON do cadastro de NE e preservar a alocação por item.
// Esses testes usam dados sintéticos e não executam gravações de produção.
if (files.some((p) => /^(?:features\/empenhos\/(?:components\/EmpenhosView|hooks\/useEmpenhoActions)\.tsx?|features\/operational\/components\/OperationalWorkspace\.tsx|hooks\/useOperationalViewState\.ts|features\/warehouse\/components\/WarehouseLandingOperational\.tsx|scripts\/(?:warehouse-r361-ne-nf-ux\.test|verify-empenho-pdf-direct-import)\.mjs)$/.test(p))) {
  add('test:warehouse-r361-ne-nf-ux');
  add('verify:empenho-pdf-direct-import');
}
// Mudanças na inspeção/UX mobile executam o contrato exato e o leitor de câmera,
// além dos testes gerais selecionados por domínio.
if (files.some((p) => /^(?:features\/warehouse\/components\/Warehouse(?:HomeOperational|MobileDepotLocations|LocationInspection)\.tsx|scripts\/warehouse-location-inspection\.test\.mjs)$/.test(p))) {
  add('test:warehouse-location-inspection');
  add('test:mobile-r1-scanner');
}
if (warehouseFiles.length && tests.size === 0) {
  ['test:adm-deposito-ledger', 'test:adm-deposito-inventory'].forEach(add);
}
if (files.some((p) => /^(?:firestore(?:\.warehouse)?[.-].*\.rules|lib\/operationalPaths|lib\/server\/warehouseRequest|app\/api\/auth\/|scripts\/verify-multitenant)/.test(p))) {
  add('verify:multitenant-security');
  add('verify:emprovex-warehouse-isolation');
}
if (files.some((p) => /^(?:scripts\/firestore-recovery|ops\/firestore-recovery|scripts\/verify-backup-recovery)/.test(p))) {
  add('test:recovery');
}
const selected = [...tests].sort();
console.log('[CI LEAN] Arquivos alterados:', files.length, '| Warehouse:', warehouseFiles.length);
console.log('[CI LEAN] Testes selecionados:', selected.length ? selected.join(', ') : '(nenhum específico)');
if (process.env.CI_FAST_LIST_ONLY === '1') process.exit(0);

const failures = [];
for (const name of selected) {
  console.log('\n[CI LEAN] Executando ' + name);
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', name], { stdio: 'inherit', timeout: 180000 });
  if (result.error || result.status !== 0) {
    failures.push(name);
    console.error('[CI LEAN] FAIL:', name, result.error?.message || result.signal || result.status);
  } else {
    console.log('[CI LEAN] PASS:', name);
  }
}
console.log('[CI LEAN] Resultado:', failures.length ? 'FAIL — ' + failures.join(', ') : 'PASS');
if (failures.length) process.exitCode = 1;
