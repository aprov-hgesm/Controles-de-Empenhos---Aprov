#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireText = (source, expected, message) => {
  if (!source.includes(expected)) findings.push(message);
};
const forbidText = (source, forbidden, message) => {
  if (source.includes(forbidden)) findings.push(message);
};

const plan = read('lib/operationalSubscriptionPlan.ts');
const realtime = read('hooks/useOperationalRealtimeCollections.ts');
const dataHook = read('hooks/useOperationalData.ts');
const snapshotHook = read('features/inicio/hooks/useInicioOperationalSnapshot.ts');
const snapshotDomain = read('features/inicio/domain/homeOperationalSnapshot.ts');
const view = read('features/inicio/components/InicioView.tsx');
const orbit = read('features/inicio/components/InicioOrbitSystem.tsx');
const constellation = read('features/inicio/components/InicioConstellation.tsx');
const page = read('app/page.tsx');
const rules = read('firestore.rules');
const subscriptionTest = read('scripts/operational-subscription-plan.test.mjs');
const e2e = read('tests/e2e/operator-critical-flow.spec.mjs');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');
const docs = read('docs/block-19-home-experience.md');

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
      `Início voltou a ativar coleção bruta: ${collectionName}.`
    );
  }
}

requireText(
  snapshotDomain,
  "INICIO_SNAPSHOT_VERSION = 'emprovex_home_snapshot_v1'",
  'Versão do snapshot econômico ausente.'
);
requireText(
  snapshotDomain,
  'INICIO_MAX_VISIBLE_STARS = 72',
  'Snapshot perdeu limite de 72 estrelas.'
);
requireText(
  snapshotDomain,
  'contentHash: stableHash(JSON.stringify(content))',
  'Snapshot não possui hash estável para evitar writes redundantes.'
);
requireText(
  snapshotDomain,
  'return left.id.localeCompare(right.id);',
  'Seleção de estrelas não é determinística por ID.'
);
forbidText(
  snapshotDomain,
  'updatedAt ||',
  'Metadados invisíveis como updatedAt voltaram a influenciar o snapshot.'
);
requireText(
  snapshotHook,
  "return activeTab === 'empenhos' || activeTab === 'nova_nf' || activeTab === 'avisos';",
  'Publicação do snapshot não contempla Empenhos, NF e Central de Avisos.'
);
requireText(
  snapshotHook,
  "(activeTab !== 'avisos' && !invoicesReady)",
  'Empenhos/NF podem publicar snapshot antes de invoices estarem prontos.'
);
requireText(
  snapshotHook,
  'refreshInicioOperationalSnapshotAlerts',
  'Central de Avisos não preserva pendências de NF ao atualizar homeSnapshot.'
);
requireText(
  snapshotHook,
  'knownRemote.hash === candidate.contentHash',
  'Publisher não evita gravação quando o conteúdo não mudou.'
);
requireText(
  snapshotHook,
  'SNAPSHOT_PUBLISH_DEBOUNCE_MS = 900',
  'Publisher não possui debounce para coalescer mudanças.'
);
requireText(
  snapshotHook,
  'onSnapshot(',
  'Início não observa o documento econômico em realtime.'
);
requireText(
  snapshotHook,
  'INICIO_SNAPSHOT_DOCUMENT_ID',
  'Hook não usa o documento único homeSnapshot.'
);
requireText(
  snapshotHook,
  'recordWorkspaceRealtimeSnapshot(scope, 1)',
  'Telemetria não contabiliza a leitura documental do snapshot.'
);
requireText(
  snapshotHook,
  'recordWorkspaceDocumentWrites(scope, 1)',
  'Telemetria não contabiliza gravação do snapshot.'
);
requireText(
  dataHook,
  "activeTab === 'inicio'",
  'useOperationalData não trata prontidão especial do Início.'
);
requireText(
  dataHook,
  '? inicioSnapshotReady',
  'Prontidão do Início não depende do documento snapshot.'
);
requireText(
  dataHook,
  'operationalCollectionCount',
  'Contagem de listeners operacionais não foi preservada.'
);
requireText(
  dataHook,
  '? 1',
  'Contagem realtime não inclui o único listener do snapshot.'
);
requireText(
  view,
  'snapshot: InicioOperationalSnapshot | null',
  'InicioView não recebe o snapshot compacto.'
);
requireText(
  orbit,
  'snapshot: InicioOperationalSnapshot | null',
  'Sistema orbital não recebe o snapshot compacto.'
);
requireText(
  constellation,
  'snapshot: InicioOperationalSnapshot | null',
  'Constelação não recebe o snapshot compacto.'
);
requireText(
  page,
  'snapshot={inicioSnapshot}',
  'Página principal não injeta snapshot no Início.'
);

forbidText(view, 'Empenho[]', 'InicioView voltou a receber empenhos brutos.');
forbidText(view, 'Alert[]', 'InicioView voltou a receber alertas brutos.');
forbidText(orbit, 'Empenho[]', 'Órbitas voltaram a consumir empenhos brutos.');
forbidText(orbit, 'Alert[]', 'Órbitas voltaram a consumir alertas brutos.');
forbidText(constellation, 'Empenho[]', 'Constelação voltou a consumir empenhos brutos.');
forbidText(constellation, 'Alert[]', 'Constelação voltou a consumir alertas brutos.');
forbidText(
  snapshotHook,
  'operationalCollectionRef',
  'Hook econômico abriu coleção operacional diretamente.'
);
forbidText(
  snapshotHook,
  'collection(',
  'Hook econômico abriu query de coleção.'
);

requireText(
  rules,
  'match /workspaces/{workspaceId}/settings/homeSnapshot',
  'Rules não possuem match dedicado para homeSnapshot.'
);
requireText(
  rules,
  "snapshotVersion == 'emprovex_home_snapshot_v1'",
  'Rules não travam versão do snapshot.'
);
requireText(
  rules,
  'request.resource.data.stars.size() <= 72',
  'Rules não limitam a constelação a 72 estrelas.'
);
requireText(
  rules,
  'homeSnapshotUgMatchesWorkspace(workspaceId, request.resource.data.ug)',
  'Rules não vinculam snapshot à UG do workspace.'
);
requireText(
  rules,
  'allow delete: if false;',
  'Snapshot derivado pode ser apagado pelo runtime.'
);

requireText(
  subscriptionTest,
  'inicio: []',
  'Teste do plano realtime não exige zero coleções brutas no Início.'
);
requireText(
  e2e,
  "getByRole('button', { name: 'Início', exact: true })",
  'E2E não navega para o Início econômico.'
);
requireText(
  e2e,
  `page.locator('[data-snapshot="ready"]')`,
  'E2E não confirma snapshot pronto.'
);
requireText(
  pkg,
  'home-snapshot-security.test.mjs',
  'Suite multitenant não inclui teste de segurança do snapshot.'
);
requireText(
  workflow,
  'Block 19.10 economical home snapshot guard',
  'CI não executa guard do Bloco 19.10.'
);
requireText(
  docs,
  'Bloco 19.10',
  'Documentação não registra o snapshot econômico.'
);
requireText(
  docs,
  '1 documento',
  'Documentação não explicita meta de um único documento.'
);

if (findings.length) {
  console.error('BLOCK 19.10 ECONOMICAL HOME SNAPSHOT: FAIL');
  findings.forEach((finding) => console.error('  [BLOCK] ' + finding));
  process.exitCode = 2;
} else {
  console.log('BLOCK 19.10 ECONOMICAL HOME SNAPSHOT: READY');
  console.log('Início — coleções brutas: ZERO');
  console.log('Início — documento realtime: 1');
  console.log('Constelação máxima: 72 estrelas');
  console.log('Write deduplication por contentHash: ATIVA');
  console.log('Isolamento workspace/UG: PROTEGIDO');
}
