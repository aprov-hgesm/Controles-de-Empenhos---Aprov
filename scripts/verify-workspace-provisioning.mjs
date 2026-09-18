#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const store = read('lib/platformAdminStore.ts');
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
  store,
  'const termCounterRef = doc(',
  'Cadastro administrativo não referencia o contador do novo workspace.'
);
requireText(
  store,
  'transaction.get(termCounterRef)',
  'Cadastro não verifica configuração residual antes de criar o setor.'
);
requireText(
  store,
  'transaction.set(workspaceRef, workspace)',
  'Workspace deixou de ser criado na transação administrativa.'
);
requireText(
  store,
  'transaction.set(accountRef, account)',
  'Conta deixou de ser criada na transação administrativa.'
);
requireText(
  store,
  'transaction.set(termCounterRef, initialTermCounter)',
  'Contador inicial não é criado atomicamente com workspace e conta.'
);
requireText(
  store,
  'buildInstitutionalProfile(input)',
  'Cadastro de setor não sanitiza campos institucionais opcionais antes de gravar no Firestore.'
);
requireText(
  store,
  "optionalTrimmedField('defaultDeliveryLocation'",
  'Local de entrega opcional pode voltar a ser persistido como undefined.'
);
requireText(
  store,
  "optionalTrimmedField('defaultResponsibleRole'",
  'Função responsável opcional pode voltar a ser persistida como undefined.'
);
forbidText(
  store,
  '|| undefined',
  'Cadastro/edição administrativa voltou a produzir valores undefined para o Firestore.'
);

requireText(
  rules,
  'function canAdminProvisionTermCounter(workspaceId)',
  'Rules não possuem autorização restrita para provisionamento administrativo do contador.'
);
requireText(
  rules,
  "isPlatformAdmin()\n          && !workspaceExists(workspaceId)",
  'Cadastro administrativo não consegue verificar contador residual antes de criar um workspace.'
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
requireText(
  rules,
  "affectedKeys().hasOnly([\n          'currentNumber'",
  'Atualização do contador pode alterar campos não relacionados.'
);

forbidText(
  store,
  "WORKSPACE_DOCUMENT_STORAGE_SETTINGS_ID",
  'Cadastro de setor não deve pré-configurar Google Drive no Bloco 17.'
);
forbidText(
  store,
  "'documentStorage'",
  'Cadastro de setor materializa documentStorage antes do onboarding real.'
);
requireText(
  driveSettings,
  "if (!snapshot.exists())",
  'Runtime do Drive não reconhece ausência de documentStorage como estado ainda não configurado.'
);

if (findings.length) {
  console.error('Bloco 17 — provisionamento automático de workspaces\n');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  console.error(`\nWORKSPACE PROVISIONING: BLOQUEADO (${findings.length} achado(s))`);
  process.exitCode = 2;
} else {
  console.log('Bloco 17 — provisionamento automático de workspaces\n');
  console.log('Workspace + conta + contador: transação única');
  console.log('Contador inicial de TR: 0');
  console.log('Configuração residual: bloqueada');
  console.log('Coleções operacionais: vazias até o uso');
  console.log('Google Drive: não pré-configurado');
  console.log('Administrador: sem bypass operacional');
  console.log('Contador: protegido contra exclusão e regressão');
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
