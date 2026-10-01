export const WAREHOUSE_SHORT_MEMORY_CACHE_TTL_MS = 30_000;

export interface WorkspaceMemoryReadCache<T> {
  read(
    workspaceId: string,
    variant: string,
    loader: () => Promise<T>
  ): Promise<T>;
  invalidate(workspaceId: string): void;
  clear(): void;
}

interface WorkspaceMemoryReadCacheOptions {
  ttlMs?: number;
  now?: () => number;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface InFlightEntry<T> {
  generation: number;
  promise: Promise<T>;
}

function requireCacheKeyPart(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error('WAREHOUSE_MEMORY_CACHE_INVALID_' + label);
  return normalized;
}

export function createWorkspaceMemoryReadCache<T>(
  options: WorkspaceMemoryReadCacheOptions = {}
): WorkspaceMemoryReadCache<T> {
  const ttlMs = options.ttlMs ?? WAREHOUSE_SHORT_MEMORY_CACHE_TTL_MS;
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error('WAREHOUSE_MEMORY_CACHE_INVALID_TTL');
  }

  const now = options.now ?? Date.now;
  const valuesByWorkspace = new Map<string, Map<string, CacheEntry<T>>>();
  const inFlightByWorkspace = new Map<string, Map<string, InFlightEntry<T>>>();
  const generationByWorkspace = new Map<string, number>();

  const generationFor = (workspaceId: string): number =>
    generationByWorkspace.get(workspaceId) ?? 0;

  const invalidate = (workspaceId: string): void => {
    const workspaceKey = requireCacheKeyPart(workspaceId, 'WORKSPACE');
    generationByWorkspace.set(workspaceKey, generationFor(workspaceKey) + 1);
    valuesByWorkspace.delete(workspaceKey);
    inFlightByWorkspace.delete(workspaceKey);
  };

  return {
    async read(workspaceId, variant, loader) {
      const workspaceKey = requireCacheKeyPart(workspaceId, 'WORKSPACE');
      const variantKey = requireCacheKeyPart(variant, 'VARIANT');
      const currentGeneration = generationFor(workspaceKey);
      const currentTime = now();
      const workspaceValues = valuesByWorkspace.get(workspaceKey);
      const cached = workspaceValues?.get(variantKey);

      if (cached && cached.expiresAt > currentTime) {
        return cached.value;
      }
      if (cached) {
        workspaceValues?.delete(variantKey);
        if (workspaceValues?.size === 0) valuesByWorkspace.delete(workspaceKey);
      }

      const workspaceInFlight = inFlightByWorkspace.get(workspaceKey);
      const pending = workspaceInFlight?.get(variantKey);
      if (pending && pending.generation === currentGeneration) {
        return pending.promise;
      }

      const promise = Promise.resolve()
        .then(loader)
        .then((value) => {
          if (generationFor(workspaceKey) === currentGeneration) {
            let values = valuesByWorkspace.get(workspaceKey);
            if (!values) {
              values = new Map<string, CacheEntry<T>>();
              valuesByWorkspace.set(workspaceKey, values);
            }
            values.set(variantKey, {
              value,
              expiresAt: now() + ttlMs,
            });
          }
          return value;
        })
        .finally(() => {
          const inFlight = inFlightByWorkspace.get(workspaceKey);
          if (inFlight?.get(variantKey)?.promise === promise) {
            inFlight.delete(variantKey);
            if (inFlight.size === 0) inFlightByWorkspace.delete(workspaceKey);
          }
        });

      let inFlight = inFlightByWorkspace.get(workspaceKey);
      if (!inFlight) {
        inFlight = new Map<string, InFlightEntry<T>>();
        inFlightByWorkspace.set(workspaceKey, inFlight);
      }
      inFlight.set(variantKey, {
        generation: currentGeneration,
        promise,
      });

      return promise;
    },
    invalidate,
    clear() {
      valuesByWorkspace.clear();
      inFlightByWorkspace.clear();
      generationByWorkspace.clear();
    },
  };
}
