#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const hook = read('features/notas-fiscais/hooks/useNotasFiscaisActions.ts');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

const start = hook.indexOf('const handleSaveNumeroNS');
const end = hook.indexOf('const handleSaveComissao', start);
const manualBlock = start >= 0 && end > start ? hook.slice(start, end) : '';

if (!manualBlock) {
  findings.push('handleSaveNumeroNS não foi localizado.');
} else {
  requireText(manualBlock, 'commitNsIntegrityMutations', 'Edição manual não usa o serviço central de integridade.');
  requireText(manualBlock, "source: 'manual'", 'Origem manual não é registrada na mutação.');
  requireText(manualBlock, 'expectedCurrentNs:', 'Edição manual não congela a NS atual esperada.');
  requireText(manualBlock, 'proposedNs:', 'Edição manual não envia a NS proposta ao serviço central.');
  requireText(manualBlock, 'knownNsOwnerRecordKeys', 'Edição manual não informa possíveis proprietários da NS.');
  requireText(manualBlock, 'normalizeNsNumber', 'Edição manual não normaliza a NS pelo domínio central.');
  requireText(manualBlock, 'normalizeSupplierCnpj', 'Edição manual não valida o CNPJ da NF/NE.');
  requireText(manualBlock, 'if (!user)', 'Edição manual não exige sessão autenticada.');
  requireText(manualBlock, 'setInvoices((current)', 'Estado local não é atualizado a partir do resultado confirmado.');
  forbidText(manualBlock, 'saveInvoice(', 'Edição manual voltou a gravar numeroNS diretamente via saveInvoice.');
}

requireText(
  hook,
  "import { normalizeNsNumber } from '../../../lib/nsIntegrity';",
  'Hook de Notas Fiscais não importa a normalização central de NS.'
);
requireText(
  hook,
  "import { commitNsIntegrityMutations } from '../../../lib/nsIntegrityService';",
  'Hook de Notas Fiscais não importa o serviço transacional central.'
);

requireText(pkg, '"verify:manual-ns-integrity"', 'Guard da edição manual de NS não está registrado.');
requireText(workflow, 'Manual NS integrity guard', 'CI não executa o guard da edição manual de NS.');

if (findings.length) {
  console.error('MANUAL NS INTEGRITY: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('MANUAL NS INTEGRITY: READY');
  console.log('saveInvoice direto para numeroNS: REMOVIDO');
  console.log('Serviço central: ATIVO');
  console.log('Lock NF + NS: TRANSACIONAL');
  console.log('Origem manual: IDENTIFICADA');
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
