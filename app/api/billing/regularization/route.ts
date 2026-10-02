import { NextResponse } from 'next/server';

import firebaseConfig from '../../../../firebase-applet-config.json';
import { EMPROVEX_FULL_PLAN_PRICE_CENTS } from '../../../../lib/billing';
import { getGoogleAccessToken } from '../../../../lib/server/sectorProvisioningAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FirestoreValue {
  stringValue?: string;
  integerValue?: string;
  booleanValue?: boolean;
  arrayValue?: { values?: FirestoreValue[] };
  mapValue?: { fields?: Record<string, FirestoreValue> };
}

interface FirestoreDocumentPayload {
  fields?: Record<string, FirestoreValue>;
}

interface PublicRegularizationConfig {
  planName: 'Plano Completo EMPROVEX';
  monthlyPriceCents: number;
  currency: 'BRL';
  dueBusinessDay: 5;
  gracePeriodDays: number;
  paymentLinkUrl: string;
  pixKey: string;
  pixKeyType: string;
  pixRecipientName: string;
  supportContact: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cached: { value: PublicRegularizationConfig; expiresAt: number } | null = null;

function stringField(fields: Record<string, FirestoreValue> | undefined, key: string): string {
  const value = fields?.[key]?.stringValue;
  return typeof value === 'string' ? value : '';
}

function integerField(
  fields: Record<string, FirestoreValue> | undefined,
  key: string,
  fallback: number
): number {
  const raw = fields?.[key]?.integerValue;
  const parsed = raw === undefined ? Number.NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function publicHttpsUrl(value: string): string {
  if (!value) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

async function loadPublicRegularizationConfig(): Promise<PublicRegularizationConfig> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const accessToken = await getGoogleAccessToken();
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseConfig.projectId)}/databases/${encodeURIComponent(firebaseConfig.firestoreDatabaseId)}/documents/platformBillingConfig/main`,
    {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    throw new Error(`Não foi possível carregar a configuração pública de regularização (HTTP ${response.status}).`);
  }

  const payload = await response.json() as FirestoreDocumentPayload;
  const fields = payload.fields;
  const value: PublicRegularizationConfig = {
    planName: 'Plano Completo EMPROVEX',
    monthlyPriceCents: EMPROVEX_FULL_PLAN_PRICE_CENTS,
    currency: 'BRL',
    dueBusinessDay: 5,
    gracePeriodDays: integerField(fields, 'gracePeriodDays', 10),
    paymentLinkUrl: publicHttpsUrl(stringField(fields, 'paymentLinkUrl')),
    pixKey: stringField(fields, 'pixKey'),
    pixKeyType: stringField(fields, 'pixKeyType'),
    pixRecipientName: stringField(fields, 'pixRecipientName'),
    supportContact: stringField(fields, 'supportContact').slice(0, 240),
  };

  cached = {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
  return value;
}

export async function GET() {
  try {
    const value = await loadPublicRegularizationConfig();
    return NextResponse.json(value, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.warn(
      'Configuração pública de regularização indisponível.',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      {
        code: 'REGULARIZATION_CONFIG_UNAVAILABLE',
        message: 'As instruções de regularização estão temporariamente indisponíveis. Tente novamente em instantes.',
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    );
  }
}
