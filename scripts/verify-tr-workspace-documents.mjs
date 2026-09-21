#!/usr/bin/env node

import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const firebaseSync = read('lib/firebaseSync.ts');
const documentActions = read('features/relatorios/hooks/useDocumentActions.ts');
const cronogramaActions = read('features/cronogramas/hooks/useCronogramaActions.ts');
const page = read('app/page.tsx');
const identity = read('lib/institutionalDocumentProfile.ts');

const counterWrite = firebaseSync.slice(
  firebaseSync.indexOf('transaction.set(counterRef'),
  firebaseSync.indexOf('transaction.set(invoiceRef', firebaseSync.indexOf('transaction.set(counterRef'))
);

assert(counterWrite.includes('currentNumber: nextNumber'), 'Contador do TR precisa persistir currentNumber.');
assert(!counterWrite.includes('updatedAt'), 'Contador do TR não pode alterar updatedAt nas Rules atuais.');
assert(!counterWrite.includes('updatedBy'), 'Contador do TR não pode alterar updatedBy nas Rules atuais.');
assert(!counterWrite.includes("id: 'termoRecebimentoCounter'"), 'Contador do TR não pode materializar id durante update.');

for (const [label, source] of [
  ['Termo/Relatório', documentActions],
  ['Cronograma', cronogramaActions],
]) {
  assert(source.includes('resolveInstitutionalDocumentIdentity'), `${label} deve resolver identidade institucional do workspace.`);
  assert(!source.includes('HOSPITAL GERAL DE SANTA MARIA'), `${label} não pode manter nome fixo do HGeSM.`);
  assert(!source.includes('Hospital Geral de Santa Maria'), `${label} não pode manter nome fixo do HGeSM.`);
  assert(!source.includes('HGeSM'), `${label} não pode manter sigla fixa do workspace fundador.`);
}

assert(documentActions.includes('Boletim Interno do ${organizationShortName}'), 'TR deve usar a sigla do workspace no Boletim Interno.');
assert(documentActions.includes('material do ${organizationName}'), 'TR deve usar o nome da OM do workspace.');
assert(cronogramaActions.includes('defaultDeliveryLocation'), 'Cronograma deve usar local de entrega do workspace.');
assert(cronogramaActions.includes('defaultResponsibleRole'), 'Cronograma deve usar cargo padrão do workspace.');

const profileWiringCount = (page.match(/institutionalProfile: workspaceContext\.status === 'sector'/g) || []).length;
assert(profileWiringCount >= 2, 'Página operacional deve repassar perfil institucional aos geradores de documentos.');

assert(identity.includes("'Organização Militar'"), 'Fallback documental deve ser institucionalmente neutro.');
assert(!identity.includes('HGeSM'), 'Helper de identidade não pode herdar o tenant fundador.');

console.log('TR counter and workspace document identity guard: OK');
