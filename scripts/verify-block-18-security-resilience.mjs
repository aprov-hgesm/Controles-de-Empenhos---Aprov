#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const requireText = (source, needle, message) => {
  if (!source.includes(needle)) failures.push(message);
};
const forbidText = (source, needle, message) => {
  if (source.includes(needle)) failures.push(message);
};

const requestSecurity = read('lib/server/requestSecurity.ts');
const pdfSecurity = read('lib/pdfSecurity.ts');
const driveFiles = read('lib/googleDriveFiles.ts');
const empenhoDocuments = read('lib/empenhoDocuments.ts');
const invoiceDocuments = read('lib/invoiceDocuments.ts');
const nextConfig = read('next.config.ts');
const pkg = JSON.parse(read('package.json'));
const workflow = read('.github/workflows/application-ci.yml');
const docs = read('docs/BLOCK_18_SECURITY_RESILIENCE.md');
const audit = JSON.parse(read('ops/block-18-final-audit.json'));
const provisioning = read('lib/server/sectorProvisioningAdmin.ts');
const sagDocs = read('docs/SAG_NS_IDEMPOTENT_IMPORT.md');

const mutationRoutes = [
  'app/api/admin/provision-sector/route.ts',
  'app/api/admin/delete-sector/route.ts',
  'app/api/admin/reset-sector-password/route.ts',
];
const readRoutes = [
  'app/api/admin/firebase-global-usage/route.ts',
  'app/api/admin/usage-alert-policy/route.ts',
];

for (const marker of [
  'ADMIN_API_JSON_MAX_BYTES = 32 * 1024',
  'SECURITY_BURST_BUCKET_LIMIT = 512',
  'createRequestSecurityContext',
  'enforcePreAuthBurstLimit',
  'enforceAuthenticatedAdminBurstLimit',
  'readBoundedJsonRequest',
  'assertAdminMutationEnabled',
  'EMPROVEX_SECURITY_EVENT',
  "'X-Request-Id'",
  "'Retry-After'",
]) {
  requireText(requestSecurity, marker, `Request security perdeu requisito: ${marker}`);
}

for (const routePath of mutationRoutes) {
  const route = read(routePath);
  for (const marker of [
    'createRequestSecurityContext',
    'enforcePreAuthBurstLimit',
    'enforceAuthenticatedAdminBurstLimit',
    'assertAdminMutationEnabled',
    'readBoundedJsonRequest',
    'securityResponseHeaders',
  ]) {
    requireText(route, marker, `${routePath} não aplica: ${marker}`);
  }
}

for (const routePath of readRoutes) {
  const route = read(routePath);
  for (const marker of [
    'createRequestSecurityContext',
    'enforcePreAuthBurstLimit',
    'enforceAuthenticatedAdminBurstLimit',
    'securityResponseHeaders',
  ]) {
    requireText(route, marker, `${routePath} não aplica: ${marker}`);
  }
}

for (const marker of [
  'MAX_WORKSPACE_PDF_UPLOAD_BYTES = 10 * 1024 * 1024',
  "blob.type !== 'application/pdf'",
  "'%PDF-'",
]) {
  requireText(pdfSecurity, marker, `Defesa PDF perdeu requisito: ${marker}`);
}

requireText(driveFiles, 'assertWorkspacePdfIsSafeForStorage(blob)', 'Google Drive não revalida PDF antes do upload.');
requireText(driveFiles, 'assertWorkspacePdfIsSafeForStorage(normalized)', 'Google Drive não revalida PDF recuperado.');
requireText(driveFiles, "crypto.subtle.digest('SHA-256'", 'SHA-256 documental foi removido.');
requireText(empenhoDocuments, 'assertWorkspacePdfIsSafeForStorage(file', 'NE não usa o validador PDF central.');
requireText(invoiceDocuments, 'assertWorkspacePdfIsSafeForStorage(file', 'NF não usa o validador PDF central.');

for (const marker of [
  'poweredByHeader: false',
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "X-DNS-Prefetch-Control",
  "X-Permitted-Cross-Domain-Policies",
]) {
  requireText(nextConfig, marker, `Header defensivo ausente: ${marker}`);
}

forbidText(
  nextConfig,
  "key: 'Content-Security-Policy'",
  'CSP enforcement não deve ser ligado sem inventário/observação de Firebase, GIS, Drive e blob URLs.'
);

requireText(provisioning, 'acquireProvisioningLocks', 'Locks de provisionamento existentes foram perdidos.');
requireText(provisioning, 'rollback', 'Provisionamento perdeu contrato de rollback.');
requireText(sagDocs, '## Idempotência', 'Contrato idempotente SAG/NS não está documentado.');
requireText(sagDocs, 'runTransaction', 'Idempotência SAG/NS perdeu transação.');

if (!existsSync(resolve(root, '.github/dependabot.yml'))) {
  failures.push('Dependabot não foi configurado.');
}

const forbiddenDependencies = ['@upstash/redis', 'redis', 'ioredis', 'clamav.js'];
for (const dependency of forbiddenDependencies) {
  if (pkg.dependencies?.[dependency] || pkg.devDependencies?.[dependency]) {
    failures.push(`Infraestrutura complexa não justificada adicionada: ${dependency}`);
  }
}

if (audit.productionDeploy !== false) failures.push('Bloco 18 não pode afirmar deploy de produção.');
if (audit.operatorExperienceContract?.newRequiredFields !== 0) failures.push('Bloco 18 adicionou campo obrigatório.');
if (audit.operatorExperienceContract?.newRequiredConfirmations !== 0) failures.push('Bloco 18 adicionou confirmação obrigatória.');
if (audit.operatorExperienceContract?.captchaRequired !== false) failures.push('Bloco 18 não deve adicionar CAPTCHA.');
if (audit.controls?.distributedRateLimiterAdded !== false) failures.push('Auditoria afirma rate limit distribuído não implementado.');
if (audit.controls?.heuristicAntivirusAdded !== false) failures.push('Auditoria não deve chamar heurística local de antivírus.');

for (const marker of [
  'Segurança deve ficar no backend',
  'não é descrito como rate limit distribuído',
  'não inventa um antivírus por heurística',
  'CSP em modo enforcement não foi ativada',
  '0** CAPTCHAs',
  'Nenhum deploy de produção',
]) {
  requireText(docs, marker, `Documentação 18 perdeu requisito: ${marker}`);
}

if (!pkg.scripts?.['verify:block-18-security-resilience']) {
  failures.push('package.json não registra o guard consolidado do Bloco 18.');
}
requireText(workflow, 'Block 18 security and resilience guard', 'Application CI não executa guard do Bloco 18.');
requireText(workflow, 'Block 18 Final Release Gate', 'Application CI não possui release gate do Bloco 18.');

if (failures.length) {
  console.error('BLOCK 18 SECURITY/RESILIENCE: FAIL');
  failures.forEach((failure) => console.error(`  [BLOCK] ${failure}`));
  process.exitCode = 2;
} else {
  console.log('BLOCK 18 SECURITY/RESILIENCE: READY');
  console.log('API hardening: SILENCIOSO');
  console.log('Burst protection: LOCAL / BEST-EFFORT');
  console.log('Tenant/Auth authorities: PRESERVADAS');
  console.log('PDF defense: EM PROFUNDIDADE');
  console.log('Kill switches: SERVER-SIDE');
  console.log('CAPTCHA / burocracia nova: ZERO');
  console.log('Infra distribuída nova: ZERO');
}
