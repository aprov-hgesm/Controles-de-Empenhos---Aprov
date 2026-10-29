#!/usr/bin/env node
// SOMENTE E2E: conta de assinatura isenta nas UGs falsas para testar as telas.
// Nunca importa este script na aplicação; não toca produção.
const host = process.env.FIRESTORE_EMULATOR_HOST;
const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
if (host !== '127.0.0.1:8080' || project !== 'demo-emprovex-security') {
  throw new Error('E2E_BILLING_FIXTURE_REQUIRES_LOCAL_FIRESTORE_EMULATOR');
}
const base = `http://${host}/v1/projects/${project}/databases/(default)/documents`;
const email = 'aprov1hgesm@gmail.com';
const accounts = [
  { id: 'workspace-lifecycle', email: 'sector-lifecycle@example.test', ug: '160416' },
  { id: 'workspace-b', email: 'sector-b@example.test', ug: '160417' },
];
function value(x) {
  if (typeof x === 'string') return { stringValue: x };
  if (typeof x === 'boolean') return { booleanValue: x };
  if (typeof x === 'number') return { integerValue: String(x) };
  throw new Error('Fixture type denied');
}
for (const account of accounts) {
  const path = `billingAccounts/${account.id}`;
  const data = {
    version: 'emprovex_billing_v1',
    workspaceId: account.id,
    ug: account.ug,
    authorizedEmail: account.email,
    status: 'exempt',
    monthlyPriceCents: 0,
    currency: 'BRL',
    trialGranted: true,
    trialStartedAt: '2026-09-21T00:00:00.000Z',
    trialEndsAt: '2026-10-21T00:00:00.000Z',
    paymentRequired: false,
    createdAt: '2026-09-21T00:00:00.000Z',
    updatedAt: '2026-10-29T00:00:00.000Z',
    createdBy: email,
    updatedBy: email,
  };
  const response = await fetch(`${base}/${path}`, {
    method: 'PATCH',
    headers: {
      authorization: 'Bearer owner',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ fields: Object.fromEntries(
      Object.entries(data).map(([key, v]) => [key, value(v)])
    ) }),
  });
  if (!response.ok) throw new Error(`E2E_BILLING_SEED_FAILED:${path}:${response.status}:${await response.text()}`);
  process.stdout.write(`E2E BILLING FIXTURE: exempt ${account.id} (somente emulator)\n`);
}
