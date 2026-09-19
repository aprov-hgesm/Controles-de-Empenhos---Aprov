#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const contractText = read('ops/ns-integrity-contract.json');
const contract = JSON.parse(contractText);
const doc = read('docs/NS_INTEGRITY_CONTRACT.md');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

if (contract.contractVersion !== 'emprovex_ns_integrity_v1') {
  findings.push('Versão congelada do contrato de integridade NS foi alterada sem migração explícita.');
}
if (contract.status !== 'frozen') {
  findings.push('Contrato de integridade NS deixou de estar congelado.');
}
if (contract.runtimeBehaviorChange !== false) {
  findings.push('Bloco 0 deve continuar declarando ausência de mudança operacional.');
}

const targetIdentity = JSON.stringify(contract.canonicalIdentity?.targetDimensions || []);
if (targetIdentity !== JSON.stringify(['workspaceId', 'ug', 'numeroNS'])) {
  findings.push('Identidade canônica futura da NS deve permanecer workspaceId + ug + numeroNS.');
}

const requiredInvariantIds = Array.from(
  { length: 11 },
  (_, index) => `NS-${String(index + 1).padStart(3, '0')}`
);
const declaredInvariantIds = new Set(contract.invariants?.map((item) => item.id) || []);
for (const id of requiredInvariantIds) {
  if (!declaredInvariantIds.has(id)) findings.push(`Invariante obrigatório ausente: ${id}`);
  if (!doc.includes(id)) findings.push(`Documentação não apresenta o invariante ${id}`);
}

for (const text of [
  'workspaceId + UG emitente + numeroNS',
  'Gravar `numeroNS` diretamente sem serviço de integridade',
  'Apagar lock sem transição do proprietário',
  'Lacunas reconhecidas no estado atual',
  'Não objetivos do Bloco 0',
]) {
  if (!doc.includes(text)) findings.push(`Documento do contrato perdeu trecho obrigatório: ${text}`);
}

if (!pkg.includes('"test:ns-integrity-contract"')) {
  findings.push('Teste do contrato de integridade NS não está registrado no package.json.');
}
if (!pkg.includes('"verify:ns-integrity-contract"')) {
  findings.push('Guard do contrato de integridade NS não está registrado no package.json.');
}
if (!workflow.includes('NS integrity contract tests')) {
  findings.push('CI não executa os testes do contrato de integridade NS.');
}
if (!workflow.includes('NS integrity contract guard')) {
  findings.push('CI não executa o guard do contrato de integridade NS.');
}

if (findings.length) {
  console.error('NS INTEGRITY CONTRACT: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('NS INTEGRITY CONTRACT: FROZEN');
  console.log('Versão: emprovex_ns_integrity_v1');
  console.log('Identidade alvo: workspace + UG + NS');
  console.log('Runtime alterado pelo Bloco 0: NÃO');
  console.log('Invariantes protegidos: 11');
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}
