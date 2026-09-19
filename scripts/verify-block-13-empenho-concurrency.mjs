#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const root = process.cwd();
const findings = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireText = (source, expected, message) => {
  if (!source.includes(expected)) findings.push(message);
};
const forbidText = (source, forbidden, message) => {
  if (source.includes(forbidden)) findings.push(message);
};

const domain = read('lib/empenhoConcurrency.ts');
const service = read('lib/empenhoConcurrencyService.ts');
const sync = read('lib/firebaseSync.ts');
const empenhoHook = read('features/empenhos/hooks/useEmpenhoActions.ts');
const invoiceHook = read('features/notas-fiscais/hooks/useNotasFiscaisActions.ts');
const nsService = read('lib/nsIntegrityService.ts');
const deletion = read('lib/empenhoDeletionService.ts');
const types = read('lib/types.ts');
const rules = read('firestore.rules');
const security = read('scripts/firestore-multitenancy-security.test.mjs');
const unit = read('scripts/empenho-concurrency.test.mjs');
const docs = read('docs/BLOCK_13_EMPENHO_CONCURRENCY.md');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

for (const expected of [
  'EmpenhoConcurrencyError',
  "'stale_revision'",
  'getEmpenhoRevision',
  'assertEmpenhoRevision',
  'buildNextEmpenho',
  'buildNextEmpenhoRevisionMetadata',
  'alterado por outra sessão',
]) {
  requireText(domain, expected, `Primitiva de concorrência perdeu requisito: ${expected}`);
}

for (const expected of [
  'commitEmpenhoCreate',
  'commitEmpenhoUpdate',
  'runTransaction(db, async (transaction)',
  'transaction.get(ref)',
  'assertEmpenhoRevision(stored, empenho.revision)',
  'transaction.set(ref, { ...next, userId })',
]) {
  requireText(service, expected, `Serviço de concorrência perdeu requisito: ${expected}`);
}

requireText(sync, 'return commitEmpenhoCreate(userId, empenho);', 'firebaseSync não delega criação ao serviço revisionado.');
requireText(sync, 'return commitEmpenhoUpdate(userId, empenho);', 'firebaseSync não delega update ao serviço revisionado.');
forbidText(
  sync,
  "setDoc(operationalDocRef(scope, 'empenhos'",
  'firebaseSync voltou a gravar empenho diretamente com setDoc.'
);

for (const expected of [
  'revision?: number',
  'updatedAt?: string',
  'updatedBy?: string',
]) {
  requireText(types, expected, `Empenho perdeu metadata concorrencial: ${expected}`);
}

for (const expected of [
  'createEmpenho(user.uid, newEmp)',
  'createEmpenho(user.uid, finalEmp)',
  'const committedEmpenho = await saveEmpenho',
  'expectedRevision: currentEmpenho.revision',
  'removeEmpenho(user.uid, id, currentEmpenho.revision)',
]) {
  requireText(empenhoHook, expected, `UI de empenho perdeu protocolo revisionado: ${expected}`);
}

for (const expected of [
  'const result = await commitInvoiceReceiptChanges',
  'result.updatedTargetEmpenho',
  'result.updatedPreviousEmpenho',
  'const result = await commitInvoiceDeletion',
  'const result = await commitAllInvoicesDeletion',
]) {
  requireText(invoiceHook, expected, `UI de NF não reconcilia revisão confirmada: ${expected}`);
}

for (const expected of [
  'assertEmpenhoRevision(storedTargetEmpenho, input.targetEmpenho.revision)',
  'assertEmpenhoRevision(storedEmpenho, input.updatedEmpenho.revision)',
  'committedEmpenhos = affectedEmpenhos.map',
  'assertEmpenhoRevision(currentEmpenho, input.expectedRevision)',
  'buildNextEmpenho(',
  'if (isEmpenhoConcurrencyError(error)) throw error;',
]) {
  requireText(nsService, expected, `Lifecycle de NF/CNPJ perdeu proteção concorrencial: ${expected}`);
}

requireText(deletion, 'expectedRevision?: number', 'Delete não recebe revisão observada.');
requireText(deletion, 'assertEmpenhoRevision(storedEmpenho, expectedRevision)', 'Delete não valida revisão antes do lock.');
requireText(deletion, 'acquireEmpenhoDeletionLock(scope, userId, empenhoId, expectedRevision)', 'Delete não prende lock à revisão observada.');

for (const expected of [
  'function validEmpenhoRevisionCreate',
  'function validEmpenhoRevisionUpdate',
  'data.revision == 1',
  'request.resource.data.revision == currentRevision + 1',
  'request.resource.data.updatedBy == request.auth.uid',
  'validEmpenhoRevisionCreate(request.resource.data)',
  'validEmpenhoRevisionUpdate()',
]) {
  requireText(rules, expected, `Rules perderam requisito concorrencial: ${expected}`);
}

for (const expected of [
  'Empenho novo sem revision não pode ser criado',
  'Empenho novo nasce em revision 1 com ator autenticado',
  'Empenho não aceita repetir a mesma revision em atualização',
  'Empenho não aceita pular revision',
  'Empenho não aceita updatedBy forjado',
  'Empenho legado sem revision migra uma única vez de 0 para 1',
  'Duas sessões com a mesma revision não geram lost update',
]) {
  requireText(security, expected, `Emulator não cobre concorrência: ${expected}`);
}

for (const expected of [
  'documento legado sem revision é tratado como revisão lógica 0',
  'novo empenho recebe revision 1',
  'revisão obsoleta é bloqueada como stale_revision',
]) {
  requireText(unit, expected, `Teste unitário perdeu cenário: ${expected}`);
}

requireText(docs, 'lost updates', 'Documentação não explicita o risco de lost update.');
requireText(docs, '0 → 1', 'Documentação não cobre migração legada.');
requireText(docs, 'não implementa merge automático', 'Documentação não declara política fail-closed.');
requireText(pkg, '"test:empenho-concurrency"', 'package.json não registra teste concorrencial.');
requireText(pkg, '"verify:block-13-empenho-concurrency"', 'package.json não registra guard do Bloco 13.');
requireText(workflow, 'Empenho concurrency domain tests', 'Application CI não executa testes do Bloco 13.');
requireText(workflow, 'Block 13 empenho concurrency guard', 'Application CI não executa guard do Bloco 13.');

function walk(dir) {
  const absolute = resolve(root, dir);
  const entries = [];
  for (const name of readdirSync(absolute)) {
    const path = join(absolute, name);
    const stat = statSync(path);
    if (stat.isDirectory()) entries.push(...walk(relative(root, path)));
    else if (/\.(ts|tsx)$/.test(name)) entries.push(relative(root, path));
  }
  return entries;
}

const allowedDirectWriters = new Set([
  'lib/empenhoConcurrencyService.ts',
  'lib/nsIntegrityService.ts',
  'lib/empenhoDeletionService.ts',
]);

for (const file of ['app', 'components', 'features', 'hooks', 'lib'].flatMap((dir) => walk(dir))) {
  if (allowedDirectWriters.has(file)) continue;
  const source = read(file);
  if (
    /transaction\.set\s*\(\s*operationalDocRef\([^)]*['"]empenhos['"]/.test(source)
    || /setDoc\s*\(\s*operationalDocRef\([^)]*['"]empenhos['"]/.test(source)
  ) {
    findings.push(`Writer direto de empenho fora do serviço revisionado: ${file}`);
  }
}

if (findings.length) {
  console.error('BLOCK 13 EMPENHO CONCURRENCY: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('BLOCK 13 EMPENHO CONCURRENCY: READY');
  console.log('Novos empenhos: REVISION 1');
  console.log('Atualizações: MONOTÔNICAS +1');
  console.log('Legado sem revision: MIGRAÇÃO 0 -> 1');
  console.log('Lost update concorrente: BLOQUEADO');
  console.log('NF/CNPJ/delete: REVISION-AWARE');
}
