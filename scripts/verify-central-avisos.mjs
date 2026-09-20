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

const types = read('lib/types.ts');
const domain = read('features/avisos/domain/noticeLifecycle.ts');
const actions = read('features/avisos/hooks/useAvisosActions.ts');
const view = read('features/avisos/components/CentralAvisosView.tsx');
const page = read('app/page.tsx');
const sidebar = read('components/layout/AppSidebar.tsx');
const plan = read('lib/operationalSubscriptionPlan.ts');
const snapshot = read('features/inicio/domain/homeOperationalSnapshot.ts');
const snapshotHook = read('features/inicio/hooks/useInicioOperationalSnapshot.ts');
const orbit = read('features/inicio/components/InicioOrbitSystem.tsx');
const empenhoActions = read('features/empenhos/hooks/useEmpenhoActions.ts');
const invoiceActions = read('features/notas-fiscais/hooks/useNotasFiscaisActions.ts');
const rules = read('firestore.rules');
const e2e = read('tests/e2e/operator-critical-flow.spec.mjs');

requireText(types, "'INFORMATIVO' | 'CRÍTICO' | 'ATENÇÃO' | 'ESTOQUE ZERADO'", 'Tipos de aviso não distinguem informativo.');
requireText(types, "'NOVO' | 'LIDO' | 'RESOLVIDO' | 'ARQUIVADO'", 'Ciclo de vida dos avisos ausente.');
requireText(domain, 'isNoticePending', 'Normalização de pendências ausente.');
requireText(domain, 'LEGACY_INFORMATIONAL_PATTERNS', 'Compatibilidade com avisos informativos legados ausente.');
requireText(actions, "saveAlert(user.uid, updated)", 'Gestão de avisos não persiste no Firestore.');
requireText(actions, 'markAllUnreadAsRead', 'Ação coletiva de leitura ausente.');
requireText(view, 'Central de Avisos', 'Tela Central de Avisos ausente.');
requireText(view, 'Marcar novos como lidos', 'Gestão de leitura ausente.');
requireText(view, 'Resolver', 'Gestão de resolução ausente.');
requireText(view, 'Arquivar', 'Gestão de arquivamento ausente.');
requireText(view, 'Reabrir', 'Gestão de reabertura ausente.');
requireText(view, 'Abrir empenho', 'Vínculo aviso → empenho ausente.');

requireText(sidebar, 'data-testid="nav-avisos"', 'Sidebar não expõe Central de Avisos.');
requireText(sidebar, 'noticeCount', 'Sidebar não mostra contador de pendências.');
requireText(page, "activeTab === 'avisos'", 'Página principal não renderiza Central de Avisos.');
requireText(page, 'noticeCount={pendingNoticeCount}', 'Página não injeta contador de pendências na Sidebar.');
requireText(plan, 'avisos:', 'Plano realtime não possui Central de Avisos.');
requireText(plan, 'alerts: true', 'Central de Avisos não carrega coleção de avisos.');
requireText(snapshot, 'pendingAlerts = alerts.filter(isNoticePending)', 'Home ainda conta histórico inteiro como pendência.');
requireText(snapshotHook, "activeTab === 'avisos'", 'Mudanças da Central não atualizam homeSnapshot.');
requireText(orbit, 'Avisos pendentes', 'Planeta da Home ainda usa nomenclatura ambígua de alertas ativos.');
forbidText(orbit, 'onClick=', 'Planeta da Home recebeu redirecionamento proibido.');

requireText(empenhoActions, "type: 'INFORMATIVO'", 'Novo empenho ainda gera atenção falsa.');
requireText(invoiceActions, "type: 'INFORMATIVO'", 'Sucesso de NF ainda gera atenção falsa.');
requireText(rules, 'match /workspaces/{workspaceId}/alerts/{id}', 'Rules não protegem coleção de avisos por workspace.');
requireText(rules, 'linkedEmpenhoWriteAllowedAfter', 'Writes de avisos perderam proteção do vínculo com empenho.');
requireText(e2e, "getByTestId('nav-avisos')", 'Browser E2E não abre Central de Avisos.');
requireText(e2e, "heading', { name: 'Central de Avisos'", 'Browser E2E não confirma a nova superfície.');

forbidText(view, 'onSnapshot', 'Central de Avisos abriu listener Firestore diretamente.');
forbidText(view, 'firebase', 'Central de Avisos acoplou Firebase diretamente.');

if (findings.length) {
  console.error('CENTRAL DE AVISOS: FAIL');
  findings.forEach((finding) => console.error('  [BLOCK] ' + finding));
  process.exitCode = 2;
} else {
  console.log('CENTRAL DE AVISOS: READY');
  console.log('Informativos / Atenção / Críticos: SEPARADOS');
  console.log('Novo / Lido / Resolvido / Arquivado: ATIVOS');
  console.log('Sidebar + contador: ATIVOS');
  console.log('Home: SOMENTE PENDÊNCIAS RELEVANTES');
  console.log('Planeta da Home: INFORMATIVO, SEM REDIRECIONAMENTO');
  console.log('Vínculo com empenho: PRESERVADO');
}
