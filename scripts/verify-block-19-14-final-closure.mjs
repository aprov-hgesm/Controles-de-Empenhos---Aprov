#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = process.cwd();
const findings = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const requireText = (source, expected, message) => {
  if (!source.includes(expected)) findings.push(message);
};

const forbidText = (source, forbidden, message) => {
  if (source.includes(forbidden)) findings.push(message);
};

function collectFiles(dir) {
  const absolute = resolve(root, dir);
  const files = [];
  for (const entry of readdirSync(absolute)) {
    const path = join(absolute, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...collectFiles(path.slice(root.length + 1)));
    } else {
      files.push(path);
    }
  }
  return files;
}

const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');
const page = read('app/page.tsx');
const plan = read('lib/operationalSubscriptionPlan.ts');
const planTest = read('scripts/operational-subscription-plan.test.mjs');
const snapshot = read('features/inicio/domain/homeOperationalSnapshot.ts');
const snapshotHook = read('features/inicio/hooks/useInicioOperationalSnapshot.ts');
const performance = read('features/inicio/hooks/useInicioPerformanceProfile.ts');
const e2e = read('tests/e2e/operator-critical-flow.spec.mjs');
const rules = read('firestore.rules');
const docs = read('docs/block-19-home-experience.md');
const finalAudit = read('docs/block-19-final-audit.md');

const requiredGuardScripts = [
  'verify:block-19-home-experience',
  'verify:block-19-2-cinematic-scene',
  'verify:block-19-3-interactive-core',
  'verify:block-19-4-operational-orbits',
  'verify:block-19-5-operational-constellation',
  'verify:block-19-6-unit-identity',
  'verify:block-19-7-quick-actions-resume',
  'verify:block-19-8-microinteractions',
  'verify:block-19-9-surface-transitions',
  'verify:block-19-10-home-snapshot-economy',
  'verify:block-19-11-performance-gpu',
  'verify:block-19-12-responsiveness',
  'verify:block-19-13-visual-polish',
];

for (const script of requiredGuardScripts) {
  requireText(pkg, `"${script}"`, `Script obrigatório ausente: ${script}`);
}

const requiredGuardFiles = [
  'scripts/verify-block-19-home-experience.mjs',
  'scripts/verify-block-19-2-cinematic-scene.mjs',
  'scripts/verify-block-19-3-interactive-core.mjs',
  'scripts/verify-block-19-4-operational-orbits.mjs',
  'scripts/verify-block-19-5-operational-constellation.mjs',
  'scripts/verify-block-19-6-unit-identity.mjs',
  'scripts/verify-block-19-7-quick-actions-resume.mjs',
  'scripts/verify-block-19-8-microinteractions.mjs',
  'scripts/verify-block-19-9-surface-transitions.mjs',
  'scripts/verify-block-19-10-home-snapshot-economy.mjs',
  'scripts/verify-block-19-11-performance-gpu.mjs',
  'scripts/verify-block-19-12-responsiveness.mjs',
  'scripts/verify-block-19-13-visual-polish.mjs',
];

for (const path of requiredGuardFiles) {
  if (!existsSync(resolve(root, path))) findings.push(`Guard obrigatório ausente: ${path}`);
}

requireText(
  page,
  "useState<OperationalActiveTab>('painel')",
  'Painel deixou de ser o landing pós-login antes da homologação humana.'
);

const inicioPlan = plan.match(/inicio:\s*\{([\s\S]*?)\n\s*\},/);
if (!inicioPlan) {
  findings.push('Plano realtime do Início ausente.');
} else {
  for (const collectionName of [
    'empenhos',
    'alerts',
    'invoices',
    'comissoes',
    'cronogramas',
  ]) {
    requireText(
      inicioPlan[1],
      `${collectionName}: false`,
      `Início reativou coleção operacional bruta: ${collectionName}.`
    );
  }
}

requireText(planTest, 'inicio: []', 'Teste do plano realtime não exige Início sem coleções brutas.');
requireText(
  snapshot,
  "INICIO_SNAPSHOT_DOCUMENT_ID = 'homeSnapshot'",
  'Snapshot final não usa documento único homeSnapshot.'
);
requireText(snapshot, 'INICIO_MAX_VISIBLE_STARS = 72', 'Constelação perdeu limite de 72 estrelas.');
requireText(snapshotHook, 'recordWorkspaceRealtimeSnapshot(scope, 1)', 'Telemetria do snapshot não contabiliza uma leitura documental.');
requireText(rules, 'match /workspaces/{workspaceId}/settings/homeSnapshot', 'Rules do snapshot ausentes.');
requireText(rules, 'homeSnapshotUgMatchesWorkspace', 'Rules não vinculam snapshot à UG do workspace.');
requireText(rules, 'request.resource.data.stars.size() <= 72', 'Rules não limitam estrelas.');
requireText(rules, 'allow delete: if false;', 'Snapshot derivado deixou de proteger delete.');

requireText(performance, "'full' | 'balanced' | 'static'", 'Perfis adaptativos de performance ausentes.');
requireText(performance, 'prefers-reduced-motion: reduce', 'Reduced motion não participa do perfil final.');
requireText(performance, 'visibilitychange', 'Animações não reagem à visibilidade da aba.');

requireText(e2e, "const OPERATOR_A = 'sector-lifecycle@example.test'", 'Operador externo A ausente do E2E.');
requireText(e2e, "const OPERATOR_B = 'sector-b@example.test'", 'Operador externo B ausente do E2E.');
requireText(e2e, "test('segundo workspace não enxerga a NS nem o fornecedor do primeiro'", 'E2E não cobre isolamento entre workspaces externos.');
requireText(e2e, "test('duas sessões por setor, múltiplas abas compartilham vaga e terceira sessão é barrada'", 'E2E não cobre limite de sessões externas.');
requireText(e2e, "test('perfil realtime acompanha a seção ativa sem manter coleções ociosas'", 'E2E não cobre consumo realtime por superfície.');
requireText(e2e, "test('Início permanece responsivo em celular, tablet e landscape sem overflow horizontal'", 'E2E não cobre responsividade final.');
requireText(e2e, 'expectRealtimeProfile(page, 1)', 'E2E não comprova perfil econômico do Início.');
requireText(e2e, "page.locator('[data-snapshot="ready"]')", 'E2E não comprova snapshot pronto.');
requireText(e2e, "phone-small', width: 360, height: 800", 'Viewport 360x800 ausente.');
requireText(e2e, "phone-standard', width: 390, height: 844", 'Viewport 390x844 ausente.');
requireText(e2e, "tablet-portrait', width: 768, height: 1024", 'Viewport 768x1024 ausente.');
requireText(e2e, "phone-landscape', width: 844, height: 390", 'Viewport 844x390 ausente.');

requireText(finalAudit, 'Fechamento técnico do Bloco 19', 'Relatório final não declara fechamento técnico.');
requireText(finalAudit, 'homologação humana', 'Relatório final não separa homologação humana de teste automatizado.');
requireText(finalAudit, '0 coleções operacionais brutas', 'Relatório final não registra contrato econômico.');
requireText(finalAudit, 'A PR do Bloco 19 deve permanecer **Draft**', 'Relatório final não preserva PR Draft.');
requireText(docs, 'Bloco 19.14', 'Documento principal não registra o fechamento 19.14.');

const inicioFiles = collectFiles('features/inicio')
  .filter((path) => /\.(ts|tsx|css)$/.test(path))
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n');

forbidText(inicioFiles, "from 'three'", 'Início adicionou dependência Three.js.');
forbidText(inicioFiles, 'three.js', 'Início adicionou referência Three.js.');
forbidText(inicioFiles, '<canvas', 'Início adicionou Canvas.');
forbidText(inicioFiles, 'WebGLRenderer', 'Início adicionou WebGL.');

requireText(workflow, 'Block 19.13 visual polish guard', 'CI não executa guard 19.13.');
requireText(workflow, 'Block 19 Final Closure Gate', 'Workflow não possui gate final do Bloco 19.');

if (findings.length) {
  console.error('BLOCK 19.14 FINAL CLOSURE: FAIL');
  findings.forEach((finding) => console.error('  [BLOCK] ' + finding));
  process.exitCode = 2;
} else {
  console.log('BLOCK 19.14 FINAL CLOSURE: READY');
  console.log('Blocos 19.1–19.13: PROTEGIDOS');
  console.log('Landing pós-login: PAINEL PRESERVADO');
  console.log('Início — coleções operacionais brutas: ZERO');
  console.log('Início — snapshot operacional realtime: 1');
  console.log('Operadores externos em emulador: COBERTOS');
  console.log('Isolamento multitenant: COBERTO');
  console.log('Sessões simultâneas: COBERTAS');
  console.log('Responsividade multi-viewport: COBERTA');
  console.log('WebGL/Three/Canvas: AUSENTES');
  console.log('Homologação humana real: GATE PRÉ-MERGE');
}
