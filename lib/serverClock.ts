'use client';

const SERVER_CLOCK_MAX_AGE_MS = 30 * 60 * 1000;

interface ServerClockSample {
  serverEpochAtReceiptMs: number;
  monotonicAtReceiptMs: number;
  syncedAtMonotonicMs: number;
}

let sample: ServerClockSample | null = null;
let syncPromise: Promise<number> | null = null;

function monotonicNowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return 0;
}

function estimateFromSample(current: ServerClockSample): number {
  const elapsed = Math.max(0, monotonicNowMs() - current.monotonicAtReceiptMs);
  return current.serverEpochAtReceiptMs + elapsed;
}

function sampleIsFresh(current: ServerClockSample): boolean {
  return Math.max(0, monotonicNowMs() - current.syncedAtMonotonicMs)
    < SERVER_CLOCK_MAX_AGE_MS;
}

async function synchronizeServerClock(): Promise<number> {
  const startedAt = monotonicNowMs();
  const response = await fetch('/api/system-time', {
    method: 'GET',
    cache: 'no-store',
    headers: {
      'cache-control': 'no-cache',
    },
  });
  const receivedAt = monotonicNowMs();

  if (!response.ok) {
    throw new Error('EMPROVEX_SERVER_CLOCK_UNAVAILABLE');
  }

  const payload = await response.json() as {
    serverNowMs?: unknown;
  };
  const serverNowMs = Number(payload.serverNowMs);
  if (!Number.isFinite(serverNowMs) || serverNowMs <= 0) {
    throw new Error('EMPROVEX_SERVER_CLOCK_INVALID_RESPONSE');
  }

  // Aproxima o instante do servidor no momento em que a resposta chegou.
  // O RTT/2 corrige a latência sem consultar o relógio de parede do computador.
  const roundTripMs = Math.max(0, receivedAt - startedAt);
  sample = {
    serverEpochAtReceiptMs: serverNowMs + roundTripMs / 2,
    monotonicAtReceiptMs: receivedAt,
    syncedAtMonotonicMs: receivedAt,
  };

  return estimateFromSample(sample);
}

export function getCachedTrustedServerNowMs(): number | null {
  return sample ? estimateFromSample(sample) : null;
}

export async function getTrustedServerNowMs(options?: {
  forceSync?: boolean;
}): Promise<number> {
  const forceSync = options?.forceSync === true;

  if (!forceSync && sample && sampleIsFresh(sample)) {
    return estimateFromSample(sample);
  }

  if (!syncPromise) {
    syncPromise = synchronizeServerClock()
      .finally(() => {
        syncPromise = null;
      });
  }

  return syncPromise;
}
