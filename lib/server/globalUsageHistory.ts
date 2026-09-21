import { importPKCS8, SignJWT } from 'jose';

import firebaseConfig from '../../firebase-applet-config.json';
import type { FirebaseGlobalUsageObservation } from './googleCloudMonitoring';

const FIREBASE_ADMIN_SERVICE_ACCOUNT_ENV = 'FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const BILLING_TIME_ZONE = 'America/Los_Angeles';

interface FirebaseAdminCredentials {
  clientEmail: string;
  privateKey: string;
}

interface CachedToken {
  token: string;
  expiresAtMs: number;
}

let cachedToken: CachedToken | null = null;

function normalizePrivateKey(value: string): string {
  return value.includes('\\n') ? value.replace(/\\n/g, '\n') : value;
}

function credentials(): FirebaseAdminCredentials | null {
  const raw = process.env[FIREBASE_ADMIN_SERVICE_ACCOUNT_ENV]?.trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      project_id?: unknown;
      client_email?: unknown;
      private_key?: unknown;
    };

    if (
      typeof parsed.client_email !== 'string'
      || typeof parsed.private_key !== 'string'
    ) {
      return null;
    }

    if (
      typeof parsed.project_id === 'string'
      && parsed.project_id
      && parsed.project_id !== firebaseConfig.projectId
    ) {
      return null;
    }

    return {
      clientEmail: parsed.client_email.trim(),
      privateKey: normalizePrivateKey(parsed.private_key.trim()),
    };
  } catch {
    return null;
  }
}

async function accessToken(): Promise<string | null> {
  const serviceAccount = credentials();
  if (!serviceAccount) return null;

  const nowMs = Date.now();
  if (cachedToken && cachedToken.expiresAtMs - nowMs > 60_000) {
    return cachedToken.token;
  }

  const key = await importPKCS8(serviceAccount.privateKey, 'RS256');
  const nowSeconds = Math.floor(nowMs / 1000);
  const assertion = await new SignJWT({ scope: CLOUD_PLATFORM_SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(serviceAccount.clientEmail)
    .setAudience(OAUTH_TOKEN_URL)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + 3600)
    .sign(key);

  const response = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Falha ao autenticar histórico de consumo (HTTP ${response.status}).`);
  }

  const payload = await response.json() as {
    access_token?: string;
    expires_in?: number;
  };
  if (!payload.access_token) {
    throw new Error('Token administrativo ausente para histórico de consumo.');
  }

  cachedToken = {
    token: payload.access_token,
    expiresAtMs: nowMs + Math.max(300, Number(payload.expires_in || 3600)) * 1000,
  };
  return payload.access_token;
}

function pacificDayKey(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Timestamp inválido para consolidar histórico global.');
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BILLING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

type FirestoreField =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { timestampValue: string };

function fieldsForObservation(
  dayKey: string,
  observation: FirebaseGlobalUsageObservation
): Record<string, FirestoreField> {
  const snapshot = observation.snapshot;
  const limit = snapshot.billingReference.readUnitsDailyLimit;
  const percentage = limit > 0
    ? (snapshot.billableReadUnits / limit) * 100
    : 0;

  return {
    dayKey: { stringValue: dayKey },
    source: { stringValue: 'google-cloud-monitoring' },
    projectId: { stringValue: snapshot.projectId },
    databaseId: { stringValue: snapshot.databaseId },
    billingTimeZone: { stringValue: BILLING_TIME_ZONE },
    windowStartedAt: { timestampValue: snapshot.windowStartedAt },
    windowEndedAt: { timestampValue: snapshot.windowEndedAt },
    observedAt: { timestampValue: observation.observedAt },
    ...(observation.dataThrough
      ? { dataThrough: { timestampValue: observation.dataThrough } as FirestoreField }
      : {}),
    billableReadUnits: { integerValue: String(snapshot.billableReadUnits) },
    billableRealtimeReadUnits: { integerValue: String(snapshot.billableRealtimeReadUnits) },
    billableWriteUnits: { integerValue: String(snapshot.billableWriteUnits) },
    documentReads: { integerValue: String(snapshot.documentReads) },
    documentWrites: { integerValue: String(snapshot.documentWrites) },
    documentDeletes: { integerValue: String(snapshot.documentDeletes) },
    readUnitsDailyLimit: {
      integerValue: String(snapshot.billingReference.readUnitsDailyLimit),
    },
    realtimeReadUnitsDailyLimit: {
      integerValue: String(snapshot.billingReference.realtimeReadUnitsDailyLimit),
    },
    writeUnitsDailyLimit: {
      integerValue: String(snapshot.billingReference.writeUnitsDailyLimit),
    },
    freeTierEligible: {
      booleanValue: snapshot.billingReference.freeTierEligible,
    },
    readQuotaPercentage: { doubleValue: percentage },
  };
}

/**
 * Guarda somente uma fotografia agregada do dia. Atualizações do mesmo dia
 * substituem o documento anterior, evitando crescimento por refresh do painel.
 * A falha de persistência nunca deve derrubar a leitura ao vivo do Monitoring.
 */
export async function persistGlobalUsageObservation(
  observation: FirebaseGlobalUsageObservation
): Promise<boolean> {
  const token = await accessToken();
  if (!token) return false;

  const dayKey = pacificDayKey(observation.snapshot.windowStartedAt);
  const documentUrl = [
    'https://firestore.googleapis.com/v1/projects',
    encodeURIComponent(firebaseConfig.projectId),
    'databases',
    encodeURIComponent(firebaseConfig.firestoreDatabaseId),
    'documents/platformUsageHistory',
    encodeURIComponent(dayKey),
  ].join('/');

  const response = await fetch(documentUrl, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      fields: fieldsForObservation(dayKey, observation),
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Falha ao consolidar histórico global (HTTP ${response.status})`
      + (body ? `: ${body.slice(0, 180).replace(/\s+/g, ' ')}` : '.')
    );
  }

  return true;
}
