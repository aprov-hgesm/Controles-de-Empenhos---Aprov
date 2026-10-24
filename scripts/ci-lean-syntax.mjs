#!/usr/bin/env node
// Validate runnable JavaScript syntax separately from TypeScript compilation.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { changedFiles } from './ci-lean-plan.mjs';

export const isNodeRunnable = path =>
  /\.(?:mjs|cjs)$/.test(path) || /^scripts\/.*\.js$/.test(path);

export function checkChangedScripts(files, node = process.execPath, cwd = process.cwd()) {
  const selected = [...new Set(files.filter(isNodeRunnable))].sort();
  const failed = [];
  for (const path of selected) {
    const result = spawnSync(node, ['--check', path], { cwd, encoding: 'utf8', timeout: 30000 });
    if (result.error || result.status !== 0) {
      failed.push(path);
      console.error('[CI LEAN SYNTAX] FAIL:', path, result.stderr || result.error?.message || result.signal);
    } else {
      console.log('[CI LEAN SYNTAX] PASS:', path);
    }
  }
  return { selected, failed };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = checkChangedScripts(changedFiles());
    console.log('[CI LEAN SYNTAX] Inspected:', result.selected.length, 'Failed:', result.failed.length);
    if (result.failed.length) process.exitCode = 1;
  } catch (error) {
    console.error('[CI LEAN SYNTAX] FAIL CLOSED:', error.message);
    process.exitCode = 1;
  }
}
