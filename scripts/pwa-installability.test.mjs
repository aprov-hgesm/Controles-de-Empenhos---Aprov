#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');
const manifest = source('app/manifest.ts');
const layout = source('app/layout.tsx');
const route = source('app/api/install-icon/[size]/route.tsx');
const brand = source('lib/pwaBrandIcon.ts');

test('R363: instalação standalone com manifesto, ícones 192/512 e escopo do EMPROVEX', () => {
  assert.match(manifest, /short_name: 'EMPROVEX'/);
  assert.match(manifest, /start_url: '\/'/);
  assert.match(manifest, /scope: '\/'/);
  assert.match(manifest, /display: 'standalone'/);
  assert.match(manifest, /192x192/);
  assert.match(manifest, /512x512/);
  assert.match(manifest, /purpose: 'any maskable'/);
  assert.match(manifest, /prefer_related_applications: false/);
  assert.match(layout, /manifest: '\/manifest\.webmanifest'/);
  assert.match(layout, /appleWebApp:/);
  assert.match(layout, /\/api\/install-icon\/180/);
  assert.match(layout, /\/api\/install-icon\/32/);
});

test('R363: mesma identidade da configuração global existente, sem nova foto inventada', () => {
  const hook = source('hooks/usePlatformBranding.ts');
  assert.match(hook, /NEXT_PUBLIC_EMPROVEX_LOGO_URL/);
  assert.match(hook, /doc\(db, 'settings', 'global'\)/);
  assert.match(route, /NEXT_PUBLIC_EMPROVEX_LOGO_URL/);
  assert.match(route, /documents\/settings\/global\?mask.fieldPaths=logo/);
  assert.match(route, /record\.fields\?\.logo\?\.stringValue/);
  assert.match(route, /Preserve the exact institutional image/);
  assert.match(route, />EMP<\/div>/);
  assert.match(brand, /safeInstitutionalLogoSource/);
});

test('R363: endpoint público só entrega PNG e protege credenciais e fontes de imagem', () => {
  assert.match(route, /ImageResponse/);
  assert.match(route, /CACHE_CONTROL/);
  assert.match(route, /MAX_IMAGE_BYTES/);
  assert.match(route, /getGoogleAccessToken/);
  assert.match(route, /redirect: 'error'/);
  assert.match(route, /if \(!isEmprovexPwaIconSize\(rawSize\)\)/);
  assert.match(brand, /firebasestorage\.googleapis\.com/);
  assert.match(brand, /source\.length > MAX_DATA_URL_LENGTH/);
  assert.doesNotMatch(route, /return NextResponse\.json\(record/);
  assert.doesNotMatch(route, /setDoc\(|updateDoc\(|runTransaction\(/);
});

test('R363: não acrescenta SW/caches de dados administrativos', () => {
  assert.doesNotMatch(layout, /serviceWorker\.register/);
  assert.doesNotMatch(route, /caches\.open\(|indexedDB|localStorage/);
  assert.doesNotMatch(manifest, /related_applications/);
});
