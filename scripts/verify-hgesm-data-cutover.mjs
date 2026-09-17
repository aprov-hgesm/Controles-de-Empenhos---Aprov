#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

main();

function main() {
  console.log('Gate final de dados operacionais por workspace — HGeSM\n');
  verifySourceModes();

  const checks = [
    {
      label: 'Paridade exata das cinco coleções',
      script: 'sync-hgesm-workspace-data.mjs',
      args: ['verify'],
    },
    {
      label: 'Integridade estrutural/semântica',
      script: 'audit-hgesm-workspace-integrity.mjs',
      args: [],
    },
    {
      label: 'Settings/contador já migrados',
      script: 'verify-hgesm-workspace-settings.mjs',
      args: [],
    },
  ];

  for (const check of checks) {
    console.log(`\n=== ${check.label} ===`);
    const result = spawnSync(
      process.execPath,
      [resolve(root, 'scripts', check.script), ...check.args],
      { cwd: root, stdio: 'inherit' },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) {
      console.error(`\nDATA CUTOVER: BLOQUEADO (${check.label})`);
      process.exit(result.status || 2);
    }
  }

  console.log('\nEstado de código esperado: OK');
  console.log('  legacyDataMode=true');
  console.log('  legacySettingsMode=false');
  console.log('\nDATA CUTOVER: READY');
  console.log('Nenhum dado foi alterado por este gate.');
}

function verifySourceModes() {
  const source = readFileSync(resolve(root, 'lib/workspaceContext.ts'), 'utf8');
  if (!/legacyDataMode:\s*true/.test(source)) {
    throw new Error('Gate inválido: legacyDataMode não está true antes do cutover.');
  }
  if (!/legacySettingsMode:\s*false/.test(source)) {
    throw new Error('Gate inválido: legacySettingsMode não está false. O Bloco 11 precisa permanecer ativo.');
  }
}
