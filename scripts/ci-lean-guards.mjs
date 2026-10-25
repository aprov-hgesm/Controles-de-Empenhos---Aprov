#!/usr/bin/env node
// CI LEAN R2: lossless batching of historical guard commands, fail-fast.
// The coverage test rejects missing, reordered and unrecognized guards.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const manifest = JSON.parse(readFileSync(new URL('../ops/ci-lean-r2-guards.json', import.meta.url), 'utf8'));
export function guardsFor(groupId) {
  const group = manifest.groups.find(group => group.id === groupId);
  if (!group || !group.steps?.length) throw Error('CI_LEAN_UNKNOWN_GUARD_GROUP: ' + String(groupId));
  return group.steps;
}

export function runGuardGroup(groupId, spawn = spawnSync) {
  const steps = guardsFor(groupId);
  for (const [index, step] of steps.entries()) {
    if (!/^verify:[a-z0-9:-]+$/.test(step.script)) throw Error('CI_LEAN_INVALID_GUARD: ' + step.script);
    console.log('[CI LEAN GUARDS] ' + groupId + ' [' + (index + 1) + '/' + steps.length + '] ' + step.name);
    const result = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['run', step.script], { stdio: 'inherit', timeout: 180000 });
    if (result.error || result.status !== 0) {
      console.error('[CI LEAN GUARDS] FAIL: ' + step.script, result.error?.message || result.signal || result.status);
      return { success: false, failed: step.script, attempted: index + 1 };
    }
  }
  console.log('[CI LEAN GUARDS] PASS ' + groupId + ' (' + steps.length + ' legacy checks)');
  return { success: true, attempted: steps.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!runGuardGroup(process.argv[3] || process.argv[2]).success) process.exitCode = 1;
  } catch (error) {
    console.error('[CI LEAN GUARDS] FAIL CLOSED:', error.message);
    process.exitCode = 1;
  }
}
