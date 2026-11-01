#!/usr/bin/env node
// EMPROVEX Cloud Run — zero-dependency scanner for accidental Vercel runtime coupling.
// Never deletes historical docs, disabled Vercel deployment guard or contingency code.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const root = process.cwd();
const runtimeDirs = new Set(['app', 'lib', 'components', 'features', 'hooks']);
const sourceExts = new Set(['.js','.jsx','.ts','.tsx','.mjs','.cjs']);
const ignoreDirs = new Set(['.git','.next','node_modules','.vercel','coverage','dist','build']);
const strict = process.argv.includes('--strict');
let checked = 0;
const findings = [];
// Exact defensive guards retained from the certified AI/Auth test branches.
// These do not deploy or depend on a Vercel runtime; changes to either line
// re-enter the strict audit automatically.
const approvedRuntimeGuards = new Map([
  ['lib/emprovex-ai/integration/environment.ts', new Set([
    "env.VERCEL!=='1'&&env.VERCEL_ENV===undefined;",
    "const vercel=env.VERCEL==='1'||env.VERCEL_ENV!==undefined;",
    "if(vercel)return env.VERCEL==='1'&&env.VERCEL_ENV==='preview';",
  ])],
  ['lib/server/firebaseFounderAuth.ts', new Set([
    'process.env.VERCEL || process.env.VERCEL_ENV || process.env.K_SERVICE',
  ])],
]);
function scan(dir) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (!ignoreDirs.has(ent.name)) scan(join(dir, ent.name));
      continue;
    }
    if (!ent.isFile() || !sourceExts.has(extname(ent.name))) continue;
    const path = join(dir, ent.name);
    const rel = relative(root, path).replaceAll('\\', '/');
    if (!runtimeDirs.has(rel.split('/')[0])) continue;
    checked += 1;
    const lines = readFileSync(path, 'utf8').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!/vercel|now\.sh/i.test(line)) continue;
      const trimmed = line.trim();
      const dangerous = /(?:process\.env\.)?VERCEL_[A-Z_]+|(?:https?:\/\/)?[A-Za-z0-9.-]+\.vercel\.app|vercel(?:\.cmd)?\s+(?:deploy|promote|build)/i.test(line);
      const approvedGuard = approvedRuntimeGuards.get(rel)?.has(trimmed) === true;
      findings.push({ path: rel, line: i + 1, dangerous, approvedGuard, comment: trimmed.startsWith('//') || trimmed.startsWith('*') });
    }
  }
}
for (const dirname of runtimeDirs) {
  try { scan(join(root, dirname)); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
console.log('EMPROVEX Cloud Run runtime scan: ' + checked + ' source files');
for (const item of findings) {
  console.log((item.dangerous && !item.approvedGuard ? 'BLOCK ' : item.approvedGuard ? 'GUARD ' : 'INFO  ') + item.path + ':' + item.line +
    (item.comment ? ' [comment]' : ' [source]'));
}
const blockers = findings.filter(item => item.dangerous && !item.comment && !item.approvedGuard);
console.log('References: ' + findings.length + '; unexpected runtime couplings: ' + blockers.length);
if (strict && blockers.length > 0) process.exitCode = 1;
