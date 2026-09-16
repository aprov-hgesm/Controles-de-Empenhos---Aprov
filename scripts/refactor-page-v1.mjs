import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pagePath = path.join(root, 'app', 'page.tsx');
let page = fs.readFileSync(pagePath, 'utf8');

const assertIncludes = (source, needle, label) => {
  if (!source.includes(needle)) {
    throw new Error(`Refatoracao abortada: marcador nao encontrado (${label}).`);
  }
};

const importAnchor = "import { EmpenhoDocumentActions } from '../components/EmpenhoDocumentActions';\n";
const constantsStartMarker = 'const MILITARY_RANKS = [';
const homeMarker = 'export default function Home() {';
const brandingStartMarker = '  // Custom Platform Logo State & Upload Handlers';
const authMarker = '  // Authentication & Loading state';
const syncingMarker = '  const [syncing, setSyncing] = useState(false);\n';

for (const [marker, label] of [
  [importAnchor, 'ancora de imports'],
  [constantsStartMarker, 'inicio das constantes'],
  [homeMarker, 'componente Home'],
  [brandingStartMarker, 'branding'],
  [authMarker, 'estado de autenticacao'],
  [syncingMarker, 'estado syncing'],
]) {
  assertIncludes(page, marker, label);
}

// 1) Extrai constantes e helpers puros que estavam no topo do page.tsx.
const constantsStart = page.indexOf(constantsStartMarker);
const homeStart = page.indexOf(homeMarker);
if (constantsStart < 0 || homeStart <= constantsStart) {
  throw new Error('Refatoracao abortada: intervalo de helpers invalido.');
}

const extractedHelpers = page.slice(constantsStart, homeStart).trim();
const helperModule = `${extractedHelpers
  .replace('const MILITARY_RANKS = [', 'export const MILITARY_RANKS = [')
  .replace('const normalizeSupplier =', 'export const normalizeSupplier =')}\n`;

const helperPath = path.join(root, 'features', 'empenhos', 'domain', 'empenhoHelpers.ts');
fs.mkdirSync(path.dirname(helperPath), { recursive: true });
fs.writeFileSync(helperPath, helperModule, 'utf8');

page = `${page.slice(0, constantsStart)}${page.slice(homeStart)}`;

// 2) Extrai toda a responsabilidade de logotipo/favicons para um hook dedicado,
// preservando a logica existente e apenas injetando email/notificacoes.
const brandingStart = page.indexOf(brandingStartMarker);
const authStart = page.indexOf(authMarker);
if (brandingStart < 0 || authStart <= brandingStart) {
  throw new Error('Refatoracao abortada: intervalo de branding invalido.');
}

let brandingRegion = page.slice(brandingStart, authStart);
brandingRegion = brandingRegion
  .replaceAll('showToast(', 'onNotify(')
  .replaceAll("user?.email || 'aprov1hgesm@gmail.com'", "userEmail || 'aprov1hgesm@gmail.com'")
  .replaceAll('React.ChangeEvent', 'ChangeEvent')
  .replaceAll('React.MouseEvent', 'MouseEvent');

const brandingHook = `'use client';\n\nimport { useEffect, useState } from 'react';\nimport type { ChangeEvent, MouseEvent } from 'react';\nimport { doc, onSnapshot } from 'firebase/firestore';\nimport { db, OperationType, handleFirestoreError } from '../lib/firebase';\nimport { savePlatformLogo } from '../lib/firebaseSync';\n\ntype NotificationType = 'success' | 'error' | 'info';\n\ninterface UsePlatformBrandingOptions {\n  userEmail?: string | null;\n  onNotify: (message: string, type?: NotificationType) => void;\n}\n\nexport function usePlatformBranding({ userEmail, onNotify }: UsePlatformBrandingOptions) {\n${brandingRegion}\n  return {\n    customLogo,\n    handleLogoUpload,\n    handleRemoveLogo,\n  };\n}\n`;

const brandingHookPath = path.join(root, 'hooks', 'usePlatformBranding.ts');
fs.mkdirSync(path.dirname(brandingHookPath), { recursive: true });
fs.writeFileSync(brandingHookPath, brandingHook, 'utf8');

page = `${page.slice(0, brandingStart)}${page.slice(authStart)}`;

// 3) Reintegra os modulos extraidos por imports, mantendo o contrato publico do prompt.
const newImports = `${importAnchor}import { MILITARY_RANKS, normalizeSupplier, PROMPT_EXTRACAO_EMPENHO } from '../features/empenhos/domain/empenhoHelpers';\nimport { usePlatformBranding } from '../hooks/usePlatformBranding';\nexport { PROMPT_EXTRACAO_EMPENHO } from '../features/empenhos/domain/empenhoHelpers';\n`;
page = page.replace(importAnchor, newImports);

const brandingHookCall = `${syncingMarker}\n  const { customLogo, handleLogoUpload, handleRemoveLogo } = usePlatformBranding({\n    userEmail: user?.email,\n    onNotify: showToast,\n  });\n`;
page = page.replace(syncingMarker, brandingHookCall);

// 4) Limpa imports que ficaram exclusivamente no hook, mas apenas quando nao ha
// nenhuma outra referencia no arquivo para evitar remover dependencias legitimas.
const removeNamedImportLineIfUnused = (identifier) => {
  const matches = page.match(new RegExp(`\\b${identifier}\\b`, 'g')) ?? [];
  if (matches.length === 1) {
    page = page.replace(new RegExp(`^\\s{2}${identifier},?\\s*\\n`, 'm'), '');
  }
};

removeNamedImportLineIfUnused('savePlatformLogo');
removeNamedImportLineIfUnused('getPlatformLogo');

// Guardrails: os comportamentos essenciais precisam continuar referenciados.
for (const required of [
  'usePlatformBranding',
  'PROMPT_EXTRACAO_EMPENHO',
  'normalizeSupplier',
  'MILITARY_RANKS',
  'export default function Home()',
]) {
  assertIncludes(page, required, required);
}

fs.writeFileSync(pagePath, page, 'utf8');

const beforeLines = fs.readFileSync(pagePath, 'utf8').split('\n').length;
console.log(`Refatoracao aplicada. page.tsx agora possui ${beforeLines} linhas.`);
console.log('Modulos criados: features/empenhos/domain/empenhoHelpers.ts e hooks/usePlatformBranding.ts');
