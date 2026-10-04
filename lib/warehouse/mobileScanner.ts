export const WAREHOUSE_MOBILE_SCAN_KINDS = [
  'PRODUCT',
  'LOCATION',
  'UNKNOWN',
] as const;

export type WarehouseMobileScanKind =
  (typeof WAREHOUSE_MOBILE_SCAN_KINDS)[number];

export const WAREHOUSE_MOBILE_SCANNER_EXPECTATIONS = [
  'EXPECT_PRODUCT',
  'EXPECT_LOCATION',
  'EXPECT_SOURCE_LOCATION',
  'EXPECT_DESTINATION_LOCATION',
] as const;

export type WarehouseMobileScannerExpectation =
  (typeof WAREHOUSE_MOBILE_SCANNER_EXPECTATIONS)[number];

export type WarehouseMobileScanSource = 'CAMERA' | 'MANUAL';

export const WAREHOUSE_MOBILE_SCANNER_DEFAULT_COOLDOWN_MS = 900;

export interface WarehouseMobileScanEvent {
  value: string;
  kind: WarehouseMobileScanKind;
  expectation: WarehouseMobileScannerExpectation;
  source: WarehouseMobileScanSource;
  accepted: boolean;
  rejectionReason: 'TYPE_MISMATCH' | null;
  scannedAt: string;
}

export function normalizeWarehouseMobileScanValue(
  value: unknown
): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (
    !normalized
    || normalized.length > 256
    || /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

export function expectedWarehouseMobileScanKind(
  expectation: WarehouseMobileScannerExpectation
): Exclude<WarehouseMobileScanKind, 'UNKNOWN'> {
  return expectation === 'EXPECT_PRODUCT' ? 'PRODUCT' : 'LOCATION';
}

export function isWarehouseMobileScanKindAccepted(
  expectation: WarehouseMobileScannerExpectation,
  kind: WarehouseMobileScanKind
): boolean {
  return kind === expectedWarehouseMobileScanKind(expectation);
}

export function buildWarehouseMobileScanEvent(input: {
  value: string;
  kind: WarehouseMobileScanKind;
  expectation: WarehouseMobileScannerExpectation;
  source: WarehouseMobileScanSource;
  scannedAt?: string;
}): WarehouseMobileScanEvent {
  const normalized = normalizeWarehouseMobileScanValue(input.value);
  if (!normalized) {
    throw new Error('WAREHOUSE_MOBILE_SCAN_VALUE_INVALID');
  }

  const accepted = isWarehouseMobileScanKindAccepted(
    input.expectation,
    input.kind
  );

  return {
    value: normalized,
    kind: input.kind,
    expectation: input.expectation,
    source: input.source,
    accepted,
    rejectionReason: accepted ? null : 'TYPE_MISMATCH',
    scannedAt: input.scannedAt || new Date().toISOString(),
  };
}

export interface WarehouseMobileCooldownGuard {
  shouldAccept(value: string, nowMs?: number): boolean;
  reset(): void;
}

export function createWarehouseMobileCooldownGuard(
  cooldownMs = WAREHOUSE_MOBILE_SCANNER_DEFAULT_COOLDOWN_MS
): WarehouseMobileCooldownGuard {
  if (!Number.isFinite(cooldownMs) || cooldownMs < 0) {
    throw new Error('WAREHOUSE_MOBILE_SCAN_COOLDOWN_INVALID');
  }

  let lastValue: string | null = null;
  let lastAcceptedAt = Number.NEGATIVE_INFINITY;

  return {
    shouldAccept(value, nowMs = Date.now()) {
      const normalized = normalizeWarehouseMobileScanValue(value);
      if (!normalized || !Number.isFinite(nowMs)) return false;

      if (
        normalized === lastValue
        && nowMs - lastAcceptedAt < cooldownMs
      ) {
        return false;
      }

      lastValue = normalized;
      lastAcceptedAt = nowMs;
      return true;
    },
    reset() {
      lastValue = null;
      lastAcceptedAt = Number.NEGATIVE_INFINITY;
    },
  };
}
