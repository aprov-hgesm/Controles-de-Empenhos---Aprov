#!/usr/bin/env node
/**
 * CI LEAN R2 — domain suites (deep integration/emulator coverage).
 * Standalone script usable by a CI matrix or from local PowerShell:
 * node scripts/ci-lean-domain.mjs warehouse
 */
import { spawnSync } from 'node:child_process';
import { DOMAINS } from './ci-lean-plan.mjs';

export const DEEP_DOMAIN_TESTS = Object.freeze({
  // Server-only Warehouse: direct SDK writes MUST be denied. Old modular-r1
  // emulator expected a client-side write ALLOW, so it cannot certify R2 Rules.
  warehouse: ['test:warehouse-server-only-rules', 'test:warehouse-server-manual-entry-security', 'test:mobile-outbound-unified', 'test:core-lean-r2-w4-contract', 'test:core-lean-r2-w4-assurance', 'test:core-lean-r2-w5-profile', 'test:core-lean-r2-w5-historical'],
  finance: ['test:ns-integrity', 'test:empenho-concurrency', 'test:financial-identity-v2'],
  auth: ['test:security:multitenant', 'test:external-drive-auth-emulator'],
  legal: ['test:saas-r1-legal-acceptance'],
  visual: ['test:warehouse-3d-stock', 'test:warehouse-3d-proportions'],
  recovery: ['test:backup-recovery'],
});

export function domainTests(domain) {
  if (!DOMAINS.includes(domain)) throw Error('CI_LEAN_UNKNOWN_DOMAIN: ' + String(domain));
  return [...DEEP_DOMAIN_TESTS[domain]];
}

export function runDomain(domain, spawn = spawnSync) {
  const scripts = domainTests(domain);
  const failures = [];
  for (const script of scripts) {
    console.log('[CI DOMAIN] ' + domain + ': npm run ' + script);
    const result = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['run', script], { stdio: 'inherit', timeout: 480000 });
    if (result.error || result.status !== 0) {
      console.error('[CI DOMAIN] FAIL:', script, result.error?.message || result.signal || result.status);
      failures.push(script);
    }
  }
  return { scripts, failures };
}

if (process.argv[1]?.endsWith('ci-lean-domain.mjs')) {
  try {
    const domain = process.argv[2];
    if (process.env.CI_DOMAIN_LIST_ONLY === '1') {
      console.log(domainTests(domain).join('\n'));
    } else {
      const result = runDomain(domain);
      if (result.failures.length) process.exitCode = 1;
    }
  } catch (error) {
    console.error('[CI DOMAIN] FAIL CLOSED:', error.message);
    process.exitCode = 1;
  }
}
