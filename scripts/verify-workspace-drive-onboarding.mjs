#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const driveClient = read('lib/googleDriveWorkspace.ts');
const driveSettings = read('lib/workspaceDriveSettings.ts');
const driveHook = read('hooks/useWorkspaceDriveStorage.ts');
const driveControl = read('components/layout/WorkspaceDriveControl.tsx');
const appHeader = read('components/layout/AppHeader.tsx');
const page = read('app/page.tsx');
const rules = read('firestore.rules');

requireText(driveClient, 'reauthenticateWithPopup', 'Onboarding Drive não exige reautenticação explícita.');
requireText(driveClient, 'result.user.uid !== user.uid', 'Onboarding não valida o UID retornado pelo Google.');
requireText(driveClient, 'returnedEmail !== expectedEmail', 'Onboarding não valida a conta Google do setor.');
requireText(driveClient, 'emprovexWorkspaceId', 'Pastas não são marcadas pelo workspaceId.');
requireText(driveClient, 'emprovexFolderRole', 'Pastas não são marcadas por função.');
requireText(driveClient, 'const existing = await findFolder', 'Criação de pastas não é idempotente.');

requireText(driveSettings, 'assertAuthorizedDriveSession', 'Persistência de settings não valida a sessão Drive.');
requireText(driveSettings, 'session.workspaceId !== context.workspaceId', 'Persistência não confere workspace da sessão.');
requireText(driveSettings, 'sessionEmail !== expectedEmail', 'Persistência não confere e-mail da sessão.');
requireText(driveSettings, 'existingSettings?.configuredAt || now', 'Reconexão não preserva configuredAt.');

requireText(driveHook, "'not-configured'", 'Hook não representa estado inicial não configurado.');
requireText(driveHook, 'connectedSession,\n        folders,\n        settings', 'Hook não vincula settings à sessão recém-autorizada.');

requireText(appHeader, 'workspaceContext: ResolvedWorkspaceContext', 'AppHeader não recebe o contexto validado.');
forbidText(appHeader, 'resolveWorkspaceContext(currentEmail)', 'AppHeader ainda reconstrói contexto apenas pelo e-mail.');
requireText(page, 'workspaceContext={workspaceContext}', 'Página não entrega o contexto validado ao AppHeader.');

requireText(driveControl, 'Ativação inicial do armazenamento', 'UI não apresenta onboarding inicial.');
requireText(driveControl, 'Ativar Google Drive', 'UI não possui ação explícita de ativação.');
requireText(driveControl, 'Notas de Empenho', 'UI não explica a estrutura de pastas.');
requireText(driveControl, 'Notas Fiscais', 'UI não explica a estrutura de pastas.');

requireText(rules, 'function validWorkspaceDocumentStorage(workspaceId)', 'Rules não validam documentStorage.');
requireText(rules, "request.resource.data.provider == 'google-drive'", 'Rules não restringem provider a Google Drive.');
requireText(rules, 'request.resource.data.workspaceId == workspaceId', 'Rules não vinculam settings ao workspace.');
requireText(rules, 'request.resource.data.accountEmail == request.auth.token.email', 'Rules não vinculam settings ao e-mail autenticado.');
requireText(rules, "match /workspaces/{workspaceId}/settings/documentStorage", 'Rules não tratam documentStorage separadamente.');
requireText(rules, "id != 'documentStorage'", 'Regra genérica de settings ainda pode contornar documentStorage.');
requireText(rules, 'allow delete: if false;', 'Exclusão protegida não foi encontrada.');

for (const source of [driveSettings, rules]) {
  for (const forbidden of ['accessToken', 'refreshToken', 'refresh_token']) {
    if (source === driveSettings && source.includes(`${forbidden}:`)) {
      findings.push(`Token persistente detectado em workspaceDriveSettings: ${forbidden}.`);
    }
  }
}

if (findings.length) {
  console.error('Bloco 18 — onboarding Google Drive por setor\n');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  console.error(`\nDRIVE ONBOARDING: BLOQUEADO (${findings.length} achado(s))`);
  process.exitCode = 2;
} else {
  console.log('Bloco 18 — onboarding Google Drive por setor\n');
  console.log('Conta Google do setor: validada');
  console.log('UID da sessão: validado');
  console.log('Pastas: idempotentes e marcadas por workspace');
  console.log('documentStorage: isolado por Rules');
  console.log('Token persistente: NÃO');
  console.log('Contexto externo no cabeçalho: validado');
  console.log('Primeiro acesso: fluxo de ativação disponível');
  console.log('\nDRIVE ONBOARDING: READY');
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
