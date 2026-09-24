#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function requireText(content, marker, message) {
  if (!content.includes(marker)) findings.push(message);
}

function forbidText(content, pattern, message) {
  if (typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content)) {
    findings.push(message);
  }
}

function walkFiles(relativePath) {
  const absolute = resolve(root, relativePath);
  if (!existsSync(absolute)) return [];
  const result = [];
  const walk = (path) => {
    for (const entry of readdirSync(path)) {
      const child = resolve(path, entry);
      const stat = statSync(child);
      if (stat.isDirectory()) walk(child);
      else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry)) result.push(child);
    }
  };
  walk(absolute);
  return result;
}

const protectedCoreFiles = [
  'app/page.tsx',
  'lib/firebaseSync.ts',
  'lib/nsIntegrityService.ts',
  'lib/empenhoConcurrencyService.ts',
  'lib/empenhoDeletionService.ts',
  'lib/operationalPaths.ts',
  'hooks/useOperationalData.ts',
  'hooks/useOperationalRealtimeCollections.ts',
  'features/notas-fiscais/hooks/useNotasFiscaisActions.ts',
  'features/empenhos/hooks/useEmpenhoActions.ts',
  'features/cronogramas/hooks/useCronogramaActions.ts',
  'features/avisos/hooks/useAvisosActions.ts',
];

for (const path of protectedCoreFiles) {
  const content = read(path);
  forbidText(
    content,
    /from\s+['"][^'"]*(?:\/warehouse\/|features\/warehouse|adm-deposito)[^'"]*['"]/,
    `Núcleo operacional depende da implementação do ADM Depósito: ${path}`
  );
  for (const forbidden of [
    'integrateInvoiceReceiptInTransaction',
    'integrateInvoiceDeletionInTransaction',
    'assertBulkInvoiceDeletionDoesNotBypassWarehouse',
    'warehouseIntegration',
    'warehouseMaterialId',
    'warehouseMovementIds',
  ]) {
    forbidText(
      content,
      forbidden,
      `Núcleo operacional contém estado/efeito logístico proibido (${forbidden}): ${path}`
    );
  }
}

const nsLifecycle = read('lib/nsIntegrityService.ts');
const receiptStart = nsLifecycle.indexOf('export async function commitInvoiceReceiptLifecycle');
const receiptEnd = nsLifecycle.indexOf('export async function commitInvoiceDeletionLifecycle');
if (receiptStart < 0 || receiptEnd <= receiptStart) {
  findings.push('Não foi possível isolar o lifecycle crítico de recebimento de NF.');
} else {
  const receipt = nsLifecycle.slice(receiptStart, receiptEnd);
  forbidText(receipt, /operationalDocRef\(scope,\s*['"]alerts['"]/, 'Alerta informativo voltou para a transação crítica da NF.');
  forbidText(receipt, /warehouse/i, 'Lifecycle crítico da NF voltou a depender do ADM Depósito.');
  if (!/operationalDocRef\(\s*scope,\s*['"]invoices['"]/.test(receipt)) {
    findings.push('Lifecycle de NF perdeu a gravação operacional da invoice.');
  }
  if (!/operationalDocRef\(\s*scope,\s*['"]empenhos['"]/.test(receipt)) {
    findings.push('Lifecycle de NF perdeu a atualização operacional do empenho.');
  }
}

const nfActions = read('features/notas-fiscais/hooks/useNotasFiscaisActions.ts');
const saveStart = nfActions.indexOf('const handleSaveInvoice');
const coreCommit = nfActions.indexOf('const result = await commitInvoiceReceiptChanges', saveStart);
const saveEnd = nfActions.indexOf('const handleInvoiceDocumentUploaded', saveStart);
if (saveStart < 0 || coreCommit < 0 || saveEnd <= coreCommit) {
  findings.push('Não foi possível validar a ordem operacional do cadastro de NF.');
} else {
  const beforeCoreCommit = nfActions.slice(saveStart, coreCommit);
  const afterCoreCommit = nfActions.slice(coreCommit, saveEnd);
  forbidText(beforeCoreCommit, 'await uploadInvoicePdf', 'Upload de PDF voltou a bloquear o commit operacional da NF.');
  forbidText(beforeCoreCommit, 'await saveAlert', 'Alerta voltou a bloquear o commit operacional da NF.');
  requireText(afterCoreCommit, 'void saveAlert(', 'Alerta de NF deixou de ser persistido como efeito auxiliar não bloqueante.');
  requireText(afterCoreCommit, 'void (async () => {', 'Anexo de PDF deixou de ser executado após o commit operacional.');
  const uploadAfterIndex = afterCoreCommit.indexOf('uploadedDocument = await uploadInvoicePdf');
  if (uploadAfterIndex < 0) {
    findings.push('Upload de PDF pós-commit da NF não foi encontrado.');
  }
}

const optionalModuleRoots = [
  'lib/warehouse',
  'features/warehouse',
  'app/adm-deposito',
  'app/api/adm-deposito',
];
const optionalModuleFiles = optionalModuleRoots.flatMap(walkFiles);
for (const absolutePath of optionalModuleFiles) {
  const content = readFileSync(absolutePath, 'utf8');
  const relative = absolutePath.slice(root.length + 1).replaceAll('\\', '/');

  for (const forbiddenImport of [
    /from\s+['"][^'"]*firebaseSync['"]/,
    /from\s+['"][^'"]*nsIntegrityService['"]/,
    /from\s+['"][^'"]*empenhoDeletionService['"]/,
    /from\s+['"][^'"]*empenhoConcurrencyService['"]/,
    /from\s+['"][^'"]*features\/notas-fiscais\/hooks['"]/,
    /from\s+['"][^'"]*features\/empenhos\/hooks['"]/,
    /from\s+['"][^'"]*features\/cronogramas\/hooks['"]/,
  ]) {
    forbidText(
      content,
      forbiddenImport,
      `Módulo opcional importa serviço de mutação do núcleo: ${relative}`
    );
  }

  for (const forbiddenCall of [
    'saveInvoice(',
    'saveEmpenho(',
    'createEmpenho(',
    'saveAlert(',
    'saveCronograma(',
    'commitInvoiceReceiptChanges(',
    'commitInvoiceDeletion(',
    'commitAllInvoicesDeletion(',
    'removeEmpenho(',
  ]) {
    forbidText(
      content,
      forbiddenCall,
      `Módulo opcional tenta comandar mutação operacional (${forbiddenCall}): ${relative}`
    );
  }

  forbidText(
    content,
    /operationalDocRef\s*\(/,
    `ADM Depósito não pode obter referência de documento operacional para escrita: ${relative}`
  );
  forbidText(
    content,
    /operationalSettingsDocRef\s*\(/,
    `ADM Depósito não pode obter referência de settings operacionais para escrita: ${relative}`
  );
}

const operationalPaths = read('lib/operationalPaths.ts');
forbidText(operationalPaths, /warehouse|adm-deposito/i, 'O namespace ADM Depósito contaminou o resolvedor de paths operacionais.');

const rules = read('firestore.rules');
const operationalMarker = '// Workspace-scoped operational data.';
const operationalStart = rules.indexOf(operationalMarker);
if (operationalStart < 0) {
  findings.push('Marcador das Firestore Rules operacionais não encontrado.');
} else {
  const operationalRules = rules.slice(operationalStart);
  forbidText(
    operationalRules,
    /warehouse|canAccessWarehouseModule|ADM Depósito/i,
    'Firestore Rules operacionais passaram a depender do ADM Depósito.'
  );
}

const telemetry = read('lib/workspaceUsageTelemetry.ts');
requireText(
  telemetry,
  "console.warn('Não foi possível consolidar a telemetria estimada da UG.'",
  'Telemetria perdeu o tratamento best-effort e pode voltar a afetar o fluxo operacional.'
);

const appPage = read('app/page.tsx');
forbidText(
  appPage,
  /from\s+['"][^'"]*\/warehouse\//,
  'Shell principal voltou a importar implementação do ADM Depósito.'
);
requireText(
  appPage,
  "from '../lib/platformModuleAccess'",
  'Shell principal não utiliza a camada neutra de acesso a módulos opcionais.'
);

if (findings.length) {
  console.error('EMPROVEX CORE PROTECTION: FALHOU');
  for (const finding of findings) console.error('- ' + finding);
  process.exit(1);
}

console.log('EMPROVEX CORE PROTECTION: OK');
console.log('- núcleo operacional sem dependência de implementação do ADM Depósito');
console.log('- NF confirma Firestore antes de alerta/PDF auxiliares');
console.log('- ADM Depósito não comanda mutações do núcleo operacional');
console.log('- Rules operacionais sem referência ao namespace warehouse');
console.log('- telemetria permanece best-effort');
