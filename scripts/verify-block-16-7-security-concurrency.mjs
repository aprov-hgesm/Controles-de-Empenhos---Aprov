import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function requireText(content, needle, message) {
  if (!content.includes(needle)) throw new Error(message);
}

function forbidText(content, needle, message) {
  if (content.includes(needle)) throw new Error(message);
}

const founderAuth = read('lib/server/firebaseFounderAuth.ts');
const lease = read('lib/platformSessionLease.ts');
const adminSessions = read('lib/platformAdminSessions.ts');
const usageHook = read('hooks/usePlatformAdminUsage.ts');
const globalUsageHook = read('hooks/usePlatformAdminGlobalUsage.ts');
const alertPolicyHook = read('hooks/usePlatformAdminUsageAlertPolicy.ts');
const securityTests = read('scripts/firestore-multitenancy-security.test.mjs');
const rules = read('firestore.rules');
const docs = read('docs/BLOCK_16_7_SECURITY_CONCURRENCY_HARDENING.md');

requireText(founderAuth, 'FOUNDER_AUTH_PROVIDER', 'API founder-only deve reutilizar o provider fundador canônico.');
requireText(founderAuth, 'sign_in_provider', 'API founder-only deve validar sign_in_provider.');
requireText(founderAuth, 'A conta fundadora exige autenticação Google.', 'Falha explícita de provider founder-only ausente.');

requireText(lease, 'if (revocationSnapshot.exists())', 'Aquisição deve rejeitar qualquer tombstone existente.');
forbidText(lease, 'stillRevoked', 'Tombstone não pode voltar a autorizar o mesmo sessionId por expiração.');
forbidText(lease, 'activeRevocation', 'Listener não pode ignorar tombstone existente por expiração.');
requireText(lease, 'const attemptNowMs = Date.now();', 'Retry transacional deve recalcular o relógio.');
requireText(lease, 'renewedAtMs: attemptNowMs', 'Resultado do lease deve conservar o relógio da tentativa vencedora.');

for (const needle of [
  "String(current.slotId || '') !== session.slotId",
  "normalizePlatformEmail(String(current.accountEmail || '')) !== session.accountEmail",
  "String(current.browserInstanceId || '') !== session.browserInstanceId",
]) {
  requireText(adminSessions, needle, 'Encerramento remoto precisa validar a identidade completa do slot.');
}

for (const [name, content] of [
  ['telemetria UG', usageHook],
  ['Cloud Monitoring', globalUsageHook],
  ['política de alertas', alertPolicyHook],
]) {
  requireText(content, 'useRef', `${name}: sequência de refresh ausente.`);
  requireText(content, 'requestSequence', `${name}: guard contra resposta fora de ordem ausente.`);
  requireText(content, 'requestSequence.current !== requestId', `${name}: resposta superseded ainda pode atualizar estado.`);
}

requireText(
  securityTests,
  'Tombstone existente é imutável e não pode ser reciclado pelo administrador',
  'Teste multi-tenant da imutabilidade do tombstone ausente.'
);

for (const invariant of [
  "isGoogleFounderSession()",
  "slotId in ['slot-1', 'slot-2']",
  "match /workspaces/{workspaceId}/sessionRevocations/{sessionId}",
  "allow update, delete: if false;",
  "match /workspaces/{workspaceId}/usageEstimates/{dayKey}",
]) {
  requireText(rules, invariant, `Invariante de Firestore Rules ausente: ${invariant}`);
}

requireText(docs, 'não altera `firestore.rules`', 'Documentação deve registrar Rules inalteradas.');
requireText(docs, 'nenhum deploy manual ou de produção na Vercel', 'Documentação deve preservar bloqueio de deploy.');
requireText(docs, 'Google Drive permanece exclusivo para documentos', 'Contrato documental precisa permanecer explícito.');

console.log('Bloco 16.7: hardening de segurança e concorrência verificado.');
