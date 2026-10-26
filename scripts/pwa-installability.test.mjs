#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');
const manifest = source('app/manifest.ts');
const layout = source('app/layout.tsx');
const route = source('app/api/install-icon/[size]/route.tsx');
const brandHook = source('hooks/usePlatformBranding.ts');
const nextConfig = source('next.config.ts');

test('R363: manifest standalone e icones Android, iOS e Windows', () => {
  assert.match(manifest, /short_name: 'EMPROVEX'/);
  assert.match(manifest, /start_url: '\/login'/);
  assert.match(manifest, /scope: '\/'/);
  assert.match(manifest, /display: 'standalone'/);
  assert.match(manifest, /192x192/);
  assert.match(manifest, /512x512/);
  assert.match(manifest, /purpose: 'any'/);
  assert.match(manifest, /purpose: 'maskable'/);
  assert.match(manifest, /\/api\/install-icon\/512\?maskable=1/);
  assert.match(layout, /manifest: '\/manifest\.webmanifest'/);
  assert.match(layout, /appleWebApp:/);
  assert.match(layout, /\/api\/install-icon\/180/);
  assert.match(layout, /\/api\/install-icon\/32/);
});

test('R363: logo enviada ao repositorio existe como PNG, sem alterar imagem original', () => {
  const png = readFileSync(resolve(process.cwd(), 'public/emprovex-logo.png'));
  assert.ok(png.length > 1000 && png.length <= 4_000_000);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  assert.ok(width >= 512 && height >= 512, 'imagem oficial precisa ter resolucao suficiente');
  assert.match(route, /public', 'emprovex-logo\.png'/);
  assert.match(route, /data:image\/png;base64/);
  assert.match(route, /markSize = maskable \? Math\.round\(size \* 0\.76\) : size/);
  assert.match(route, /X-Emprovex-Icon-Source/);
  assert.match(nextConfig, /outputFileTracingIncludes:/);
  assert.match(nextConfig, /'\/api\/install-icon\/\*'/);
  assert.match(nextConfig, /\.\/public\/emprovex-logo\.png/);
});

test('R363: identificacao institucional existente fica preservada sem Firestore nos icones', () => {
  // Outros pontos do site continuam usando branding configurado; icone instalado e PNG enviados.
  assert.match(brandHook, /doc\(db, 'settings', 'global'\)/);
  assert.match(brandHook, /NEXT_PUBLIC_EMPROVEX_LOGO_URL/);
  assert.doesNotMatch(route, /getGoogleAccessToken|firebaseConfig|fetch\(|FIREBASE_ADMIN/);
  assert.doesNotMatch(route, /setDoc\(|updateDoc\(|runTransaction\(/);
  assert.match(route, /CACHE_CONTROL/);
  assert.match(route, /ImageResponse/);
});

test('R363: manifest nao instala armazenamento offline de dados sensiveis', () => {
  assert.doesNotMatch(layout, /serviceWorker\.register/);
  assert.doesNotMatch(route, /caches\.open\(|indexedDB|localStorage/);
  assert.doesNotMatch(manifest, /^\s*related_applications:/m);
});

test('R16: a vitrine substitui a rota raiz antes dos arquivos sem quebrar login ou retorno administrativo', () => {
  const config = source('next.config.ts');
  const loginPage = source('app/login/page.tsx');
  const institucional = source('app/institucional/page.tsx');
  const adminPanel = source('components/admin/PlatformAdminView.tsx');
  assert.match(config, /beforeFiles:\s*\[/);
  assert.match(config, /source:\s*'\/',\s*destination:\s*'\/institucional'/);
  assert.doesNotMatch(config, /return\s*\[\s*\{\s*source:\s*'\/'/);
  assert.match(loginPage, /<EmprovexLogin/);
  assert.match(institucional, /public\/institucional\/content\.html/);
  assert.match(adminPanel, /router\.replace\('\/login'\)/);
});


test('R16.1: retornos de admin, deposito, mobile e assinaturas abrem plataforma, nao vitrine', () => {
  const files = [
    'features/warehouse/components/WarehouseSidebar.tsx',
    'features/warehouse/components/WarehouseModuleShell.tsx',
    'features/warehouse/components/WarehouseProtectedSurface.tsx',
    'features/warehouse/mobile/WarehouseMobileProtectedLayout.tsx',
    'app/admin/page.tsx',
    'components/billing/BillingPortalShell.tsx',
  ];
  for (const file of files) {
    const content = source(file);
    assert.doesNotMatch(content, /href=["']\/["']|window\.location\.(?:assign|replace)\(["']\/["']\)/, file);
    assert.match(content, /\/login/, file);
  }
  assert.match(source('components/admin/PlatformAdminView.tsx'), /router\.replace\('\/login'\)/);
  const mobileHome = source('features/warehouse/mobile/WarehouseMobileHome.tsx');
  assert.match(mobileHome, /data-testid="operator-mobile-back-emprovex"/);
  assert.match(mobileHome, /href="\/login"/);
  assert.match(source('features/warehouse/mobile/WarehouseMobileShell.tsx'), /href="\/operador-movel"/);
});

test('R16.1: o site explica teste, preco por setor e contratacao sem cartao', () => {
  const html = source('public/institucional/content.html');
  const css = source('public/institucional/site.css');
  assert.match(html, /R\$ 29,90/);
  assert.match(html, /setor \(workspace\)/);
  assert.match(html, /O teste de 30 dias é gratuito\?/);
  assert.match(html, /Preciso cadastrar cartão\?/);
  assert.match(html, /E ao final dos 30 dias\?/);
  assert.match(html, /Quantas pessoas do setor podem usar\?/);
  assert.match(html, /depósitos em 3D/);
  assert.match(html, /value-trial-callout/);
  for (const tier of ['29,90', '39,90', '49,90', '59,90', '69,90']) {
    assert.match(html, new RegExp('R\\$ ' + tier.replace(',', '\\,')));
  }
  assert.match(html, /três meses de assinatura paga/);
  assert.match(html, /30 dias de teste não entram nessa contagem/);
  assert.match(html, /href="#acesso">Solicitar meu teste acompanhado/);
  assert.match(css, /\.value-faq-item/);
  assert.match(css, /prefers-reduced-motion/);
});
