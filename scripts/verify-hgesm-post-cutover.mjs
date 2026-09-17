#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

main();

function main() {
  console.log('Verificação pós-cutover — HGeSM workspace\n');

  verifyCodeState();

  runStep(
    'Paridade imediata das cinco coleções',
    resolve(root, 'scripts/sync-hgesm-workspace-data.mjs'),
    ['verify'],
  );

  runStep(
    'Integridade estrutural/semântica',
    resolve(root, 'scripts/audit-hgesm-workspace-integrity.mjs'),
    [],
  );

  runStep(
    'Settings/contador do workspace',
    resolve(root, 'scripts/verify-hgesm-workspace-settings.mjs'),
    [],
  );

  console.log('\nPOST-CUTOVER: READY');
  console.log('Observação: este gate exige paridade imediata com o legado e deve ser usado antes de novas escritas no workspace.');
}

function verifyCodeState() {
  const source = readFileSync(resolve(root, 'lib/workspaceContext.ts'), 'utf8');
  const dataModeFalse = /legacyDataMode:\s*false/.test(source);
  const settingsModeFalse = /legacySettingsMode:\s*false/.test(source);
  const dataModeTrue = /legacyDataMode:\s*true/.test(source);

  if (!dataModeFalse || !settingsModeFalse || dataModeTrue) {
    console.error('Estado de código pós-cutover: BLOQUEADO');
    console.error(`  legacyDataMode=false: ${dataModeFalse ? 'OK' : 'NÃO'}`);
    console.error(`  legacySettingsMode=false: ${settingsModeFalse ? 'OK' : 'NÃO'}`);
    console.error(`  legacyDataMode=true residual: ${dataModeTrue ? 'SIM' : 'NÃO'}`);
    process.exit(2);
  }

  console.log('Estado de código pós-cutover: OK');
  console.log('  legacyDataMode=false');
  console.log('  legacySettingsMode=false\n');
}

function runStep(title, scriptPath, args) {
  console.log(`=== ${title} ===`);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: root,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    console.error(`\nPOST-CUTOVER: BLOQUEADO (${title})`);
    process.exit(result.status || 2);
  }

  console.log('');
}
