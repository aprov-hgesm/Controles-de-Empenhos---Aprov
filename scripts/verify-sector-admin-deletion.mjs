import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    console.error(`SECTOR ADMIN DELETION GUARD: FAIL - ${message}`);
    process.exit(1);
  }
}

const createModal = read('components/admin/CreateSectorModal.tsx');
const editModal = read('components/admin/EditSectorModal.tsx');
const profile = read('lib/sectorProvisioning.ts');
const server = read('lib/server/sectorProvisioningAdmin.ts');
const route = read('app/api/admin/delete-sector/route.ts');
const hook = read('hooks/usePlatformAdminDirectory.ts');
const view = read('components/admin/PlatformAdminView.tsx');
const page = read('app/admin/page.tsx');

assert(!createModal.includes('form.defaultDeliveryLocation'), 'criação ainda expõe local padrão manual');
assert(!createModal.includes('form.defaultResponsibleRole'), 'criação ainda expõe função responsável manual');
assert(!editModal.includes('form.defaultDeliveryLocation'), 'edição ainda expõe local padrão manual');
assert(!editModal.includes('form.defaultResponsibleRole'), 'edição ainda expõe função responsável manual');

assert(
  profile.includes("defaultResponsibleRole: 'Chefe do Aprovisionamento'"),
  'função padrão não está fixada'
);
assert(
  profile.includes('Setor de Aprovisionamento -'),
  'local padrão não é derivado da sigla'
);

assert(route.includes('verifyFounderSession'), 'rota de exclusão não valida fundador');
assert(route.includes('deleteSectorWorkspaceWithAuth'), 'rota não usa exclusão server-side');
assert(server.includes("workspaceId === HGESM_WORKSPACE_ID"), 'workspace fundador não está protegido');
assert(server.includes("email === HGESM_SECTOR_EMAIL"), 'e-mail fundador não está protegido');
assert(server.includes('deleteFirestoreDocumentTree'), 'exclusão não remove árvore do workspace');
assert(server.includes('deleteAuthUser'), 'exclusão não remove identidade Firebase Auth');
assert(server.includes('lockDocumentIds(email, workspaceId)'), 'exclusão não limpa locks residuais');

assert(hook.includes("fetch('/api/admin/delete-sector'"), 'hook não chama API segura de exclusão');
assert(view.includes('setDeleteCandidate(workspace)'), 'ação de exclusão não abre confirmação interna');
assert(view.includes('role="alertdialog"'), 'modal de confirmação de exclusão está ausente');
assert(view.includes('Confirmar exclusão'), 'modal não possui ação explícita de confirmação');
assert(view.includes('Esta operação não pode ser desfeita.'), 'modal não informa irreversibilidade');
assert(view.includes('Excluir usuário'), 'ação de exclusão não está visível');
assert(page.includes('onDeleteSector='), 'página admin não conecta a exclusão');

console.log('SECTOR ADMIN DELETION GUARD: READY');
