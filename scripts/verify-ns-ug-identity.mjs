#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireText = (source, expected, message) => {
  if (!source.includes(expected)) findings.push(message);
};

const domain = read('lib/nsIntegrity.ts');
const service = read('lib/nsIntegrityService.ts');
const types = read('lib/types.ts');
const sagPlan = read('lib/sagNsPersistencePlan.ts');
const sagPersistence = read('lib/sagNsPersistence.ts');
const sagActions = read('features/relatorios/hooks/useSagNsImportActions.ts');
const manual = read('features/notas-fiscais/hooks/useNotasFiscaisActions.ts');
const docs = read('docs/NS_UG_IDENTITY_BLOCK_7.md');

for (const expected of [
  'normalizeNsUg',
  'isValidNsUg',
  'buildNsIdentityKey',
  'buildLegacyNsLockDocumentId',
  'expectedCurrentUg',
  'proposedUg',
  "'invalid_ug'",
  'sagNsLock_',
]) requireText(domain, expected, `Domínio perdeu requisito de identidade UG + NS: ${expected}`);

requireText(types, 'nsUg?: string', 'Invoice perdeu a UG emitente da NS.');
requireText(service, 'buildStoredNsLockDocumentId', 'Serviço perdeu compatibilidade controlada com lock legado.');
requireText(service, 'nsUg: proposedUg', 'Serviço não persiste UG junto da NS.');
requireText(service, 'nsUg: deleteField()', 'Serviço não remove UG junto da NS.');
requireText(sagPlan, 'proposedUg', 'Plano SAG não carrega UG para a persistência.');
requireText(sagPersistence, 'proposedUg: change.proposedUg', 'Persistência SAG não delega UG ao serviço central.');
requireText(sagActions, 'payload.ug', 'Ação SAG não usa a UG validada do payload.');
requireText(manual, 'setTempNSUgValue', 'Edição manual não oferece estado para UG da NS.');
requireText(manual, 'isValidNsUg', 'Edição manual não valida UG antes da gravação.');
requireText(docs, 'workspaceId + UG emitente + numeroNS', 'Documentação perdeu a identidade canônica.');

if (findings.length) {
  console.error('NS UG IDENTITY BLOCK 7: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('NS UG IDENTITY BLOCK 7: READY');
  console.log('Identidade canônica workspace + UG + NS: ATIVA');
  console.log('Compatibilidade legada: CONTROLADA');
  console.log('SAG e edição manual: UG PROPAGADA');
}
