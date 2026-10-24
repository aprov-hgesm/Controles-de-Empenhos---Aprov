#!/usr/bin/env node
/**
 * CI LEAN R2 — conservative diff-to-domain contract.
 * Unknown paths, global contracts and CI changes always expand coverage.
 * Pure classifyChanges is intentionally exported for mutation/negative tests.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DOMAINS = Object.freeze(['warehouse', 'finance', 'auth', 'legal', 'visual', 'recovery']);
const TESTS = Object.freeze({
  warehouse: [
    'test:adm-deposito-ledger', 'test:adm-deposito-inventory',
    'test:adm-deposito-outbound-return', 'test:mobile-outbound-unified',
    'verify:mobile-r1-integration-3',
  ],
  finance: ['test:ns-integrity-contract', 'test:ns-integrity', 'test:empenho-concurrency'],
  auth: ['verify:multitenant-security', 'verify:emprovex-warehouse-isolation', 'verify:saas-r1-security-enforcement'],
  legal: ['verify:public-oauth-legal-pages', 'verify:saas-r1-legal-acceptance'],
  visual: ['test:warehouse-isometric-camera', 'test:warehouse-3d-proportions'],
  recovery: ['test:recovery', 'verify:backup-recovery'],
});
const MOBILE = [
  'test:mobile-r1-scanner', 'test:mobile-r1-outbound',
  'test:mobile-r1-integration-3', 'test:mobile-outbound-unified',
  'verify:mobile-r1-integration-3',
];
const RULES = [
  [/^(?:app\/api\/central-depositos\/|app\/central-depositos\/|app\/operador-movel\/|features\/warehouse\/|components\/warehouse\/|lib\/warehouse\/|lib\/server\/warehouse|scripts\/(?:warehouse|mobile|verify-(?:warehouse|mobile|adm-deposito|central-depositos|emprovex-warehouse)))/, ['warehouse']],
  [/^(?:features\/empenhos\/|features\/sag\/|app\/(?:empenhos|sag)\/|lib\/(?:empenho|sag|financial|invoice|supplier|ns|operational)|scripts\/(?:empenho|sag|ns-|invoice|supplier|verify-(?:empenho|ns-|sag|supplier|block-1[0123])))/, ['finance']],
  [/^(?:firestore.*\.rules$|lib\/(?:auth|firebase|session|workspace|security)|lib\/server\/(?:auth|session|workspace)|app\/api\/(?:auth|session|workspace)\/|scripts\/(?:verify-(?:uid|sector|multitenant|hybrid-auth|saas-r1-security|session-cap)|firestore-multitenancy))/, ['auth']],
  [/^(?:app\/(?:privacy|terms)\/|components\/legal\/|hooks\/useLegal|lib\/legal|scripts\/(?:legal-|verify-(?:public-oauth-legal|saas-r1-legal)))/, ['legal']],
  [/^(?:components\/visual\/|components\/layout\/|app\/visual-lab\/|scripts\/(?:visual-|verify-(?:block-19|block-20|block-21)))/, ['visual']],
  [/^(?:ops\/(?:firestore-recovery|backup-recovery)|scripts\/(?:firestore-recovery|verify-(?:backup-recovery|saas-r1-ops-recovery)|workspace-backup-disaster)|app\/api\/health\/)/, ['recovery']],
];
const isDoc = p => /^(?:docs\/|memorial\/)/.test(p) || /\.(?:md|mdx|txt)$/.test(p);
const globalPath = p => /^(?:\.github\/|package(?:-lock)?\.json$|tsconfig(?:\..*)?\.json$|next\.config\.|firebase(?:\..+)?\.json$|firestore.*\.rules$|ops\/typescript-error-budget\.json$|scripts\/ci-(?:lean|fast|domain|release)|scripts\/verify-emprovex-core-protection)/.test(p);
const isCode = p => /\.(?:[cm]?js|[cm]?ts|tsx|jsx)$/.test(p);
const normalized = p => p.replaceAll('\\', '/').replace(/^\.\//, '');

function tags(path) {
  const p = normalized(path);
  if (isDoc(p)) return { domains: [], reason: 'documentation' };
  if (globalPath(p)) return { domains: [...DOMAINS], reason: 'global contract' };
  const domains = new Set();
  for (const [pattern, values] of RULES) if (pattern.test(p)) values.forEach(value => domains.add(value));
  if (/^(?:features\/warehouse\/mobile\/|app\/operador-movel\/|lib\/warehouse\/mobile|scripts\/(?:mobile|verify-mobile))/.test(p))
    domains.add('warehouse');
  if (/^(?:features\/warehouse\/.*(?:Isometric|3D|Croqui|DepotLayout)|app\/visual-lab\/)/i.test(p)) domains.add('visual');
  if (/^scripts\/.*\.(?:test\.)?mjs$/.test(p) && !domains.size)
    return { domains: [...DOMAINS], reason: 'unmapped executable test/guard' };
  if (!domains.size) return { domains: [...DOMAINS], reason: 'unclassified path (fail-safe)' };
  return { domains: [...domains], reason: 'mapped' };
}

/** Optional importer paths are included in classification and never replace original changes. */
export function classifyChanges(files, importers = []) {
  if (!Array.isArray(files) || !files.length) throw Error('CI_LEAN_EMPTY_DIFF: cannot silently PASS');
  const all = [...new Set([...files, ...importers].map(normalized))];
  const domains = new Set(), reasons = [], selected = new Set();
  for (const path of all) {
    const match = tags(path);
    match.domains.forEach(domain => domains.add(domain));
    reasons.push({ path, reason: match.reason, domains: match.domains });
    if (/^(?:features\/warehouse\/mobile\/|app\/operador-movel\/|lib\/warehouse\/mobile|scripts\/(?:mobile|verify-mobile))/.test(path))
      MOBILE.forEach(script => selected.add(script));
    if (/^(?:lib\/server\/warehouse|app\/api\/central-depositos\/|firestore\.warehouse)/.test(path))
      ['verify:emprovex-warehouse-isolation', 'test:adm-deposito-inventory'].forEach(script => selected.add(script));
  }
  for (const domain of domains) TESTS[domain].forEach(script => selected.add(script));
  return { domains: DOMAINS.filter(x => domains.has(x)), scripts: [...selected].sort(), reasons };
}

export function changedFiles(base = process.env.GITHUB_BASE_REF, cwd = process.cwd()) {
  const args = base
    ? ['diff', '--name-only', '--diff-filter=ACMRD', 'origin/' + base + '...HEAD']
    : ['diff', '--name-only', '--diff-filter=ACMRD', 'HEAD^', 'HEAD'];
  const text = execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 30000 });
  const files = text.split(/\r?\n/).map(normalized).filter(Boolean);
  if (!files.length) throw Error('CI_LEAN_EMPTY_DIFF: diff empty or base unavailable');
  return files;
}

/**
 * Conservative reverse import graph for relative TS/JS imports.
 * Resolves changed shared modules to feature/test importers; unknown imports still
 * fall back to the original path's conservative classification.
 */
export function discoverImporters(files, root = process.cwd()) {
  const source = ['app', 'components', 'features', 'hooks', 'lib', 'scripts'];
  const extensions = ['.ts', '.tsx', '.mjs', '.js', '.mts', '.cts', '.jsx'];
  const all = [];
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === '__generated__') continue;
      const path = join(dir, item.name);
      if (item.isDirectory()) walk(path);
      else if (item.isFile() && extensions.includes(extname(item.name))) all.push(path);
    }
  }
  source.forEach(dir => walk(join(root, dir)));
  const reverse = new Map();
  for (const filename of all) {
    const body = readFileSync(filename, 'utf8');
    const imports = /\b(?:from\s*|import\s*\(|require\s*\()\s*['"](\.[^'"]+)['"]/g;
    for (const match of body.matchAll(imports)) {
      const resolved = resolve(dirname(filename), match[1]);
      const targets = [resolved, ...extensions.map(ext => resolved + ext),
        ...extensions.map(ext => join(resolved, 'index' + ext))];
      for (const target of targets) {
        const key = normalized(relative(root, target));
        if (!reverse.has(key)) reverse.set(key, new Set());
        reverse.get(key).add(normalized(relative(root, filename)));
      }
    }
  }
  const visited = new Set(files.map(normalized)), queue = [...visited], dependents = new Set();
  while (queue.length) {
    const path = queue.shift();
    for (const importing of reverse.get(path) || []) {
      if (visited.has(importing)) continue;
      visited.add(importing);
      dependents.add(importing);
      queue.push(importing);
    }
  }
  return [...dependents].sort();
}

export function currentPlan(base, cwd = process.cwd()) {
  const files = changedFiles(base, cwd);
  const importers = discoverImporters(files, cwd);
  return { files, importers, ...classifyChanges(files, importers) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const plan = currentPlan();
    const mode = process.argv[2] || '--report';
    if (mode === '--matrix') {
      console.log(JSON.stringify({ include: plan.domains.map(domain => ({ domain })) }));
    } else if (mode === '--scripts') {
      console.log(plan.scripts.join('\n'));
    } else {
      console.log(JSON.stringify(plan, null, 2));
    }
  } catch (error) {
    console.error('[CI LEAN] FAIL CLOSED:', error.message);
    process.exitCode = 1;
  }
}
