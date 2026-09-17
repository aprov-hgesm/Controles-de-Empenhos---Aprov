#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeRoots = ['app', 'components', 'features', 'hooks', 'lib'];
const operationalCollections = ['empenhos', 'alerts', 'invoices', 'comissoes', 'cronogramas'];
const findings = [];

main();

function main() {
  console.log('Auditoria de compatibilidade legada — EMPROVEX Bloco 13\n');

  auditRuntimeSource();
  auditWorkspaceContext();
  auditFirestoreRules();

  if (findings.length) {
    console.error('Achados bloqueantes:');
    for (const finding of findings) console.error(`  [BLOCK] ${finding}`);
    console.error(`\nLEGACY RUNTIME GUARD: BLOQUEADO (${findings.length} achado(s))`);
    process.exitCode = 2;
    return;
  }

  console.log('Referências diretas às coleções raiz: nenhuma');
  console.log('Flags de runtime HGeSM: workspace-scoped');
  console.log('Rules do legado operacional: somente leitura');
  console.log('settings/global: preservado como configuração global da plataforma');
  console.log('\nLEGACY RUNTIME GUARD: READY');
}

function auditRuntimeSource() {
  const files = runtimeRoots.flatMap((dir) => walk(resolve(root, dir)))
    .filter((path) => /\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(path));

  const rootCollectionCall = new RegExp(
    String.raw`(?:collection|doc)\s*\(\s*db\s*,\s*['"](${operationalCollections.join('|')})['"]`,
    'g'
  );
  const legacyCounterCall = /doc\s*\(\s*db\s*,\s*['"]settings['"]\s*,\s*['"]termoRecebimentoCounter['"]\s*\)/;

  for (const path of files) {
    const source = readFileSync(path, 'utf8');
    const display = relative(root, path).replaceAll('\\', '/');

    for (const match of source.matchAll(rootCollectionCall)) {
      findings.push(`${display}: acesso Firestore direto à coleção raiz '${match[1]}'.`);
    }
    if (legacyCounterCall.test(source)) {
      findings.push(`${display}: acesso direto ao contador legado settings/termoRecebimentoCounter.`);
    }
  }
}

function auditWorkspaceContext() {
  const path = resolve(root, 'lib/workspaceContext.ts');
  const source = readFileSync(path, 'utf8');

  if (/legacyDataMode\s*:\s*true/.test(source)) {
    findings.push('lib/workspaceContext.ts: legacyDataMode=true voltou ao runtime.');
  }
  if (/legacySettingsMode\s*:\s*true/.test(source)) {
    findings.push('lib/workspaceContext.ts: legacySettingsMode=true voltou ao runtime.');
  }
  if (!/legacyDataMode\s*:\s*false/.test(source)) {
    findings.push('lib/workspaceContext.ts: legacyDataMode=false não foi encontrado.');
  }
  if (!/legacySettingsMode\s*:\s*false/.test(source)) {
    findings.push('lib/workspaceContext.ts: legacySettingsMode=false não foi encontrado.');
  }
}

function auditFirestoreRules() {
  const path = resolve(root, 'firestore.rules');
  const source = readFileSync(path, 'utf8');

  for (const collectionName of operationalCollections) {
    const block = extractMatchBlock(source, `/${collectionName}/{id}`);
    if (!block) {
      findings.push(`firestore.rules: bloco legado /${collectionName}/{id} não encontrado.`);
      continue;
    }
    if (!/allow\s+read\s*:\s*if\s+isHgesmFounder\s*\(\s*\)\s*;/.test(block)) {
      findings.push(`firestore.rules: /${collectionName}/{id} não preserva leitura controlada do HGeSM.`);
    }
    if (!/allow\s+write\s*:\s*if\s+false\s*;/.test(block)) {
      findings.push(`firestore.rules: /${collectionName}/{id} ainda permite escrita legada.`);
    }
  }

  const settingsBlock = extractMatchBlock(source, '/settings/{id}');
  if (!settingsBlock || !/allow\s+write\s*:\s*if\s+false\s*;/.test(settingsBlock)) {
    findings.push('firestore.rules: settings raiz genérico não está bloqueado para escrita.');
  }

  const globalBlock = extractMatchBlock(source, '/settings/global');
  if (!globalBlock || !/allow\s+read\s*:\s*if\s+true\s*;/.test(globalBlock)) {
    findings.push('firestore.rules: settings/global perdeu a leitura pública necessária ao branding pré-login.');
  }
}

function extractMatchBlock(source, matchPath) {
  const marker = `match ${matchPath} {`;
  const start = source.indexOf(marker);
  if (start === -1) return null;

  const openingBrace = start + marker.length - 1;
  let depth = 1;
  for (let i = openingBrace + 1; i < source.length; i += 1) {
    if (source[i] === '{') {
      depth += 1;
    } else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}

function walk(path) {
  try {
    if (!statSync(path).isDirectory()) return [path];
  } catch {
    return [];
  }

  const output = [];
  for (const entry of readdirSync(path)) {
    if (entry === 'node_modules' || entry === '.next' || entry === '.vercel') continue;
    const child = join(path, entry);
    const stat = statSync(child);
    if (stat.isDirectory()) output.push(...walk(child));
    else output.push(child);
  }
  return output;
}
