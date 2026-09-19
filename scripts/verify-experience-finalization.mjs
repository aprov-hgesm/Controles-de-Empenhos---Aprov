#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];

const empenhos = read('features/empenhos/components/EmpenhosView.tsx');
const toast = read('components/layout/ToastNotification.tsx');
const admin = read('components/admin/PlatformAdminView.tsx');
const createSector = read('components/admin/CreateSectorModal.tsx');
const editSector = read('components/admin/EditSectorModal.tsx');
const header = read('components/layout/AppHeader.tsx');
const logo = read('components/layout/chrome/AppShellLogo.tsx');
const branding = read('hooks/usePlatformBranding.ts');
const rules = read('firestore.rules');
const css = read('app/globals.css');
const doc = read('docs/EXPERIENCE_FINAL_VALIDATION_BLOCK_5.md');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

for (const required of [
  'useReducedMotion()',
  'handleEmpenhosSubTabKeyDown',
  'aria-orientation="horizontal"',
  "event.key === 'ArrowRight'",
  "event.key === 'ArrowLeft'",
  "event.key === 'Home'",
  "event.key === 'End'",
  "tabIndex={empenhosSubTab === 'overview' ? 0 : -1}",
  "tabIndex={empenhosSubTab === 'register' ? 0 : -1}",
  "tabIndex={empenhosSubTab === 'classes' ? 0 : -1}",
  'focus-visible:ring-[#00288e]/45',
  'initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}',
]) {
  requireText(empenhos, required, `Empenhos final UX perdeu requisito: ${required}`);
}

for (const forbidden of [
  'fixed inset-0 z-[110]',
  'fixed inset-0 z-[100]',
  'max-h-[75vh] overflow-y-auto',
]) {
  forbidText(empenhos, forbidden, `Empenhos voltou a usar overlay extenso: ${forbidden}`);
}

for (const required of [
  'useReducedMotion()',
  "role={toast.type === 'error' ? 'alert' : 'status'}",
  "aria-live={toast.type === 'error' ? 'assertive' : 'polite'}",
  'aria-label="Fechar notificação"',
  'sm:w-[410px]',
]) {
  requireText(toast, required, `Toast final perdeu requisito: ${required}`);
}

for (const required of [
  '<ToastNotification toast={toast}',
  'useReducedMotion()',
  'role="alertdialog"',
  'Central de Administração EMPROVEX',
]) {
  requireText(admin, required, `Admin final perdeu requisito: ${required}`);
}
forbidText(admin, 'window.confirm(', 'Administração reintroduziu confirmação nativa.');

for (const [source, prefix] of [[createSector, 'create'], [editSector, 'edit']]) {
  requireText(source, 'role="dialog"', `Modal ${prefix} não declara role=dialog.`);
  requireText(source, 'aria-modal="true"', `Modal ${prefix} não declara aria-modal.`);
  requireText(source, `aria-labelledby="${prefix}-sector-title"`, `Modal ${prefix} não associa título.`);
  requireText(source, `aria-describedby="${prefix}-sector-description"`, `Modal ${prefix} não associa descrição.`);
}

requireText(header, '<AppShellLogo customLogo={customLogo} />', 'Header perdeu logo institucional somente leitura.');
for (const forbidden of ['onLogoUpload', 'onRemoveLogo', 'type="file"']) {
  forbidText(header, forbidden, `Header reintroduziu edição do logo: ${forbidden}`);
  forbidText(logo, forbidden, `AppShellLogo reintroduziu edição do logo: ${forbidden}`);
}
forbidText(branding, 'savePlatformLogo', 'Hook de branding reintroduziu escrita.');
requireText(branding, "doc(db, 'settings', 'global')", 'Hook de branding perdeu a fonte global.');

const settingsStart = rules.indexOf('match /settings/global');
const settingsEnd = settingsStart >= 0 ? rules.indexOf('}', settingsStart) : -1;
const settingsBlock = settingsStart >= 0 && settingsEnd > settingsStart
  ? rules.slice(settingsStart, settingsEnd + 1)
  : '';
requireText(settingsBlock, 'allow read: if true;', 'Logo global deixou de ser legível antes do login.');
requireText(settingsBlock, 'allow write: if false;', 'Logo global deixou de estar congelado no runtime.');

for (const required of [
  '@media (prefers-reduced-motion: reduce)',
  '@media (prefers-reduced-transparency: reduce)',
  '@media (prefers-contrast: more)',
  '@media (forced-colors: active)',
  '@media (max-width: 639px)',
  '@media (max-width: 369px)',
]) {
  requireText(css, required, `App Shell perdeu fallback de acessibilidade/responsividade: ${required}`);
}

for (const required of [
  'Movimento reduzido nas subabas de Empenhos',
  'Navegação de teclado nas subabas de Empenhos',
  'Semântica dos modais administrativos',
  'Observação de produção sobre Firestore Rules',
]) {
  requireText(doc, required, `Documento final perdeu seção: ${required}`);
}

requireText(pkg, '"verify:experience-finalization"', 'package.json não registra o guard final.');
requireText(workflow, 'EMPROVEX final experience guard', 'Application CI não executa o guard final.');

if (findings.length > 0) {
  console.error('EMPROVEX FINAL EXPERIENCE VALIDATION: FAIL');
  for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
  process.exitCode = 2;
} else {
  console.log('EMPROVEX FINAL EXPERIENCE VALIDATION: READY');
  console.log('Responsividade: protegida');
  console.log('Teclado: subabas completas');
  console.log('Reduced motion: notificações + admin + empenhos');
  console.log('Diálogos administrativos: semântica explícita');
  console.log('Branding: somente leitura');
  console.log('Regressão funcional: delegada à suíte completa do Application CI');
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
