import { randomUUID } from 'node:crypto';

export const ADMIN_API_JSON_MAX_BYTES = 32 * 1024;
export const SECURITY_BURST_WINDOW_MS = 60_000;
export const SECURITY_BURST_BUCKET_LIMIT = 512;

export type AdminSecurityOperation =
  | 'sector-provision'
  | 'sector-delete'
  | 'sector-password-reset'
  | 'firebase-global-usage'
  | 'usage-alert-policy';

export type AdminMutationOperation =
  | 'sector-provision'
  | 'sector-delete'
  | 'sector-password-reset';

export class ApiSecurityError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'INVALID_CONTENT_TYPE'
      | 'INVALID_JSON'
      | 'PAYLOAD_TOO_LARGE'
      | 'RATE_LIMITED'
      | 'SECURITY_KILL_SWITCH',
    public readonly httpStatus: 400 | 413 | 429 | 503,
    public readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'ApiSecurityError';
  }
}

interface BurstBucket {
  count: number;
  resetAt: number;
}

declare global {
  var __emprovexSecurityBurstBuckets: Map<string, BurstBucket> | undefined;
}

const burstBuckets =
  globalThis.__emprovexSecurityBurstBuckets
  || new Map<string, BurstBucket>();

globalThis.__emprovexSecurityBurstBuckets = burstBuckets;

function sanitizeHeaderToken(value: string | null, maxLength: number): string {
  if (!value) return '';
  return value
    .replace(/[^a-zA-Z0-9._:-]/g, '')
    .slice(0, maxLength);
}

export interface RequestSecurityContext {
  operation: AdminSecurityOperation;
  requestId: string;
  clientKey: string;
}

export function createRequestSecurityContext(
  request: Request,
  operation: AdminSecurityOperation
): RequestSecurityContext {
  const suppliedRequestId = sanitizeHeaderToken(
    request.headers.get('x-request-id'),
    80
  );
  const forwarded = (
    request.headers.get('x-vercel-forwarded-for')
    || request.headers.get('x-forwarded-for')
    || request.headers.get('x-real-ip')
    || ''
  ).split(',')[0]?.trim() || '';

  return {
    operation,
    requestId: suppliedRequestId || randomUUID(),
    clientKey: sanitizeHeaderToken(forwarded, 96) || 'unknown-client',
  };
}

export function securityResponseHeaders(
  context: RequestSecurityContext,
  extra: Record<string, string> = {}
): Record<string, string> {
  return {
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Request-Id': context.requestId,
    ...extra,
  };
}

function pruneBurstBuckets(now: number): void {
  if (burstBuckets.size <= SECURITY_BURST_BUCKET_LIMIT) return;

  for (const [key, bucket] of burstBuckets) {
    if (bucket.resetAt <= now) burstBuckets.delete(key);
  }

  if (burstBuckets.size <= SECURITY_BURST_BUCKET_LIMIT) return;

  const overflow = burstBuckets.size - SECURITY_BURST_BUCKET_LIMIT;
  let removed = 0;
  for (const key of burstBuckets.keys()) {
    burstBuckets.delete(key);
    removed += 1;
    if (removed >= overflow) break;
  }
}

/**
 * Proteção de burst local ao processo.
 *
 * Deliberadamente não é tratada como rate limit distribuído/autoridade de
 * segurança. Em Vercel/serverless cada instância mantém seu próprio bucket. O
 * objetivo é conter loops, cliques repetidos e abuso concentrado sem adicionar
 * Redis, banco ou uma dependência operacional nova.
 */
export function enforceBestEffortBurstLimit(
  context: RequestSecurityContext,
  identity: string,
  limit: number,
  windowMs: number = SECURITY_BURST_WINDOW_MS
): void {
  const now = Date.now();
  pruneBurstBuckets(now);

  const normalizedIdentity = sanitizeHeaderToken(identity, 128) || 'anonymous';
  const key = `${context.operation}:${normalizedIdentity}`;
  const current = burstBuckets.get(key);

  if (!current || current.resetAt <= now) {
    burstBuckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return;
  }

  current.count += 1;
  if (current.count <= limit) return;

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((current.resetAt - now) / 1000)
  );

  logSecurityEvent('rate_limited', context, {
    limit,
    windowMs,
    retryAfterSeconds,
  });

  throw new ApiSecurityError(
    'Muitas solicitações em sequência. Aguarde alguns instantes e tente novamente.',
    'RATE_LIMITED',
    429,
    retryAfterSeconds
  );
}

export function enforcePreAuthBurstLimit(
  context: RequestSecurityContext
): void {
  enforceBestEffortBurstLimit(
    context,
    `preauth:${context.clientKey}`,
    180
  );
}

export function enforceAuthenticatedAdminBurstLimit(
  context: RequestSecurityContext,
  uid: string,
  profile: 'read' | 'mutation'
): void {
  enforceBestEffortBurstLimit(
    context,
    `${profile}:${uid}`,
    profile === 'mutation' ? 30 : 120
  );
}

const killSwitchEnvByOperation: Record<AdminMutationOperation, string> = {
  'sector-provision': 'EMPROVEX_DISABLE_SECTOR_PROVISIONING',
  'sector-delete': 'EMPROVEX_DISABLE_SECTOR_DELETION',
  'sector-password-reset': 'EMPROVEX_DISABLE_SECTOR_PASSWORD_RESET',
};

export function assertAdminMutationEnabled(
  context: RequestSecurityContext,
  operation: AdminMutationOperation
): void {
  const globallyDisabled = process.env.EMPROVEX_DISABLE_ADMIN_MUTATIONS === '1';
  const operationDisabled = process.env[killSwitchEnvByOperation[operation]] === '1';

  if (!globallyDisabled && !operationDisabled) return;

  logSecurityEvent('kill_switch_blocked', context, { operation });

  throw new ApiSecurityError(
    'Esta operação administrativa está temporariamente suspensa por segurança.',
    'SECURITY_KILL_SWITCH',
    503
  );
}

export async function readBoundedJsonRequest<T>(
  request: Request,
  context: RequestSecurityContext,
  maxBytes: number = ADMIN_API_JSON_MAX_BYTES
): Promise<T> {
  const contentType = request.headers.get('content-type')?.toLowerCase() || '';
  if (!contentType.startsWith('application/json')) {
    logSecurityEvent('invalid_content_type', context, {
      contentType: contentType.slice(0, 80),
    });
    throw new ApiSecurityError(
      'A solicitação precisa usar conteúdo JSON.',
      'INVALID_CONTENT_TYPE',
      400
    );
  }

  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    logSecurityEvent('payload_rejected', context, {
      declaredLength,
      maxBytes,
    });
    throw new ApiSecurityError(
      'A solicitação excede o tamanho permitido.',
      'PAYLOAD_TOO_LARGE',
      413
    );
  }

  const raw = await request.text();
  const actualBytes = new TextEncoder().encode(raw).byteLength;
  if (actualBytes > maxBytes) {
    logSecurityEvent('payload_rejected', context, {
      actualBytes,
      maxBytes,
    });
    throw new ApiSecurityError(
      'A solicitação excede o tamanho permitido.',
      'PAYLOAD_TOO_LARGE',
      413
    );
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    logSecurityEvent('invalid_json', context, {
      actualBytes,
    });
    throw new ApiSecurityError(
      'A solicitação JSON é inválida.',
      'INVALID_JSON',
      400
    );
  }
}

type SecurityEventType =
  | 'rate_limited'
  | 'kill_switch_blocked'
  | 'invalid_content_type'
  | 'invalid_json'
  | 'payload_rejected'
  | 'authentication_rejected';

export function logSecurityEvent(
  event: SecurityEventType,
  context: RequestSecurityContext,
  metadata: Record<string, string | number | boolean | null> = {}
): void {
  console.warn('EMPROVEX_SECURITY_EVENT', {
    event,
    operation: context.operation,
    requestId: context.requestId,
    ...metadata,
  });
}

export function apiSecurityErrorHeaders(
  context: RequestSecurityContext,
  error: ApiSecurityError
): Record<string, string> {
  return securityResponseHeaders(
    context,
    error.retryAfterSeconds
      ? { 'Retry-After': String(error.retryAfterSeconds) }
      : {}
  );
}
