#!/usr/bin/env node
// RC R1 HTTPS Preview smoke — SAFE GET ONLY, no session, cookies, mutations or credential logging.
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';

const EXPECTED_ORIGIN = 'https://controles-de-empenhos-aprov-git-rc-886227-aprov-hgesms-projects.vercel.app';
const EXPECTED_FROZEN_SHA = '61e372225834ed6060cd2b36dbdd55d1e1979c2c';
const origin = process.env.RC_PREVIEW_URL || EXPECTED_ORIGIN;
assert.equal(new URL(origin).origin, EXPECTED_ORIGIN, 'Preview origin differs from Vercel PR #280 verified URL');
assert.equal(new URL(origin).pathname, '/', 'Preview must be an origin, not a path or URL with parameters');

const checks = [
  { name: 'health', path: '/api/health', public: true },
  { name: 'terms', path: '/terms', public: true },
  { name: 'privacy', path: '/privacy', public: true },
  { name: 'mobile-shell-access', path: '/central-mobile', public: false }
];
const result = [];
for (const check of checks) {
  let code = 0, state = 'ERROR', information = '';
  try {
    const response = await fetch(origin + check.path, {
      method: 'GET', redirect: 'manual', cache: 'no-store', credentials: 'omit',
      headers: { 'Accept': check.name === 'health' ? 'application/json' : 'text/html' },
      signal: AbortSignal.timeout(13000),
    });
    code = response.status;
    if (code === 401 || code === 403) {
      state = 'BLOCKED_BY_ACCESS_CONTROL';
      information = 'Preview authentication/protection; no bypass attempted';
    } else if (code >= 300 && code < 400) {
      const destination = response.headers.get('location');
      if (check.public) {
        state = 'BLOCKED_REDIRECT';
      } else if (destination) {
        const target = new URL(destination, origin);
        if (target.hostname === new URL(origin).hostname || target.hostname.endsWith('.vercel.com')) {
          state = 'ACCESS_RESTRICTED_OR_REDIRECT';
        } else {
          state = 'UNEXPECTED_CROSS_ORIGIN_REDIRECT';
        }
      } else {
        state = 'UNEXPECTED_REDIRECT';
      }
      information = 'Redirect observed; content not followed and no token logged';
    } else if (code === 200) {
      if (check.name === 'health') {
        let body;
        try { body = await response.json(); } catch { body = null; }
        const valid = body?.status === 'ok' && typeof body.timestamp === 'string' &&
          Number.isFinite(Date.parse(body.timestamp)) &&
          (response.headers.get('cache-control') || '').includes('no-store');
        state = valid ? 'PASS_PUBLIC_HEALTH' : 'FAIL_HEALTH_CONTRACT';
        information = valid ? '200 JSON status ok / timestamp / no-store' : '200 but health contract mismatch';
      } else if (check.public) {
        const html = await response.text();
        const expected = check.name === 'terms' ? 'Termos de Serviço' : 'Política de Privacidade';
        state = html.includes(expected) ? 'PASS_PUBLIC_PAGE' : 'FAIL_PAGE_CONTENT';
        information = html.includes(expected) ? 'Public HTML matches expected legal page' : 'Unexpected HTML despite 200';
      } else {
        state = 'ACCESSIBLE_UNAUTHENTICATED';
        information = 'HTTP accessible only; no assertion of authenticated UX';
      }
    } else {
      state = 'UNEXPECTED_HTTP';
      information = 'Unexpected HTTP status';
    }
  } catch (e) {
    state = 'NETWORK_ERROR';
    information = e?.name === 'TimeoutError' ? 'Timeout 13s' : 'Network/DNS or TLS error (no body logged)';
  }
  result.push({ check: check.name, status: code || null, result: state, info: information });
  console.log(JSON.stringify(result.at(-1)));
  await sleep(100);
}
const publicPass = result.filter(x => x.result === 'PASS_PUBLIC_HEALTH' || x.result === 'PASS_PUBLIC_PAGE').length;
const protectedCount = result.filter(x => x.result.startsWith('BLOCKED_') || x.result.startsWith('ACCESS_RESTRICTED')).length;
const errors = result.filter(x => x.result.startsWith('FAIL_') || x.result === 'NETWORK_ERROR' || x.result === 'UNEXPECTED_HTTP' || x.result === 'UNEXPECTED_REDIRECT').length;
console.log('RC_PREVIEW_READONLY_RESULT=' + JSON.stringify({ frozenSha: EXPECTED_FROZEN_SHA, publicPass, protectedCount, errors, total: result.length, verdict: errors ? 'FAIL_OR_UNREACHABLE' : publicPass === 3 ? 'PUBLIC_ROUTES_PASS_AUTH_REQUIRED_FOR_FULL_ACCEPTANCE' : 'BLOCKED_ACCESS_CONTROL' }));
if (errors) process.exitCode = 1;
else if (publicPass !== 3) process.exitCode = 2;
