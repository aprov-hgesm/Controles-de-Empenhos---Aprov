import firebaseConfig from '../../firebase-applet-config.json';
import { brazilDay, buildAdminDigest } from '../adminDailyDigest.mjs';
import { getCloudRunAccessToken, isCloudRunRuntime } from './cloudRunServiceIdentity.mjs';
import { readBillingAdminDirectory } from './platformBillingAdminStore';
import { loadFirebaseGlobalUsageObservation } from './googleCloudMonitoring';
import { sendAdminDigestViaGmail } from './adminDigestGmail';

const project = firebaseConfig.projectId;
const database = firebaseConfig.firestoreDatabaseId;
const root = 'https://firestore.googleapis.com/v1/projects/' + project +
  '/databases/' + encodeURIComponent(database) + '/documents/platformAdminDigestRuns';
const uptimeId = 'emprovex-https-V2Qfs8cPy7w';
const service = 'emprovex-cloudrun-candidate';

function env(key: string): string {
  const value = process.env[key]?.trim();
  if (!value || /[\r\n]/.test(value)) throw new Error('ADMIN_DIGEST_CONFIG_' + key);
  return value;
}
function storedField(row: { fields?: Record<string, { stringValue?: string }> }, key: string) {
  return row.fields?.[key]?.stringValue || '';
}
type Stored = { status: 'pending' | 'sent'; subject: string; text: string };
async function readRun(token: string, day: string): Promise<Stored | null> {
  const r = await fetch(root + '/' + day, { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('ADMIN_DIGEST_STORE_READ_' + r.status);
  const d = await r.json() as { fields?: Record<string, { stringValue?: string }> };
  const status = storedField(d, 'status');
  const subject = storedField(d, 'subject');
  const text = storedField(d, 'text');
  if ((status !== 'sent' && status !== 'pending') || !subject || !text) throw new Error('ADMIN_DIGEST_STORE_INVALID');
  return { status, subject, text };
}

async function savePending(token: string, day: string, draft: { subject: string; text: string }): Promise<Stored> {
  const r = await fetch(root + '?documentId=' + encodeURIComponent(day), {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: {
      status: { stringValue: 'pending' },
      subject: { stringValue: draft.subject },
      text: { stringValue: draft.text },
      createdAt: { timestampValue: new Date().toISOString() },
    } }),
    cache: 'no-store',
  });
  if (r.status === 409) {
    throw new Error('ADMIN_DIGEST_CONCURRENT_SEND_UNCERTAIN');
  }
  if (!r.ok) throw new Error('ADMIN_DIGEST_STORE_CREATE_' + r.status);
  return { ...draft, status: 'pending' };
}

async function markSent(token: string, day: string) {
  const r = await fetch(root + '/' + day + '?updateMask.fieldPaths=status&updateMask.fieldPaths=sentAt', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: {
      status: { stringValue: 'sent' },
      sentAt: { timestampValue: new Date().toISOString() },
    } }),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error('ADMIN_DIGEST_STORE_SENT_' + r.status);
}

type MetricPoint = { value?: { boolValue?: boolean; int64Value?: string } };
type MetricSeries = { points?: MetricPoint[] };

async function readMonitoringSeries(token: string, filter: string, now: Date): Promise<MetricSeries[]> {
  const result: MetricSeries[] = [];
  let next = '';
  for (let index = 0; index < 20; index += 1) {
    const url = new URL('https://monitoring.googleapis.com/v3/projects/' + project + '/timeSeries');
    url.searchParams.set('filter', filter);
    url.searchParams.set('interval.startTime', new Date(now.getTime() - 86400000).toISOString());
    url.searchParams.set('interval.endTime', now.toISOString());
    url.searchParams.set('view', 'FULL');
    url.searchParams.set('pageSize', '1000');
    if (next) url.searchParams.set('pageToken', next);
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
    if (!r.ok) throw new Error('ADMIN_DIGEST_METRIC_' + r.status);
    const page = await r.json() as { timeSeries?: MetricSeries[]; nextPageToken?: string };
    result.push(...(page.timeSeries || []));
    next = page.nextPageToken || '';
    if (!next) return result;
  }
  throw new Error('ADMIN_DIGEST_METRIC_PAGES');
}

async function infrastructure(token: string, now: Date) {
  const uptimeFilter = 'metric.type="monitoring.googleapis.com/uptime_check/check_passed"' +
    ' AND metric.label.check_id="' + uptimeId + '" AND resource.type="uptime_url"';
  const errorFilter = 'metric.type="run.googleapis.com/request_count" AND resource.type="cloud_run_revision"' +
    ' AND resource.labels.service_name="' + service + '" AND metric.labels.response_code_class="5xx"';
  const [up, err] = await Promise.allSettled([
    readMonitoringSeries(token, uptimeFilter, now), readMonitoringSeries(token, errorFilter, now),
  ]);
  let uptime: { total: number; passed: number } | null = null;
  let errors5xx: number | null = null;
  if (up.status === 'fulfilled') {
    const booleans = up.value.flatMap(s => s.points || []).map(p => p.value?.boolValue)
      .filter((x): x is boolean => typeof x === 'boolean');
    if (booleans.length) uptime = { total: booleans.length, passed: booleans.filter(Boolean).length };
  }
  if (err.status === 'fulfilled') {
    const values = err.value.flatMap(s => s.points || [])
      .map(p => Number(p.value?.int64Value)).filter(Number.isFinite);
    if (values.length) errors5xx = values.reduce((a, b) => a + b, 0);
  }
  return { uptime, errors5xx };
}

async function prepare(token: string, now: Date) {
  const [billing, usage, operational] = await Promise.allSettled([
    readBillingAdminDirectory(),
    loadFirebaseGlobalUsageObservation(now),
    infrastructure(token, now),
  ]);
  const b = billing.status === 'fulfilled' ? billing.value : null;
  const u = usage.status === 'fulfilled' ? usage.value : null;
  const o = operational.status === 'fulfilled' ? operational.value : null;
  return buildAdminDigest({
    day: brazilDay(now), now: now.toISOString(),
    accounts: b?.accounts || null,
    cycles: b?.cycles || null,
    usage: u ? {
      billableReadUnits: u.snapshot.billableReadUnits,
      billableRealtimeReadUnits: u.snapshot.billableRealtimeReadUnits,
      billableWriteUnits: u.snapshot.billableWriteUnits,
      dataThrough: u.dataThrough,
    } : null,
    uptime: o?.uptime || null,
    errors5xx: o?.errors5xx ?? null,
  });
}

export async function sendAdminDailyDigest(now = new Date()) {
  if (!isCloudRunRuntime() || process.env.EMPROVEX_ADMIN_DIGEST_ENABLED !== '1') {
    throw new Error('ADMIN_DIGEST_DISABLED');
  }
  const to = env('EMPROVEX_ADMIN_DIGEST_TO');
  const from = env('EMPROVEX_ADMIN_DIGEST_GMAIL_FROM');
  const token = await getCloudRunAccessToken();
  const day = brazilDay(now);
  let message = await readRun(token, day);
  if (message?.status === 'sent') return { status: 'already_sent', day };
  // Gmail nao oferece idempotency key. Se ha envio pendente, bloquear retry
  // para evitar duplicacao em falha de rede apos o Gmail aceitar a mensagem.
  if (message?.status === 'pending') throw new Error('ADMIN_DIGEST_MANUAL_REVIEW_REQUIRED');
  if (!message) message = await savePending(token, day, await prepare(token, now));
  if (message.status === 'sent') return { status: 'already_sent', day };
  await sendAdminDigestViaGmail({
    from, to, subject: message.subject, text: message.text,
  });
  await markSent(token, day);
  return { status: 'sent', day };
}
