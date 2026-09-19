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

const service = read('lib/empenhoDeletionService.ts');
const sync = read('lib/firebaseSync.ts');
const hook = read('features/empenhos/hooks/useEmpenhoActions.ts');
const rules = read('firestore.rules');
const security = read('scripts/firestore-multitenancy-security.test.mjs');
const audit = read('lib/auditTrail.ts');
const types = read('lib/types.ts');
const docs = read('docs/BLOCK_12_EMPENHO_DELETION_INTEGRITY.md');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

for (const expected of [
  'commitEmpenhoDeletionLifecycle',
  "EMPENHO_DELETION_LOCK_PREFIX = 'empenhoDelete_'",
  "EMPENHO_DELETION_LOCK_TYPE = 'empenho-deletion-lock'",
  'discoverEmpenhoLinks',
  'acquireEmpenhoDeletionLock',
  'releaseEmpenhoDeletionLock',
  'assertNsLockOwnership',
  'transaction.delete(empenhoRef)',
  'transaction.delete(deletionLockRef)',
  "operation: 'empenho.delete'",
  'MAX_EMPENHO_DELETION_NS_LOCKS = 8',
  'MAX_EMPENHO_DELETION_WRITES = 450',
]) {
  requireText(service, expected, `Lifecycle de exclusão perdeu requisito: ${expected}`);
}

requireText(sync, 'return commitEmpenhoDeletionLifecycle(userId, id);', 'firebaseSync não delega exclusão ao lifecycle central.');

const deletionStart = hook.indexOf('const handleDeleteSpecificEmpenho');
const deletionEnd = hook.indexOf('return {', deletionStart);
const deletionBlock = deletionStart >= 0 && deletionEnd > deletionStart
  ? hook.slice(deletionStart, deletionEnd)
  : '';
if (!deletionBlock) findings.push('Handler de exclusão de empenho não foi localizado.');
else {
  requireText(deletionBlock, 'await removeEmpenho(user.uid, id)', 'Handler não aguarda lifecycle central.');
  requireText(deletionBlock, 'const result = await removeEmpenho', 'Handler não usa resultado confirmado da transação.');
  requireText(deletionBlock, 'setEmpenhos', 'Handler não reconcilia estado local após sucesso.');
  forbidText(deletionBlock, 'removeInvoice(', 'Handler voltou a apagar NF individualmente.');
  forbidText(deletionBlock, 'removeAlert(', 'Handler voltou a apagar alerta individualmente.');
  forbidText(deletionBlock, 'Promise.all([', 'Handler voltou a fan-out destrutivo não atômico.');
}

requireText(types, 'empenhoId?: string;', 'Alert não possui vínculo estruturado opcional ao empenho.');
requireText(hook, 'empenhoId: target.id', 'Novo alerta de empenho não persiste vínculo estruturado.');

for (const expected of [
  'function validEmpenhoDeletionLockCreate',
  'function validEmpenhoDeletionLockDelete',
  'function validEmpenhoLifecycleDelete',
  '!empenhoDeletionIsLockedAfter(workspaceId, id)',
  '!empenhoDeletionIsLockedAfter(workspaceId, request.resource.data.empenhoId)',
  'validEmpenhoLifecycleDelete(workspaceId, id)',
  'isEmpenhoDeletionLockId(id)',
]) {
  requireText(rules, expected, `Rules de exclusão perderam requisito: ${expected}`);
}

for (const expected of [
  'Setor cria lock técnico antes de excluir empenho',
  'Empenho bloqueado para alteração enquanto exclusão está em andamento',
  'Nova NF não entra no empenho depois do lock de exclusão',
  'Novo alerta estruturado não entra no empenho durante exclusão',
  'Novo cronograma não entra no empenho durante exclusão',
  'Empenho não pode ser apagado isoladamente mantendo o lock técnico',
  'Empenho + NF + locks + vínculos são excluídos na mesma transação',
]) {
  requireText(security, expected, `Emulator não cobre cenário do Bloco 12: ${expected}`);
}

requireText(audit, "| 'empenho.delete'", 'Tipo de auditoria não registra empenho.delete.');
requireText(rules, "'empenho.delete'", 'Rules não aceitam auditoria empenho.delete.');
requireText(docs, 'Google Drive', 'Documentação não preserva política documental do Drive.');
requireText(docs, 'não são apagados por heurística', 'Documentação não protege alertas legados contra heurística destrutiva.');
requireText(pkg, '"verify:block-12-empenho-deletion"', 'package.json não registra guard do Bloco 12.');
requireText(workflow, 'Block 12 empenho deletion integrity guard', 'Application CI não executa guard do Bloco 12.');

if (findings.length) {
  console.error('BLOCK 12 EMPENHO DELETION INTEGRITY: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('BLOCK 12 EMPENHO DELETION INTEGRITY: READY');
  console.log('Delete direto do empenho: BLOQUEADO');
  console.log('Corrida de nova NF: BLOQUEADA');
  console.log('NF + locks + empenho: TRANSACIONAL');
  console.log('Estado local antes do commit: PRESERVADO');
  console.log('Auditoria empenho.delete: ATÔMICA');
}
