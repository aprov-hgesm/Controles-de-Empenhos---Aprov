import { importPKCS8, SignJWT } from 'jose';

import firebaseConfig from '../../firebase-applet-config.json';
import type { FirebaseGlobalUsageSnapshot } from '../platformCapacity';
import { USAGE_TELEMETRY_VERSION } from '../platformCapacity';

const MONITORING_SCOPE = 'https://www.googleapis.com/auth/monitoring.read';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const MONITORING_API_ROOT = 'https://monitoring.googleapis.com/v3';

const SERVICE_ACCOUNT_EMAIL_ENV = 'EMPROVEX_GCP_MONITORING_CLIENT_EMAIL';
const SERVICE_ACCOUNT_PRIVATE_KEY_ENV = 'EMPROVEX_GCP_MONITORING_PRIVATE_KEY';

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

interface CachedAccessToken {
  token: string;
  expiresAtMs: number;
}

let cachedAccessToken: CachedAccessToken | null = null;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Cloud Monitoring não configurado: variável ${name} ausente.`);
  return value;
}

function normalizePrivateKey(value: string): string {
  return value.includes('\\n') ? value.replace(/\\n/g, '\n') : value;
}

export function isGoogleCloudMonitoringConfigured(): boolean {
  return Boolean(
    process.env[SERVICE_ACCOUNT_EMAIL_ENV]?.trim()
    && process.env[SERVICE_ACCOUNT_PRIVATE_KEY_ENV]?.trim()
  );
}

async function mintServiceAccountAccessToken(): Promise<string> {
  const nowMs = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAtMs - nowMs > 60_000) {
    return cachedAccessToken.token;
  }

  const clientEmail = requiredEnv(SERVICE_ACCOUNT_EMAIL_ENV);
  const privateKey = normalizePrivateKey(requiredEnv(SERVICE_ACCOUNT_PRIVATE_KEY_ENV));
  const key = await importPKCS8(privateKey, 'RS256');
  const nowSeconds = Math.floor(nowMs / 1000);

  const assertion = await new SignJWT({
    scope: MONITORING_SCOPE,
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(clientEmail)
    .setSubject(clientEmail)
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
    throw new Error(`Falha ao autenticar o leitor do Cloud Monitoring (HTTP ${response.status}).`);
  }

  const payload = await response.json() as {
    access_token?: string;
    expires_in?: number;
  };

  if (!payload.access_token) {
    throw new Error('Cloud Monitoring não retornou token de acesso.');
  }

  const expiresIn = Number(payload.expires_in);
  cachedAccessToken = {
    token: payload.access_token,
    expiresAtMs: nowMs + (Number.isFinite(expiresIn) ? expiresIn : 3600) * 1000,
  };

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
    `resource.labels.database_id = "${databaseId.replace(/(["\\])/g, '\\$1')}"`,
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
      throw new Error(
        `Cloud Monitoring recusou a métrica ${metricType} (HTTP ${response.status}).`
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

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0,
    0,
    0,
    0
  ));
}

export interface FirebaseGlobalUsageObservation {
  snapshot: FirebaseGlobalUsageSnapshot;
  observedAt: string;
  dataThrough: string | null;
}

export async function loadFirebaseGlobalUsageObservation(
  now = new Date()
): Promise<FirebaseGlobalUsageObservation> {
  if (!isGoogleCloudMonitoringConfigured()) {
    throw new Error('Cloud Monitoring ainda não possui credencial server-side configurada.');
  }

  const accessToken = await mintServiceAccountAccessToken();
  const startTime = startOfUtcDay(now).toISOString();
  const endTime = now.toISOString();

  const [
    reads,
    writes,
    deletes,
    activeConnections,
    snapshotListeners,
  ] = await Promise.all([
    loadMetricObservation(
      accessToken,
      METRICS.documentReads.type,
      METRICS.documentReads.kind,
      startTime,
      endTime
    ),
    loadMetricObservation(
      accessToken,
      METRICS.documentWrites.type,
      METRICS.documentWrites.kind,
      startTime,
      endTime
    ),
    loadMetricObservation(
      accessToken,
      METRICS.documentDeletes.type,
      METRICS.documentDeletes.kind,
      startTime,
      endTime
    ),
    loadMetricObservation(
      accessToken,
      METRICS.activeConnections.type,
      METRICS.activeConnections.kind,
      startTime,
      endTime
    ),
    loadMetricObservation(
      accessToken,
      METRICS.snapshotListeners.type,
      METRICS.snapshotListeners.kind,
      startTime,
      endTime
    ),
  ]);

  const timestamps = [
    reads.latestPointAt,
    writes.latestPointAt,
    deletes.latestPointAt,
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
      activeConnections: activeConnections.value,
      snapshotListeners: snapshotListeners.value,
    },
    observedAt: endTime,
    dataThrough,
  };
}
