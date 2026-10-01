import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

async function loadTypeScriptModule(relativePath) {
  const source = readFileSync(resolve(ROOT, relativePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: relativePath,
  }).outputText;
  const encoded = Buffer.from(output, 'utf8').toString('base64');
  return import('data:text/javascript;base64,' + encoded);
}

const {
  createWorkspaceMemoryReadCache,
  WAREHOUSE_SHORT_MEMORY_CACHE_TTL_MS,
} = await loadTypeScriptModule('lib/warehouse/memoryReadCache.ts');

test('TTL curto oficial permanece em dezenas de segundos', () => {
  assert.equal(WAREHOUSE_SHORT_MEMORY_CACHE_TTL_MS, 30_000);
});

test('duas leituras iguais no mesmo workspace reutilizam um carregamento real', async () => {
  let loads = 0;
  const cache = createWorkspaceMemoryReadCache({ ttlMs: 30_000 });
  const loader = async () => {
    loads += 1;
    return ['DEP-01'];
  };

  assert.deepEqual(await cache.read('workspace-a', 'depots:250', loader), ['DEP-01']);
  assert.deepEqual(await cache.read('workspace-a', 'depots:250', loader), ['DEP-01']);
  assert.equal(loads, 1);
});

test('workspaces diferentes nunca compartilham valor cacheado', async () => {
  let loads = 0;
  const cache = createWorkspaceMemoryReadCache({ ttlMs: 30_000 });
  const loaderFor = (workspaceId) => async () => {
    loads += 1;
    return workspaceId;
  };

  assert.equal(await cache.read('workspace-a', 'depots:250', loaderFor('A')), 'A');
  assert.equal(await cache.read('workspace-b', 'depots:250', loaderFor('B')), 'B');
  assert.equal(await cache.read('workspace-a', 'depots:250', loaderFor('A2')), 'A');
  assert.equal(loads, 2);
});

test('variantes da mesma workspace não colidem', async () => {
  let loads = 0;
  const cache = createWorkspaceMemoryReadCache({ ttlMs: 30_000 });
  assert.equal(await cache.read('workspace-a', 'depots:25', async () => ++loads), 1);
  assert.equal(await cache.read('workspace-a', 'depots:250', async () => ++loads), 2);
  assert.equal(await cache.read('workspace-a', 'depots:25', async () => ++loads), 1);
  assert.equal(loads, 2);
});

test('expiração do TTL provoca novo carregamento', async () => {
  let clock = 1_000;
  let loads = 0;
  const cache = createWorkspaceMemoryReadCache({
    ttlMs: 50,
    now: () => clock,
  });
  const loader = async () => ++loads;

  assert.equal(await cache.read('workspace-a', 'locations:500', loader), 1);
  clock += 49;
  assert.equal(await cache.read('workspace-a', 'locations:500', loader), 1);
  clock += 1;
  assert.equal(await cache.read('workspace-a', 'locations:500', loader), 2);
  assert.equal(loads, 2);
});

test('invalidação após mutação força nova leitura somente no workspace afetado', async () => {
  let loadsA = 0;
  let loadsB = 0;
  const cache = createWorkspaceMemoryReadCache({ ttlMs: 30_000 });

  assert.equal(await cache.read('workspace-a', 'destinations:250', async () => ++loadsA), 1);
  assert.equal(await cache.read('workspace-b', 'destinations:250', async () => ++loadsB), 1);
  cache.invalidate('workspace-a');
  assert.equal(await cache.read('workspace-a', 'destinations:250', async () => ++loadsA), 2);
  assert.equal(await cache.read('workspace-b', 'destinations:250', async () => ++loadsB), 1);
});

test('rejeição não é eternizada nem convertida em valor cacheado', async () => {
  let attempts = 0;
  const cache = createWorkspaceMemoryReadCache({ ttlMs: 30_000 });

  await assert.rejects(
    cache.read('workspace-a', 'depots:250', async () => {
      attempts += 1;
      throw new Error('falha transitória');
    }),
    /falha transitória/
  );

  const result = await cache.read('workspace-a', 'depots:250', async () => {
    attempts += 1;
    return 'recuperado';
  });
  assert.equal(result, 'recuperado');
  assert.equal(attempts, 2);
});

test('chamadas simultâneas idênticas compartilham a mesma promise em voo', async () => {
  let loads = 0;
  let release;
  const cache = createWorkspaceMemoryReadCache({ ttlMs: 30_000 });
  const loader = async () => {
    loads += 1;
    return new Promise((resolvePromise) => {
      release = resolvePromise;
    });
  };

  const first = cache.read('workspace-a', 'locations:500', loader);
  const second = cache.read('workspace-a', 'locations:500', loader);
  await Promise.resolve();
  assert.equal(loads, 1);
  release('ok');
  assert.equal(await first, 'ok');
  assert.equal(await second, 'ok');
  assert.equal(loads, 1);
});

test('promise rejeitada em voo é removida e retry executa novo loader', async () => {
  let loads = 0;
  let rejectFirst;
  const cache = createWorkspaceMemoryReadCache({ ttlMs: 30_000 });

  const first = cache.read('workspace-a', 'locations:500', async () => {
    loads += 1;
    return new Promise((_resolve, reject) => {
      rejectFirst = reject;
    });
  });
  const second = cache.read('workspace-a', 'locations:500', async () => {
    loads += 1;
    return 'não deve executar';
  });

  await Promise.resolve();
  assert.equal(loads, 1);
  rejectFirst(new Error('falha concorrente'));
  await assert.rejects(first, /falha concorrente/);
  await assert.rejects(second, /falha concorrente/);

  assert.equal(
    await cache.read('workspace-a', 'locations:500', async () => {
      loads += 1;
      return 'retry-ok';
    }),
    'retry-ok'
  );
  assert.equal(loads, 2);
});

test('invalidação durante request em voo impede repovoamento stale', async () => {
  let firstRelease;
  let loads = 0;
  const cache = createWorkspaceMemoryReadCache({ ttlMs: 30_000 });
  const first = cache.read('workspace-a', 'depots:250', async () => {
    loads += 1;
    return new Promise((resolvePromise) => {
      firstRelease = resolvePromise;
    });
  });
  await Promise.resolve();
  cache.invalidate('workspace-a');
  firstRelease('stale');
  assert.equal(await first, 'stale');

  assert.equal(
    await cache.read('workspace-a', 'depots:250', async () => {
      loads += 1;
      return 'fresh';
    }),
    'fresh'
  );
  assert.equal(loads, 2);
});

test('cenário sintético da Central reduz 8 carregamentos estruturais para 2', async (t) => {
  const depots = Array.from({ length: 4 }, (_, index) => 'DEP-' + index);
  const locations = Array.from({ length: 12 }, (_, index) => 'LOC-' + index);
  const surfaces = ['inicio', 'alocacao', 'siscofis', 'meus-depositos'];
  let depotLoads = 0;
  let locationLoads = 0;
  const depotCache = createWorkspaceMemoryReadCache({ ttlMs: 30_000 });
  const locationCache = createWorkspaceMemoryReadCache({ ttlMs: 30_000 });

  for (const _surface of surfaces) {
    await Promise.all([
      depotCache.read('workspace-a', 'list:250', async () => {
        depotLoads += 1;
        return depots;
      }),
      locationCache.read('workspace-a', 'list:500', async () => {
        locationLoads += 1;
        return locations;
      }),
    ]);
  }

  const beforeCalls = surfaces.length * 2;
  const afterCalls = depotLoads + locationLoads;
  const beforeDocumentEquivalents = surfaces.length * (depots.length + locations.length);
  const afterDocumentEquivalents = depots.length + locations.length;

  assert.equal(beforeCalls, 8);
  assert.equal(afterCalls, 2);
  assert.equal(beforeDocumentEquivalents, 64);
  assert.equal(afterDocumentEquivalents, 16);
  t.diagnostic(
    'synthetic controlled: 8 -> 2 loaders; 64 -> 16 document-equivalents (75% reduction)'
  );
});
