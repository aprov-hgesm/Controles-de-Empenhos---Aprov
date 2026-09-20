#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const hook = read('hooks/usePlatformBranding.ts');
const logo = read('components/layout/chrome/AppShellLogo.tsx');
const header = read('components/layout/AppHeader.tsx');
const page = read('app/page.tsx');
const adminPage = read('app/admin/page.tsx');
const sync = read('lib/firebaseSync.ts');
const rules = read('firestore.rules');
const css = read('app/globals.css');
const contract = read('ops/brand-identity-contract.json');
const doc = read('docs/BRAND_LOGO_LOCK_BLOCK_4.md');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

for (const required of [
  "doc(db, 'settings', 'global')",
  'getDoc(',
  'setCustomLogo',
  'return { customLogo }',
]) {
  requireText(hook, required, `Branding somente leitura perdeu requisito: ${required}`);
}

forbidText(hook, 'onSnapshot(', 'Branding voltou a manter listener realtime permanente.');

for (const forbidden of [
  'savePlatformLogo',
  'handleLogoUpload',
  'handleRemoveLogo',
  'ChangeEvent',
  'MouseEvent',
  "localStorage.getItem('emprovex_custom_logo')",
  "localStorage.getItem('emprovium_custom_logo')",
]) {
  forbidText(hook, forbidden, `Hook reintroduziu mutação/cache autoritativo: ${forbidden}`);
}

for (const forbidden of [
  'type="file"',
  'Camera',
  'onLogoUpload',
  'onRemoveLogo',
  'Restaurar logotipo',
  'alterar o logotipo',
]) {
  forbidText(logo, forbidden, `AppShellLogo voltou a ser editável: ${forbidden}`);
}

requireText(logo, 'Logotipo institucional EMPROVEX', 'Logo perdeu identificação institucional.');
requireText(header, '<AppShellLogo customLogo={customLogo} />', 'Header não monta o logo institucional somente leitura.');

for (const forbidden of ['onLogoUpload', 'onRemoveLogo', 'ChangeEvent', 'MouseEvent']) {
  forbidText(header, forbidden, `Contrato do header voltou a transportar mutação do logo: ${forbidden}`);
}

requireText(page, 'const { customLogo } = usePlatformBranding();', 'Aplicação principal não usa branding somente leitura.');
requireText(adminPage, 'const { customLogo } = usePlatformBranding();', 'Administração não usa branding somente leitura.');

for (const forbidden of [
  'handleLogoUpload',
  'handleRemoveLogo',
  'savePlatformLogo',
  'getPlatformLogo',
]) {
  forbidText(page, forbidden, `Página principal reintroduziu mutação do logo: ${forbidden}`);
  forbidText(sync, forbidden, `firebaseSync reintroduziu API de branding mutável: ${forbidden}`);
}

const settingsStart = rules.indexOf('match /settings/global');
const settingsEnd = settingsStart >= 0 ? rules.indexOf('}', settingsStart) : -1;
const settingsBlock = settingsStart >= 0 && settingsEnd > settingsStart
  ? rules.slice(settingsStart, settingsEnd + 1)
  : '';

requireText(settingsBlock, 'allow read: if true;', 'settings/global deixou de ser legível antes do login.');
requireText(settingsBlock, 'allow write: if false;', 'settings/global não está bloqueado contra escrita cliente.');
forbidText(settingsBlock, 'isHgesmFounder()', 'Conta fundadora ainda possui exceção de escrita no branding.');

for (const forbidden of [
  '.emprovex-header-logo-core__upload',
  '.emprovex-header-logo-core__remove',
  'cursor: pointer;',
]) {
  forbidText(
    css.slice(
      Math.max(0, css.indexOf('.emprovex-header-logo-core__surface') - 200),
      css.indexOf('.emprovex-header-brand-copy') + 100
    ),
    forbidden,
    `CSS do núcleo da marca ainda sugere edição: ${forbidden}`
  );
}

for (const id of ['BRAND-002', 'BRAND-003', 'BRAND-010', 'GAP-BRAND-003', 'GAP-BRAND-004']) {
  requireText(contract, id, `Contrato congelado não contém ${id}.`);
  requireText(doc, id, `Documento do Bloco 4 não referencia ${id}.`);
}

requireText(pkg, '"test:brand-logo-lock"', 'package.json não registra o teste de bloqueio da marca.');
requireText(pkg, '"verify:brand-logo-lock"', 'package.json não registra o guard de bloqueio da marca.');
requireText(workflow, 'EMPROVEX brand logo lock security test', 'Application CI não executa o teste de segurança do logo.');
requireText(workflow, 'EMPROVEX brand logo lock guard', 'Application CI não executa o guard do logo.');

if (findings.length > 0) {
  console.error('EMPROVEX BRAND LOGO LOCK: FAIL');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  process.exitCode = 2;
} else {
  console.log('EMPROVEX BRAND LOGO LOCK: READY');
  console.log('Fonte de verdade: configuração estática ou settings/global.logo somente leitura');
  console.log('Leitura pré-login: habilitada');
  console.log('Escrita cliente: bloqueada');
  console.log('Upload/remoção no runtime: removidos');
  console.log('Cache local autoritativo: removido');
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
