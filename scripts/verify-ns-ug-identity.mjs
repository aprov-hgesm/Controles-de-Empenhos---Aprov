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

const domain = read('lib/nsIntegrity.ts');
const service = read('lib/nsIntegrityService.ts');
const types = read('lib/types.ts');
const platformIdentity = read('lib/platformIdentity.ts');
const hgesm = read('lib/hgesmWorkspace.ts');
const provisioning = read('lib/sectorProvisioning.ts');
const provisioningServer = read('lib/server/sectorProvisioningAdmin.ts');
const adminStore = read('lib/platformAdminStore.ts');
const createSector = read('components/admin/CreateSectorModal.tsx');
const editSector = read('components/admin/EditSectorModal.tsx');
const workspaceContext = read('lib/workspaceContext.ts');
const operationalPaths = read('lib/operationalPaths.ts');
const sagPlan = read('lib/sagNsPersistencePlan.ts');
const sagPersistence = read('lib/sagNsPersistence.ts');
const sagActions = read('features/relatorios/hooks/useSagNsImportActions.ts');
const sagView = read('features/relatorios/components/SagImportView.tsx');
const sagReconciliation = read('lib/sagNsReconciliation.ts');
const rules = read('firestore.rules');
const security = read('scripts/firestore-multitenancy-security.test.mjs');
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
requireText(platformIdentity, 'normalizeUnitUg', 'Identidade da plataforma não normaliza UG.');
requireText(platformIdentity, 'isValidUnitUg', 'Identidade da plataforma não valida UG.');
requireText(platformIdentity, 'ug?: string', 'Workspace/conta perderam a UG organizacional.');
requireText(hgesm, "HGESM_UG = '160416'", 'HGeSM perdeu a UG fundadora 160416.');
requireText(provisioning, 'ug: string;', 'Cadastro de setor não exige UG.');
requireText(provisioning, 'isValidUnitUg(ug)', 'Cadastro de setor não valida UG.');
requireText(provisioning, 'ug,\n    authorizedEmail', 'Workspace novo não persiste UG.');
requireText(provisioning, 'workspaceId,\n    ug,\n    status', 'Conta nova não persiste UG.');
requireText(provisioningServer, 'platformUgIndex', 'Provisionamento server-side não reserva índice único de UG.');
requireText(provisioningServer, 'platformProvisioningLocks/ug-', 'Provisionamento não protege concorrência por UG.');
requireText(adminStore, 'PLATFORM_UG_INDEX_COLLECTION', 'Admin não protege unicidade da UG.');
requireText(adminStore, 'A UG já vinculada ao setor é imutável', 'Admin não preserva imutabilidade da UG.');
requireText(createSector, 'UG da OM', 'Formulário de cadastro não solicita UG.');
requireText(editSector, 'Cadastros legados sem UG', 'Edição não documenta backfill único de UG.');
requireText(workspaceContext, 'ug: string | null', 'Contexto operacional não carrega UG.');
requireText(operationalPaths, 'ug: context.ug', 'Escopo operacional não recebe UG.');

requireText(service, 'buildStoredNsLockDocumentId', 'Serviço perdeu compatibilidade controlada com lock legado.');
requireText(service, 'const scopeUg = normalizeNsUg(scope.ug)', 'Serviço central não usa UG do usuário/workspace.');
requireText(service, 'proposedUg: scopeUg', 'Serviço central não torna a UG do workspace autoritativa.');
requireText(service, 'nsUg: proposedUg', 'Serviço não persiste UG junto da NS.');
requireText(service, 'nsUg: deleteField()', 'Serviço não remove UG junto da NS.');
requireText(sagPlan, 'proposedUg', 'Plano SAG não carrega UG para a persistência.');
requireText(sagPersistence, 'proposedUg: change.proposedUg', 'Persistência SAG não delega UG ao serviço central.');
requireText(sagReconciliation, 'normalizeSagUg(payload.ug)', 'Conciliação SAG não usa UG validada.');
requireText(sagActions, 'getCurrentOperationalScope', 'Ação SAG não obtém UG do usuário.');
requireText(sagActions, 'payloadUg !== workspaceUg', 'Ação SAG não bloqueia UG externa divergente.');
requireText(sagView, 'workspaceUg: string | null', 'Assistente SAG não recebe UG do workspace.');
requireText(sagView, 'A UG vem automaticamente do cadastro do usuário/setor', 'Assistente SAG não trata UG como identidade automática.');
forbidText(sagView, 'setUg(', 'Assistente SAG voltou a permitir UG digitada pelo operador.');

requireText(manual, 'getCurrentOperationalScope', 'Edição manual não deriva UG do contexto autenticado.');
requireText(manual, 'normalizeNsUg(scope.ug)', 'Edição manual não usa UG da unidade.');
forbidText(manual, 'setTempNSUgValue', 'Edição manual voltou a manter UG digitável.');

requireText(rules, 'workspaceAndAccountUgMatch', 'Rules não vinculam UG de workspace e conta.');
requireText(rules, 'match /platformUgIndex/{ug}', 'Rules não protegem índice de UG.');
requireText(rules, 'workspaceUgMatchesNs(workspaceId, request.resource.data.ug)', 'Rules não vinculam o lock de NS à UG do workspace.');
requireText(rules, 'sagNsLockIdForIdentity(ug, numeroNS)', 'Rules não derivam lock canônico de UG + NS.');
requireText(rules, 'validLegacySagNsLockUpdate', 'Rules perderam compatibilidade controlada de lock legado.');
requireText(security, 'UG diferente da UG vinculada ao workspace', 'Emulator não prova bloqueio de NS com UG externa.');
requireText(security, 'UG vinculada ao workspace', 'Emulator não prova uso da UG organizacional.');
requireText(docs, 'workspaceId + UG emitente + numeroNS', 'Documentação perdeu a identidade canônica.');

if (findings.length) {
  console.error('NS UG IDENTITY BLOCK 7: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('NS UG IDENTITY BLOCK 7: READY');
  console.log('UG da OM no cadastro do usuário/setor: ATIVA');
  console.log('Identidade workspace + UG + NS: ATIVA');
  console.log('UG do operador: AUTOMÁTICA E IMUTÁVEL');
  console.log('SAG divergente: BLOQUEADO');
  console.log('Compatibilidade legada: CONTROLADA');
}
