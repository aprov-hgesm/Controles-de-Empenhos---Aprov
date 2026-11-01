#!/usr/bin/env node
// Strictly scoped: repair the founder's missing platformAccounts UG, and nothing else.
// This is NOT a generic Firestore migration or privilege escalation tool.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROJECT = 'gen-lang-client-0982077967';
const DATABASE = 'ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1';
const WORKSPACE = 'hgesm-aprov';
const EMAIL = 'aprov1hgesm@gmail.com';
const UG = '160416';
const ROOT = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DATABASE}/documents`;

const fieldString = (doc, key) => doc?.fields?.[key]?.stringValue;

export function classifyFounderUg(workspace, account) {
  if (
    !workspace || !account ||
    fieldString(workspace, 'id') !== WORKSPACE ||
    fieldString(workspace, 'authorizedEmail') !== EMAIL ||
    fieldString(workspace, 'status') !== 'active' ||
    fieldString(workspace, 'ug') !== UG ||
    fieldString(account, 'email') !== EMAIL ||
    fieldString(account, 'workspaceId') !== WORKSPACE ||
    fieldString(account, 'accountType') !== 'sector' ||
    fieldString(account, 'status') !== 'active' ||
    !account.updateTime || Number.isNaN(Date.parse(account.updateTime))
  ) throw new Error('FOUNDER_IDENTITY_NOT_VERIFIED: no writes');
  const field = account.fields?.ug;
  if (field?.stringValue === UG) return 'already-consistent';
  if (field === undefined || (
    Object.prototype.hasOwnProperty.call(field, 'nullValue') && field.nullValue === null
  )) return 'missing-ug';
  throw new Error('FOUNDER_ACCOUNT_UG_UNEXPECTED: no writes');
}

async function request(method, url, token, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : {'Content-Type':'application/json'}) },
    cache: 'no-store',
    ...(body === undefined ? {} : {body:JSON.stringify(body)}),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`FIRESTORE_${method}_HTTP_${res.status}: no personal data printed`);
  return res.json();
}

export async function auditAndRepairFounderUg({ token, repair = false }) {
  const workspaceUrl = `${ROOT}/workspaces/${WORKSPACE}`;
  const accountUrl = `${ROOT}/platformAccounts/${encodeURIComponent(EMAIL)}`;
  const [ws, acc] = await Promise.all([
    request('GET', workspaceUrl, token),
    request('GET', accountUrl, token),
  ]);
  const state = classifyFounderUg(ws, acc);
  if (state === 'already-consistent') return 'ALREADY_CONSISTENT';
  if (!repair) return 'FOUNDER_ACCOUNT_UG_MISSING_READ_ONLY';
  // Re-check BOTH documents just before changing account; fail closed if workspace changed.
  const [currentWs, currentAcc] = await Promise.all([
    request('GET', workspaceUrl, token),
    request('GET', accountUrl, token),
  ]);
  const currentState = classifyFounderUg(currentWs, currentAcc);
  if (currentState === 'already-consistent') return 'ALREADY_CONSISTENT';
  if (currentWs.updateTime !== ws.updateTime || currentAcc.updateTime !== acc.updateTime)
    throw new Error('FOUNDER_DOCUMENT_CHANGED_DURING_CHECK: no writes');
  const patchUrl = new URL(accountUrl);
  patchUrl.searchParams.set('updateMask.fieldPaths', 'ug');
  patchUrl.searchParams.set('currentDocument.updateTime', currentAcc.updateTime);
  await request('PATCH', patchUrl.toString(), token, {
    fields: { ug: { stringValue: UG } },
  });
  // Post-write verification of BOTH documents; no other fields were in updateMask.
  const [finalWs, finalAcc] = await Promise.all([
    request('GET', workspaceUrl, token),
    request('GET', accountUrl, token),
  ]);
  if (classifyFounderUg(finalWs, finalAcc) !== 'already-consistent')
    throw new Error('FOUNDER_UG_POSTWRITE_CHECK_FAILED');
  return 'FOUNDER_ACCOUNT_UG_REPAIRED_AND_CONFIRMED';
}

async function main() {
  if (process.argv[2] !== 'audit' && process.argv[2] !== 'repair') throw new Error('Use audit or repair');
  if (process.env.GITHUB_REPOSITORY_ID !== '1286320615' ||
      process.env.GITHUB_REF !== 'refs/heads/main' ||
      process.env.GITHUB_ACTOR !== 'Moriark') throw new Error('REPO_ACTOR_REF_GUARD: no writes');
  const result = spawnSync('gcloud', ['auth','print-access-token'], { encoding:'utf8', timeout:15000 });
  const token = result.status === 0 ? result.stdout.trim() : '';
  if (!token || token.length < 20) throw new Error('WIF_ACCESS_TOKEN_UNAVAILABLE: no writes');
  const message = await auditAndRepairFounderUg({token, repair:process.argv[2]==='repair'});
  console.log(message);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(`file://${process.argv[1]}`))) {
  main().catch(err => { console.error('GUARDED_REPAIR_ABORTED:', err?.message || 'unknown'); process.exitCode=1; });
}
