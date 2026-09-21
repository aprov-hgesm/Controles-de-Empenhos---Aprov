#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const findings = [];

function requireText(source, expected, message) {
  if (!source.includes(expected)) findings.push(message);
}

function forbidText(source, forbidden, message) {
  if (source.includes(forbidden)) findings.push(message);
}

const adminPage = read('app/admin/page.tsx');
const adminView = read('components/admin/PlatformAdminView.tsx');
const createSector = read('components/admin/AdminCreateSectorPanel.tsx');
const consumption = read('components/admin/AdminConsumptionHub.tsx');
const backup = read('components/admin/AdminBackupPanel.tsx');
const security = read('components/admin/AdminSecurityPanel.tsx');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

for (const marker of [
  "type AdminTabId =",
  "'overview'",
  "'setores'",
  "'novo-setor'",
  "'consumo'",
  "'sessoes'",
  "'backups'",
  "'seguranca'",
  'data-testid="admin-tab-navigation"',
  'data-testid="admin-overview-tab"',
  'data-testid="admin-sectors-tab"',
  'new URLSearchParams(window.location.search)',
  "url.searchParams.set('tab', tab)",
  '<AdminCreateSectorPanel',
  '<AdminConsumptionHub',
  '<AdminSessionsPanel',
  '<AdminBackupPanel',
  '<AdminSecurityPanel',
  'placeholder="Buscar por UG, OM, setor, e-mail ou workspace..."',
]) {
  requireText(adminView, marker, 'Arquitetura administrativa perdeu requisito: ' + marker);
}

for (const marker of [
  'data-testid="admin-create-sector-panel"',
  'Criar setor e provisionar acesso',
  'UG da OM',
  'E-mail de acesso (Gmail)',
  'onCreate(form)',
]) {
  requireText(createSector, marker, 'Cadastro dedicado perdeu requisito: ' + marker);
}

for (const marker of [
  'data-testid="admin-consumption-hub"',
  'Cota diária',
  'Histórico & Relatórios',
  'Visão consolidada',
  'Consumo por UG',
  'Alertas e limites',
  '<AdminGlobalUsagePanel',
  '<AdminUsageReportsPanel',
  '<AdminConsolidatedUsagePanel',
  '<AdminUsagePanel',
]) {
  requireText(consumption, marker, 'Hub de consumo perdeu requisito: ' + marker);
}

for (const marker of [
  'data-testid="admin-backup-panel"',
  'usePlatformAdminBackups',
  'useFounderAuthBackup',
  'Saúde dos backups por UG',
  'Backup global de identidades',
]) {
  requireText(backup, marker, 'Aba de backup perdeu requisito: ' + marker);
}

for (const marker of [
  'data-testid="admin-security-panel"',
  'Segurança e integridade',
  'Isolamento por workspace',
  'Firestore Rules',
  'Defesa de documentos',
]) {
  requireText(security, marker, 'Aba de segurança perdeu requisito: ' + marker);
}

requireText(adminPage, 'adminUser={user}', 'Página administrativa não entrega a sessão fundadora ao hub.');
forbidText(adminPage, 'href="/admin/backups"', 'A navegação de backup voltou ao botão flutuante legado.');

requireText(
  pkg,
  '"verify:admin-information-architecture"',
  'package.json não registra o guard da arquitetura administrativa.'
);
requireText(
  workflow,
  'EMPROVEX admin information architecture guard',
  'Application CI não executa o guard da nova arquitetura administrativa.'
);

if (findings.length > 0) {
  console.error('EMPROVEX ADMIN INFORMATION ARCHITECTURE: FAIL');
  for (const finding of findings) console.error('  [BLOCK] ' + finding);
  process.exitCode = 2;
} else {
  console.log('EMPROVEX ADMIN INFORMATION ARCHITECTURE: READY');
  console.log('Navegação principal: 7 abas');
  console.log('Cadastro de setor: SUPERFÍCIE DEDICADA');
  console.log('Consumo e cotas: HUB COM DRILL-DOWNS');
  console.log('Backup: INTEGRADO AO HUB');
  console.log('Segurança: VISÃO ADMINISTRATIVA DEDICADA');
}
