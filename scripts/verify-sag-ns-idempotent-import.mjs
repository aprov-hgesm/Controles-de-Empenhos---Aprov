#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const plan = read('lib/sagNsPersistencePlan.ts');
const domain = read('lib/nsIntegrity.ts');
const service = read('lib/nsIntegrityService.ts');
const persistence = read('lib/sagNsPersistence.ts');
const hook = read('features/relatorios/hooks/useSagNsImportActions.ts');
const view = [
  read('features/relatorios/components/SagImportView.tsx'),
  read('features/relatorios/components/SagApplyConfirmationDialog.tsx'),
].join('\n');
const reportsView = read('features/relatorios/components/RelatoriosView.tsx');
const page = read('app/page.tsx');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

requireText(plan, 'buildSagNsPersistenceChanges', 'Plano não seleciona somente alterações elegíveis.');
requireText(plan, 'validateSagNsPersistenceSnapshot', 'Revalidação pura de persistência ausente.');
requireText(domain, 'currentNs === proposedNs', 'Idempotência para NS já aplicada ausente.');
requireText(domain, "'stale_invoice_ns'", 'Mudança concorrente da NS não bloqueia o lote.');
requireText(domain, "'ns_reused_in_scope'", 'Reutilização de NS em outra NF não é bloqueada.');
requireText(domain, "'supplier_scope_changed'", 'Mudança de CNPJ do empenho não é bloqueada.');
requireText(domain, "'invoice_identity_changed'", 'Mudança de identidade NF/NE não é bloqueada.');
requireText(domain, "'duplicate_ns_in_batch'", 'Duplicidade de NS no lote não é bloqueada.');

requireText(service, 'runTransaction', 'Serviço central de NS não usa transação Firestore.');
requireText(service, 'transaction.get(', 'Transação central não relê documentos antes da escrita.');
requireText(service, 'validateNsIntegritySnapshot', 'Transação central não executa revalidação final.');
requireText(service, 'transaction.set(', 'Transação central não possui escrita controlada de NS.');
requireText(service, "{ merge: true }", 'Escrita central não está limitada a merge do documento existente.');
requireText(service, 'MAX_NS_INTEGRITY_TRANSACTION_MUTATIONS', 'Limite seguro de alterações por transação ausente.');
requireText(persistence, 'commitNsIntegrityMutations', 'Persistência SAG não delega ao serviço central.');
requireText(persistence, 'alreadyAppliedCount', 'Resultado idempotente não informa NS já aplicadas.');
forbidText(persistence, 'runTransaction(', 'Persistência SAG voltou a abrir transação própria.');

requireText(hook, 'reconcileSagNsPayload', 'Ação SAG não refaz a conciliação antes da transação.');
requireText(hook, 'buildSagNsApplicationFingerprint', 'Ação SAG não compara a prévia confirmada.');
requireText(hook, 'freshFingerprint !== expectedFingerprint', 'Prévia obsoleta não bloqueia a gravação.');
requireText(hook, 'commitSagNsImport', 'Ação SAG não delega para a transação idempotente.');
requireText(hook, 'setInvoices((current)', 'Estado local não é atualizado após commit confirmado.');

requireText(view, 'confirmationFingerprint', 'Confirmação não congela a prévia revisada pelo usuário.');
requireText(view, 'Conferi as NFs, as NEs e as NS propostas', 'Checkbox de confirmação humana ausente.');
requireText(view, 'Confirmar e gravar', 'Ação final de confirmação humana ausente.');
requireText(view, 'aria-modal="true"', 'Diálogo de confirmação não possui semântica modal.');
requireText(view, 'revalidação transacional', 'Interface não explica a revalidação antes do commit.');
requireText(view, 'Nenhuma NS será gravada automaticamente', 'Garantia contra gravação automática foi removida.');
forbidText(view, "from 'firebase/firestore'", 'A interface SAG não deve escrever diretamente no Firestore.');
forbidText(view, 'setDoc(', 'A interface SAG não deve chamar setDoc diretamente.');
forbidText(view, 'updateDoc(', 'A interface SAG não deve chamar updateDoc diretamente.');
forbidText(view, 'addDoc(', 'A interface SAG não deve chamar addDoc diretamente.');

requireText(reportsView, 'onApplySagNsImport={context.handleApplySagNsImport}', 'Relatórios não repassam a ação SAG.');
requireText(page, 'useSagNsImportActions', 'Página principal não inicializa o hook de importação SAG.');
requireText(page, 'handleApplySagNsImport', 'Página principal não injeta a ação SAG no contexto.');

requireText(pkg, '"test:sag-ns-persistence"', 'Testes de persistência SAG não estão registrados.');
requireText(pkg, '"verify:sag-ns-idempotent-import"', 'Guard do Bloco 11 não está registrado.');
requireText(workflow, 'SAG NS persistence tests', 'CI não executa testes de persistência SAG.');
requireText(workflow, 'SAG NS idempotent import guard', 'CI não executa o guard do Bloco 11.');

if (findings.length) {
  console.error('SAG NS IDEMPOTENT IMPORT: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('SAG NS IDEMPOTENT IMPORT: READY');
  console.log('Confirmação humana: OBRIGATÓRIA');
  console.log('Revalidação pré-commit: ATIVA');
  console.log('Transação atômica: ATIVA');
  console.log('Reimportação idempotente: ATIVA');
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) findings.push(message);
}

function forbidText(source, forbidden, message) {
  if (source.includes(forbidden)) findings.push(message);
}
