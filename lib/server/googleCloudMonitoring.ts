import { importPKCS8, SignJWT } from 'jose';

import firebaseConfig from '../../firebase-applet-config.json';
import type {
  FirebaseGlobalUsageSnapshot,
  FirestoreBillingReference,
} from '../platformCapacity';
import { USAGE_TELEMETRY_VERSION } from '../platformCapacity';

const MONITORING_SCOPE = 'https://www.googleapis.com/auth/monitoring.read';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const MONITORING_API_ROOT = 'https://monitoring.googleapis.com/v3';
const BILLING_RESET_TIME_ZONE = 'America/Los_Angeles' as const;

const SERVICE_ACCOUNT_EMAIL_ENV = 'EMPROVEX_GCP_MONITORING_CLIENT_EMAIL';
const SERVICE_ACCOUNT_PRIVATE_KEY_ENV = 'EMPROVEX_GCP_MONITORING_PRIVATE_KEY';
const FIREBASE_ADMIN_SERVICE_ACCOUNT_ENV = 'FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON';

const FREE_TIER_ELIGIBLE_ENV = 'EMPROVEX_FIRESTORE_FREE_TIER_ELIGIBLE';
const READ_UNITS_LIMIT_ENV = 'EMPROVEX_FIRESTORE_DAILY_READ_UNIT_FREE_LIMIT';
const REALTIME_READ_UNITS_LIMIT_ENV = 'EMPROVEX_FIRESTORE_DAILY_REALTIME_READ_UNIT_FREE_LIMIT';
const WRITE_UNITS_LIMIT_ENV = 'EMPROVEX_FIRESTORE_DAILY_WRITE_UNIT_FREE_LIMIT';

const DEFAULT_ENTERPRISE_READ_UNITS_LIMIT = 50_000;
const DEFAULT_ENTERPRISE_REALTIME_READ_UNITS_LIMIT = 50_000;
const DEFAULT_ENTERPRISE_WRITE_UNITS_LIMIT = 40_000;

const METRICS = {
  documentReads: {
    type: 'firestore.googleapis.com/document/read_ops_count',
    kind: 'delta',
  },
  documentWrites: {
    type: 'firestore.googleapis.com/document/write_ops_count',
    kind: 'delta',
  },
  documentDeletes: {
    type: 'firestore.googleapis.com/document/delete_ops_count',
    kind: 'delta',
  },
  billableReadUnits: {
    type: 'firestore.googleapis.com/api/billable_read_units',
    kind: 'delta',
  },
  billableRealtimeReadUnits: {
    type: 'firestore.googleapis.com/api/billable_realtime_read_units',
    kind: 'delta',
  },
  billableWriteUnits: {
    type: 'firestore.googleapis.com/api/billable_write_units',
    kind: 'delta',
  },
  activeConnections: {
    type: 'firestore.googleapis.com/network/active_connections',
    kind: 'gauge',
  },
  snapshotListeners: {
    type: 'firestore.googleapis.com/network/snapshot_listeners',
    kind: 'gauge',
  },
} as const;

interface MonitoringPoint {
  interval?: {
    startTime?: string;
    endTime?: string;
  };
  value?: {
    int64Value?: string;
    doubleValue?: number;
  };
}

interface MonitoringTimeSeries {
  points?: MonitoringPoint[];
}

interface MonitoringListResponse {
  timeSeries?: MonitoringTimeSeries[];
  nextPageToken?: string;
}

interface MetricObservation {
  value: number;
  latestPointAt: string | null;
}

interface ServiceAccountCredentials {
  clientEmail: string;
  privateKey: string;
  source: 'firebase-admin' | 'dedicated-monitoring';
}

interface CachedAccessToken {
  token: string;
  expiresAtMs: number;
}

const cachedAccessTokens = new Map<string, CachedAccessToken>();

function normalizePrivateKey(value: string): string {
  return value.includes('\\n') ? value.replace(/\\n/g, '\n') : value;
}

function parseFirebaseAdminCredentials(): ServiceAccountCredentials | null {
  const raw = process.env[FIREBASE_ADMIN_SERVICE_ACCOUNT_ENV]?.trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      client_email?: unknown;
      private_key?: unknown;
      project_id?: unknown;
    };

    const clientEmail = typeof parsed.client_email === 'string'
      ? parsed.client_email.trim()
      : '';
    const privateKey = typeof parsed.private_key === 'string'
      ? normalizePrivateKey(parsed.private_key.trim())
      : '';
    const projectId = typeof parsed.project_id === 'string'
      ? parsed.project_id.trim()
      : '';

    if (!clientEmail || !privateKey) return null;
    if (projectId && projectId !== firebaseConfig.projectId) return null;

    return {
      clientEmail,
      privateKey,
      source: 'firebase-admin',
    };
  } catch {
    return null;
  }
}

function parseDedicatedMonitoringCredentials(): ServiceAccountCredentials | null {
  const clientEmail = process.env[SERVICE_ACCOUNT_EMAIL_ENV]?.trim() || '';
  const rawPrivateKey = process.env[SERVICE_ACCOUNT_PRIVATE_KEY_ENV]?.trim() || '';
  if (!clientEmail || !rawPrivateKey) return null;

  return {
    clientEmail,
    privateKey: normalizePrivateKey(rawPrivateKey),
    source: 'dedicated-monitoring',
  };
}

function monitoringCredentialCandidates(): ServiceAccountCredentials[] {
  const candidates = [
    parseFirebaseAdminCredentials(),
    parseDedicatedMonitoringCredentials(),
  ].filter((value): value is ServiceAccountCredentials => Boolean(value));

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const identity = candidate.clientEmail.toLowerCase();
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

export function isGoogleCloudMonitoringConfigured(): boolean {
  return monitoringCredentialCandidates().length > 0;
}

function parseBooleanEnvironment(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (['1', 'true', 'yes', 'sim'].includes(raw)) return true;
  if (['0', 'false', 'no', 'nao', 'não'].includes(raw)) return false;
  throw new Error(`Variável ${name} deve ser true/false.`);
}

function positiveIntegerEnvironment(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Variável ${name} deve ser um inteiro positivo.`);
  }
  return value;
}

function loadBillingReference(): FirestoreBillingReference {
  return {
    source: 'firestore-enterprise-free-tier',
    freeTierEligible: parseBooleanEnvironment(FREE_TIER_ELIGIBLE_ENV, true),
    primaryMetric: 'billableReadUnits',
    resetTimeZone: BILLING_RESET_TIME_ZONE,
    readUnitsDailyLimit: positiveIntegerEnvironment(
      READ_UNITS_LIMIT_ENV,
      DEFAULT_ENTERPRISE_READ_UNITS_LIMIT
    ),
    realtimeReadUnitsDailyLimit: positiveIntegerEnvironment(
      REALTIME_READ_UNITS_LIMIT_ENV,
      DEFAULT_ENTERPRISE_REALTIME_READ_UNITS_LIMIT
    ),
    writeUnitsDailyLimit: positiveIntegerEnvironment(
      WRITE_UNITS_LIMIT_ENV,
      DEFAULT_ENTERPRISE_WRITE_UNITS_LIMIT
    ),
  };
}

async function mintServiceAccountAccessToken(
  credentials: ServiceAccountCredentials
): Promise<string> {
  const identity = `${credentials.source}:${credentials.clientEmail}`;
  const nowMs = Date.now();
  const cached = cachedAccessTokens.get(identity);

  if (cached && cached.expiresAtMs - nowMs > 60_000) {
    return cached.token;
  }

  const key = await importPKCS8(credentials.privateKey, 'RS256');
  const nowSeconds = Math.floor(nowMs / 1000);

  const assertion = await new SignJWT({
    scope: MONITORING_SCOPE,
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(credentials.clientEmail)
    .setAudience(OAUTH_TOKEN_URL)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + 3600)
    .sign(key);

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const response = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(
      `Falha ao autenticar ${credentials.source} no Cloud Monitoring (HTTP ${response.status}).`
    );
  }

  const payload = await response.json() as {
    access_token?: string;
    expires_in?: number;
  };

  if (!payload.access_token) {
    throw new Error(`Cloud Monitoring não retornou token para ${credentials.source}.`);
  }

  const expiresIn = Number(payload.expires_in);
  cachedAccessTokens.set(identity, {
    token: payload.access_token,
    expiresAtMs: nowMs + (Number.isFinite(expiresIn) ? expiresIn : 3600) * 1000,
  });

  return payload.access_token;
}

function numericPointValue(point: MonitoringPoint): number {
  const intValue = point.value?.int64Value;
  if (typeof intValue === 'string') {
    const parsed = Number(intValue);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const doubleValue = point.value?.doubleValue;
  return typeof doubleValue === 'number' && Number.isFinite(doubleValue)
    ? doubleValue
    : 0;
}

function newestPoint(points: MonitoringPoint[]): MonitoringPoint | null {
  if (!points.length) return null;
  return [...points].sort((a, b) => {
    const aTime = Date.parse(a.interval?.endTime || '') || 0;
    const bTime = Date.parse(b.interval?.endTime || '') || 0;
    return bTime - aTime;
  })[0] || null;
}

function latestTimestamp(
  current: string | null,
  candidate?: string
): string | null {
  if (!candidate) return current;
  if (!current) return candidate;
  return Date.parse(candidate) > Date.parse(current) ? candidate : current;
}

async function loadMetricObservation(
  accessToken: string,
  metricType: string,
  kind: 'delta' | 'gauge',
  startTime: string,
  endTime: string
): Promise<MetricObservation> {
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId;
  const filter = [
    `metric.type = "${metricType}"`,
    'resource.type = "firestore.googleapis.com/Database"',
    `resource.labels.database_id = "${databaseId.replace(/(["\\\\])/g, '\\\\$1')}"`,
  ].join(' AND ');

  let pageToken: string | undefined;
  let value = 0;
  let latestPointAt: string | null = null;

  do {
    const url = new URL(
      `${MONITORING_API_ROOT}/projects/${encodeURIComponent(projectId)}/timeSeries`
    );
    url.searchParams.set('filter', filter);
    url.searchParams.set('interval.startTime', startTime);
    url.searchParams.set('interval.endTime', endTime);
    url.searchParams.set('view', 'FULL');
    url.searchParams.set('pageSize', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const detail = body.slice(0, 240).replace(/\s+/g, ' ');
      throw new Error(
        `Cloud Monitoring recusou a métrica ${metricType} (HTTP ${response.status})`
        + (detail ? `: ${detail}` : '.')
      );
    }

    const payload = await response.json() as MonitoringListResponse;
    for (const series of payload.timeSeries || []) {
      const points = series.points || [];

      if (kind === 'delta') {
        for (const point of points) {
          value += numericPointValue(point);
          latestPointAt = latestTimestamp(latestPointAt, point.interval?.endTime);
        }
      } else {
        const point = newestPoint(points);
        if (point) {
          value += numericPointValue(point);
          latestPointAt = latestTimestamp(latestPointAt, point.interval?.endTime);
        }
      }
    }

    pageToken = payload.nextPageToken || undefined;
  } while (pageToken);

  return {
    value: Math.max(0, Math.round(value)),
    latestPointAt,
  };
}


const pacificDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BILLING_RESET_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function timeZoneParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const values = Object.fromEntries(
    pacificDateFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function timeZoneOffsetMs(date: Date): number {
  const parts = timeZoneParts(date);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  const epochWithoutMilliseconds = Math.floor(date.getTime() / 1000) * 1000;
  return representedAsUtc - epochWithoutMilliseconds;
}

function startOfPacificBillingDay(date: Date): Date {
  const local = timeZoneParts(date);
  const targetWallClock = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    0,
    0,
    0
  );

  let guess = new Date(targetWallClock);
  let offset = timeZoneOffsetMs(guess);
  guess = new Date(targetWallClock - offset);

  // Re-evaluate at the resolved instant so DST transitions remain correct.
  offset = timeZoneOffsetMs(guess);
  return new Date(targetWallClock - offset);
}

export interface FirebaseGlobalUsageObservation {
  snapshot: FirebaseGlobalUsageSnapshot;
  observedAt: string;
  dataThrough: string | null;
}

async function loadObservationWithAccessToken(
  accessToken: string,
  startTime: string,
  endTime: string
): Promise<FirebaseGlobalUsageObservation> {
  const billingReference = loadBillingReference();

  const [
    reads,
    writes,
    deletes,
    billableReadUnits,
    billableRealtimeReadUnits,
    billableWriteUnits,
    activeConnections,
    snapshotListeners,
  ] = await Promise.all([
    loadMetricObservation(accessToken, METRICS.documentReads.type, METRICS.documentReads.kind, startTime, endTime),
    loadMetricObservation(accessToken, METRICS.documentWrites.type, METRICS.documentWrites.kind, startTime, endTime),
    loadMetricObservation(accessToken, METRICS.documentDeletes.type, METRICS.documentDeletes.kind, startTime, endTime),
    loadMetricObservation(accessToken, METRICS.billableReadUnits.type, METRICS.billableReadUnits.kind, startTime, endTime),
    loadMetricObservation(accessToken, METRICS.billableRealtimeReadUnits.type, METRICS.billableRealtimeReadUnits.kind, startTime, endTime),
    loadMetricObservation(accessToken, METRICS.billableWriteUnits.type, METRICS.billableWriteUnits.kind, startTime, endTime),
    loadMetricObservation(accessToken, METRICS.activeConnections.type, METRICS.activeConnections.kind, startTime, endTime),
    loadMetricObservation(accessToken, METRICS.snapshotListeners.type, METRICS.snapshotListeners.kind, startTime, endTime),
  ]);

  const timestamps = [
    reads.latestPointAt,
    writes.latestPointAt,
    deletes.latestPointAt,
    billableReadUnits.latestPointAt,
    billableRealtimeReadUnits.latestPointAt,
    billableWriteUnits.latestPointAt,
    activeConnections.latestPointAt,
    snapshotListeners.latestPointAt,
  ].filter((value): value is string => Boolean(value));

  const dataThrough = timestamps.length
    ? timestamps.reduce((latest, value) =>
        Date.parse(value) > Date.parse(latest) ? value : latest
      )
    : null;

  return {
    snapshot: {
      telemetryVersion: USAGE_TELEMETRY_VERSION,
      source: 'google-cloud-monitoring',
      projectId: firebaseConfig.projectId,
      databaseId: firebaseConfig.firestoreDatabaseId,
      windowStartedAt: startTime,
      windowEndedAt: endTime,
      documentReads: reads.value,
      documentWrites: writes.value,
      documentDeletes: deletes.value,
      billableReadUnits: billableReadUnits.value,
      billableRealtimeReadUnits: billableRealtimeReadUnits.value,
      billableWriteUnits: billableWriteUnits.value,
      activeConnections: activeConnections.value,
      snapshotListeners: snapshotListeners.value,
      billingReference,
    },
    observedAt: endTime,
    dataThrough,
  };
}

async function loadFirebaseGlobalUsageObservationForInterval(
  startTime: string,
  endTime: string
): Promise<FirebaseGlobalUsageObservation> {
  const candidates = monitoringCredentialCandidates();
  if (!candidates.length) {
    throw new Error('Cloud Monitoring ainda não possui credencial server-side configurada.');
  }

  const failures: string[] = [];

  for (const credentials of candidates) {
    try {
      const accessToken = await mintServiceAccountAccessToken(credentials);
      return await loadObservationWithAccessToken(accessToken, startTime, endTime);
    } catch (error) {
      cachedAccessTokens.delete(`${credentials.source}:${credentials.clientEmail}`);
      const message = error instanceof Error ? error.message : 'falha desconhecida';
      failures.push(`${credentials.source}: ${message}`);
      console.warn('Leitor do Cloud Monitoring tentou credencial alternativa.', {
        source: credentials.source,
        message,
      });
    }
  }

  throw new Error(
    'Nenhuma credencial server-side conseguiu consultar o Cloud Monitoring. '
    + failures.join(' | ')
  );
}

export async function loadFirebaseGlobalUsageObservation(
  now = new Date()
): Promise<FirebaseGlobalUsageObservation> {
  const startTime = startOfPacificBillingDay(now).toISOString();
  const endTime = now.toISOString();
  return loadFirebaseGlobalUsageObservationForInterval(startTime, endTime);
}

export async function loadPreviousFirebaseBillingDayObservation(
  now = new Date()
): Promise<FirebaseGlobalUsageObservation> {
  const currentDayStart = startOfPacificBillingDay(now);
  const previousDayProbe = new Date(currentDayStart.getTime() - 12 * 60 * 60 * 1000);
  const previousDayStart = startOfPacificBillingDay(previousDayProbe);

  return loadFirebaseGlobalUsageObservationForInterval(
    previousDayStart.toISOString(),
    currentDayStart.toISOString()
  );
}
