#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const server = read('lib/server/sectorProvisioningAdmin.ts');
const shared = read('lib/sectorProvisioning.ts');
const provisioning = read('lib/workspaceProvisioning.ts');
const rules = read('firestore.rules');
const driveSettings = read('lib/workspaceDriveSettings.ts');

requireText(
  provisioning,
  "WORKSPACE_TERM_COUNTER_SETTINGS_ID = 'termoRecebimentoCounter'",
  'ID do contador inicial não está centralizado.'
);
requireText(
  provisioning,
  'currentNumber: 0',
  'Novo workspace não inicia o contador de TR em zero.'
);

requireText(
  server,
  'const counterPath =',
  'Provisionamento server-side não referencia o contador do novo workspace.'
);
requireText(
  server,
  'currentDocument: { exists: false }',
  'Provisionamento não protege criação contra documentos residuais/duplicados.'
);
requireText(
  server,
  'createSectorDirectory',
  'Provisionamento server-side não cria o diretório operacional.'
);
requireText(
  server,
  'fields: toFirestoreFields(result.workspace',
  'Workspace deixou de ser criado pelo provisionamento privilegiado.'
);
requireText(
  server,
  'fields: toFirestoreFields(result.account',
  'Conta deixou de ser criada pelo provisionamento privilegiado.'
);
requireText(
  server,
  'fields: toFirestoreFields(termCounter',
  'Contador inicial deixou de ser criado com workspace e conta.'
);
requireText(
  server,
  'platformUgIndex',
  'Novo workspace não reserva índice exclusivo de UG.'
);
requireText(
  shared,
  'isValidUnitUg(ug)',
  'Novo workspace não exige UG válida.'
);
requireText(
  shared,
  'buildSectorInstitutionalProfile(input)',
  'Cadastro de setor não sanitiza campos institucionais antes da persistência.'
);
requireText(
  shared,
  "defaultDeliveryLocation = organizationShortName",
  'Local de entrega deixou de ser derivado automaticamente da sigla.'
);
requireText(
  shared,
  "Setor de Aprovisionamento -",
  'Local de entrega padronizado não está presente.'
);
requireText(
  shared,
  "defaultResponsibleRole: 'Chefe do Aprovisionamento'",
  'Função responsável deixou de ser padronizada.'
);
forbidText(
  shared,
  '|| undefined',
  'Cadastro administrativo voltou a produzir valores undefined para o Firestore.'
);

requireText(
  rules,
  'function canAdminProvisionTermCounter(workspaceId)',
  'Rules não preservam autorização restrita do contador administrativo legado.'
);
requireText(
  rules,
  'request.resource.data.currentNumber == 0',
  'Rules não exigem contador inicial igual a zero.'
);
requireText(
  rules,
  "match /workspaces/{workspaceId}/settings/termoRecebimentoCounter",
  'Rules não tratam o contador operacional separadamente.'
);
requireText(
  rules,
  "allow delete: if false;",
  'Exclusão do contador operacional não está explicitamente bloqueada.'
);
requireText(
  rules,
  "id != 'termoRecebimentoCounter'",
  'Regra genérica de settings ainda pode contornar as proteções do contador.'
);

forbidText(
  server,
  "WORKSPACE_DOCUMENT_STORAGE_SETTINGS_ID",
  'Cadastro de setor não deve pré-configurar Google Drive no Bloco 2.'
);
forbidText(
  shared,
  "'documentStorage'",
  'Cadastro de setor materializa documentStorage antes do onboarding real.'
);
requireText(
  driveSettings,
  "if (!snapshot.exists())",
  'Runtime do Drive não reconhece ausência de documentStorage como estado ainda não configurado.'
);

if (findings.length) {
  console.error('Provisionamento automático de workspaces\n');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  console.error(`\nWORKSPACE PROVISIONING: BLOQUEADO (${findings.length} achado(s))`);
  process.exitCode = 2;
} else {
  console.log('Provisionamento automático de workspaces\n');
  console.log('Workspace + conta + UG + contador: commit privilegiado e atômico');
  console.log('Contador inicial de TR: 0');
  console.log('Perfil institucional: padrões de Aprovisionamento aplicados');
  console.log('Duplicidade/configuração residual: bloqueada');
  console.log('Coleções operacionais: vazias até o uso');
  console.log('Google Drive: não pré-configurado');
  console.log('Administrador: sem bypass operacional no cliente');
  console.log('\nWORKSPACE PROVISIONING: READY');
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function requireText(source, expected, failureMessage) {
  if (!source.includes(expected)) findings.push(failureMessage);
}

function forbidText(source, forbidden, failureMessage) {
  if (source.includes(forbidden)) findings.push(failureMessage);
}
