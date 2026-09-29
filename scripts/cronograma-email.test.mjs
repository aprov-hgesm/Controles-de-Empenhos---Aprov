#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const gmail = read('lib/googleWorkspaceMail.ts');
const supplier = read('lib/supplierEmailResolver.ts');
const hook = read('features/cronogramas/hooks/useCronogramaActions.ts');
const view = read('features/cronogramas/components/CronogramasView.tsx');
const types = read('lib/types.ts');
const drive = read('lib/googleDriveWorkspace.ts');

test('Gmail usa escopo mínimo de envio e conta configurada no Drive', () => {
  assert.match(gmail, /https:\/\/www\.googleapis\.com\/auth\/gmail\.send/);
  assert.doesNotMatch(gmail, /https:\/\/mail\.google\.com\//);
  assert.match(gmail, /gmail\/v1\/users\/me\/messages\/send/);
  assert.match(gmail, /expectedSenderEmail/);
  assert.match(gmail, /authorizedEmail !== expectedEmail/);
  assert.match(gmail, /A Conta Google selecionada para o Gmail não corresponde/);
  assert.match(drive, /export function getGoogleOAuthClientId/);
});

test('token do Gmail permanece efêmero e autorização é separada do Firebase', () => {
  assert.match(gmail, /let activeGmailRuntime: GmailRuntime \| null = null/);
  assert.match(gmail, /authorizeWorkspaceGmail/);
  assert.doesNotMatch(gmail, /localStorage|sessionStorage|refresh_token|setDoc\(/);
  assert.doesNotMatch(gmail, /reauthenticateWithPopup|GoogleAuthProvider/);
});

test('destinatário prioriza cadastro local e usa pré-cadastro global por CNPJ como fallback', () => {
  const localReturn = supplier.indexOf("source: 'local'");
  const globalLookup = supplier.indexOf('getGlobalSupplierDirectory');
  assert.ok(localReturn > 0);
  assert.ok(globalLookup > localReturn);
  assert.match(supplier, /normalizeSupplierCnpj\(empenho\.supplierCnpj\)/);
  assert.match(supplier, /source: 'global'/);
});

test('cronograma gera PDF em memória, confirma envio e registra auditoria', () => {
  assert.match(hook, /action: 'download' \| 'print' \| 'blob'/);
  assert.match(hook, /doc\.output\('blob'\)/);
  assert.match(hook, /resolveSupplierEmailForEmpenho/);
  assert.match(hook, /loadWorkspaceDriveSettings/);
  assert.match(hook, /authorizeWorkspaceGmail/);
  assert.match(hook, /sendWorkspaceGmailMessage/);
  assert.match(hook, /ultimoEnvioEmail/);
  assert.match(hook, /messageId: sent\.messageId/);
  assert.match(hook, /await saveCronograma\(user\.uid, cronogramaBeforeSend\)/);
  assert.match(hook, /await saveCronograma\(user\.uid, cronogramaAfterSend\)/);
});

test('interface oferece envio e mostra último envio', () => {
  assert.match(view, /Enviar por e-mail/);
  assert.match(view, /handleSendCronogramaEmail/);
  assert.match(view, /isSendingCronogramaEmail/);
  assert.match(view, /Último envio/);
  assert.match(types, /export interface CronogramaEmailEnvio/);
  assert.match(types, /fonteEmailFornecedor: 'local' \| 'global'/);
});
