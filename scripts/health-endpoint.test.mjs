import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const routePath = resolve(root, 'app/api/health/route.ts');
const route = readFileSync(routePath, 'utf8');

test('health endpoint is a public, tiny, no-store GET response', () => {
  assert.match(route, /export async function GET/);
  assert.match(route, /status:\s*'ok'/);
  assert.match(route, /timestamp:\s*new Date\(\)\.toISOString\(\)/);
  assert.match(route, /Cache-Control/);
  assert.match(route, /no-store/);
  assert.match(route, /status:\s*200/);
});

test('health endpoint does not depend on operational data, credentials, or internal versioning', () => {
  assert.doesNotMatch(
    route,
    /firebase|firestore|getDoc|getDocs|collection\(|process\.env|secret|apiKey|projectId|databaseId|git|commit|version/i,
  );
});
