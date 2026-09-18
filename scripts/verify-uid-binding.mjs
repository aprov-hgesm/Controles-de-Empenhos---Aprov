#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const access = read('lib/platformAccess.ts');
const rules = read('firestore.rules');
const identity = read('lib/platformIdentity.ts');
const context = read('lib/workspaceContext.ts');

requireText(access, 'runTransaction', 'Vínculo de UID não é transacional.');
requireText(access, 'transaction.get(accountRef)', 'Transação não lê a conta antes do vínculo.');
requireText(access, 'transaction.get(workspaceRef)', 'Transação não valida o workspace antes do vínculo.');
requireText(access, 'account.firebaseUid && account.firebaseUid !== user.uid', 'UID divergente não é bloqueado no cliente.');
requireText(access, 'transaction.update(accountRef', 'Primeiro login não persiste o vínculo na conta.');
requireText(access, 'firebaseUid: boundAccount.firebaseUid', 'firebaseUid não é gravado na transação.');
requireText(access, 'firstLoginAt', 'Primeiro login não registra firstLoginAt.');
requireText(access, 'lastLoginAt', 'Login não registra lastLoginAt.');
requireText(access, 'rememberResolvedWorkspaceContext(user.uid, context)', 'Contexto vinculado não é associado ao UID da sessão.');

requireText(rules, 'function hasBoundUid(account)', 'Rules não distinguem contas pré e pós-vínculo.');
requireText(rules, 'account.email == request.auth.token.email', 'Rules deixaram de exigir correspondência de e-mail.');
requireText(rules, 'hasBoundUid(account)', 'Rules não verificam a presença do UID vinculado.');
requireText(rules, 'account.firebaseUid == request.auth.uid', 'Rules não exigem o UID correto depois do vínculo.');
requireText(rules, '|| !hasBoundUid(account)', 'Rules não preservam o bootstrap controlado do primeiro acesso.');
requireText(rules, 'function boundIdentityMatchesAccount(account)', 'Rules não separam bootstrap de acesso operacional.');
requireText(rules, 'function operationalIdentityMatchesAccount(workspaceId, account)', 'Rules não exigem identidade operacional vinculada.');
requireText(rules, 'boundIdentityMatchesAccount(account)', 'Acesso operacional externo não exige UID já vinculado.');
requireText(rules, "workspaceId == 'hgesm-aprov'", 'Exceção fundadora HGeSM não está explicitamente restrita ao workspace fundador.');
forbidText(
  rules,
  "account.email == request.auth.token.email\n          || (",
  'Rules ainda aceitam e-mail OU UID depois do vínculo.'
);

requireText(rules, 'function isSelfUidBinding(accountId)', 'Rules não possuem operação restrita de primeiro vínculo.');
requireText(rules, '!hasBoundUid(resource.data)', 'Primeiro vínculo pode sobrescrever UID já existente.');
requireText(rules, 'request.resource.data.firebaseUid == request.auth.uid', 'Usuário pode vincular UID diferente da sessão.');
requireText(rules, 'selfAccountImmutableFieldsPreserved(accountId)', 'Vínculo não protege campos imutáveis da conta.');
requireText(rules, 'selfAccountWorkspaceIsActive(accountId)', 'Vínculo não exige workspace ativo e correspondente.');
requireText(rules, "affectedKeys().hasOnly([\n          'firebaseUid',", 'Primeiro vínculo pode alterar campos além dos permitidos.');

requireText(rules, 'function isSelfPreboundFirstLogin(accountId)', 'Rules não tratam o primeiro login de contas já pré-vinculadas.');
requireText(rules, "!('firstLoginAt' in resource.data)", 'Primeiro login pré-vinculado pode sobrescrever auditoria já existente.');
requireText(rules, "affectedKeys().hasOnly([\n          'firstLoginAt',\n          'lastLoginAt',\n          'updatedAt'", 'Primeiro login pré-vinculado pode alterar campos além da auditoria.');
requireText(access, "account.firstLoginAt ? {} : { firstLoginAt }", 'Runtime não inicializa firstLoginAt somente quando ausente.');

requireText(rules, 'function isSelfBoundSessionRefresh(accountId)', 'Rules não controlam refresh de sessão já vinculada.');
requireText(rules, 'resource.data.firebaseUid == request.auth.uid', 'Refresh não exige UID previamente vinculado.');
requireText(rules, "affectedKeys().hasOnly([\n          'lastLoginAt',\n          'updatedAt'", 'Refresh pode alterar campos além de auditoria de login.');

requireText(identity, 'firebaseUid?: string;', 'Contrato PlatformAccount perdeu firebaseUid.');
requireText(context, 'getResolvedWorkspaceContextForSession', 'Writes não conseguem recuperar contexto associado ao UID.');

if (findings.length) {
  console.error('Bloco 16 — vinculação segura de identidade\n');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  console.error(`\nUID BINDING: BLOQUEADO (${findings.length} achado(s))`);
  process.exitCode = 2;
} else {
  console.log('Bloco 16 — vinculação segura de identidade\n');
  console.log('Primeiro login: vincula firebaseUid');
  console.log('Conta e workspace: validados antes do vínculo');
  console.log('UID divergente: bloqueado');
  console.log('Pós-vínculo: e-mail + UID obrigatórios');
  console.log('Autovinculação: somente uma vez');
  console.log('Campos críticos: imutáveis pelo setor');
  console.log('Auditoria: firstLoginAt / lastLoginAt');
  console.log('\nUID BINDING: READY');
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
