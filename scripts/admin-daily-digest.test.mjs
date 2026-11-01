import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { brazilDay, buildAdminDigest } from '../lib/adminDailyDigest.mjs';

test('18:00 horario de Brasilia uses local date', () => {
  assert.equal(brazilDay(new Date('2026-11-01T21:00:00Z')), '2026-11-01');
  assert.equal(brazilDay(new Date('2026-11-02T01:00:00Z')), '2026-11-01');
});

test('aggregates billing states without guessing cash revenue', () => {
  const report = buildAdminDigest({
    day: '2026-11-01', now: '2026-11-01T21:00:00Z',
    accounts: [{ status: 'active' }, { status: 'trial' }, { status: 'exempt' }],
    cycles: [{ referenceMonth: '2026-11', status: 'paid', dueDate: '2026-11-05' }],
    usage: { billableReadUnits: 100, billableRealtimeReadUnits: 20, billableWriteUnits: 10 },
    uptime: { total: 10, passed: 9 }, errors5xx: 2,
  });
  assert.match(report.text, /Verificacoes HTTPS bem-sucedidas: 90%/);
  assert.match(report.text, /Em dia: 1 \| Trial: 1/);
  assert.match(report.text, /Erros HTTP 5xx no Cloud Run: 2/);
  assert.match(report.text, /1 ciclos marcados pagos/);
  assert.doesNotMatch(report.text, /R\$\s*\d+/);
});

test('unknown data is marked unavailable rather than zero', () => {
  const report = buildAdminDigest({
    day: '2026-11-01', now: '2026-11-01T21:00:00Z',
    accounts: null, cycles: null, usage: null, uptime: null, errors5xx: null,
  });
  assert.match(report.text, /indisponiveis/);
  assert.match(report.text, /Nao interpretar como zero/);
  assert.match(report.text, /sem medicao confiavel/);
});

test('cron route is authenticated and uses POST only', () => {
  const content = readFileSync(resolve('app/api/cron/admin-digest/route.ts'), 'utf8');
  assert.match(content, /jwtVerify/);
  assert.match(content, /EMPROVEX_ADMIN_DIGEST_SCHEDULER_EMAIL/);
  assert.match(content, /EMPROVEX_ADMIN_DIGEST_OIDC_AUDIENCE/);
  assert.match(content, /payload.email_verified === true/);
  assert.match(content, /export async function POST/);
  assert.doesNotMatch(content, /export async function GET/);
});

test('daily server dispatch is idempotent and never needs browser OAuth', () => {
  const content = readFileSync(resolve('lib/server/adminDailyDigest.ts'), 'utf8');
  assert.match(content, /ADMIN_DIGEST_MANUAL_REVIEW_REQUIRED/);
  assert.match(content, /platformAdminDigestRuns/);
  assert.match(content, /getCloudRunAccessToken/);
  assert.match(content, /sendAdminDigestViaGmail/);
  assert.doesNotMatch(content, /RESEND_API_KEY|api\.resend\.com/);
});

test('Gmail R1 keeps previous browser supplier flow intact and uses offline user OAuth', () => {
  const gmail = readFileSync(resolve('lib/server/adminDigestGmail.ts'), 'utf8');
  assert.match(gmail, /oauth2.googleapis.com\/token/);
  assert.match(gmail, /gmail.googleapis.com\/gmail\/v1\/users\/me\/messages\/send/);
  assert.match(gmail, /EMPROVEX_ADMIN_DIGEST_GMAIL_REFRESH_TOKEN/);
  assert.match(gmail, /ADMIN_DIGEST_GMAIL_SENDER_MISMATCH/);
  assert.match(gmail, /base64url/);
  assert.doesNotMatch(gmail, /googleWorkspaceMail|GmailRuntime|resend.com/);
});
