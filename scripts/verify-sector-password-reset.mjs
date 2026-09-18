import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    console.error(`SECTOR PASSWORD RESET GUARD: FAIL - ${message}`);
    process.exit(1);
  }
}

const server = read('lib/server/sectorProvisioningAdmin.ts');
const route = read('app/api/admin/reset-sector-password/route.ts');
const hook = read('hooks/usePlatformAdminDirectory.ts');
const modal = read('components/admin/EditSectorModal.tsx');
const operationalData = read('hooks/useOperationalData.ts');

assert(server.includes('resetSectorPasswordWithAuth'), 'reset server-side não existe');
assert(server.includes('workspaceId === HGESM_WORKSPACE_ID'), 'fundador não está protegido');
assert(server.includes('boundUid && boundUid !== authUser.localId'), 'reset não valida UID vinculado');
assert(server.includes('emailVerified: true'), 'reset não preserva e-mail verificado');
assert(route.includes('verifyFounderSession'), 'rota de reset não valida fundador');
assert(hook.includes("fetch('/api/admin/reset-sector-password'"), 'hook não usa API segura de reset');
assert(modal.includes('Definir / redefinir senha'), 'edição do setor não expõe reset administrativo');
assert(modal.includes('A senha atual nunca é exibida nem armazenada no Firestore.'), 'UI não explicita proteção da senha');
assert(operationalData.includes('firebaseCredentialAccepted'), 'login não separa autenticação de autorização');
assert(operationalData.includes('O Firebase rejeitou o e-mail ou a senha informados.'), 'login não distingue rejeição de credencial');
assert(operationalData.includes('A credencial foi aceita pelo Firebase'), 'login não distingue falha de workspace');

console.log('SECTOR PASSWORD RESET GUARD: READY');
