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
  assert.match(manifest, /start_url: '\/central-empenhos'/);
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
  assert.match(route, /public', 'emprovex-logo favicon\.png'/);
  assert.match(route, /data:image\/png;base64/);
  assert.match(route, /markSize = maskable \? Math\.round\(size \* 0\.76\) : size/);
  assert.match(route, /MAX_IMAGE_BYTES = 6_000_000/);
  assert.match(route, /'48'/);
  assert.match(route, /X-Emprovex-Icon-Source/);
  assert.match(nextConfig, /outputFileTracingIncludes:/);
  assert.match(nextConfig, /'\/api\/install-icon\/\*'/);
  assert.match(nextConfig, /\.\/public\/emprovex-logo favicon\.png/);
});

test('R4: favicon circular e PWA nao sao sobrescritos pelo branding do login', () => {
  const icon = readFileSync(resolve(process.cwd(), 'public/emprovex-logo favicon.png'));
  assert.ok(icon.length > 4_000_000 && icon.length <= 6_000_000);
  assert.deepEqual([...icon.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.match(manifest, /v=20261102-r4/);
  assert.match(layout, /install-icon\/48\?v=20261102-r4/);
  assert.doesNotMatch(brandHook, /document\.querySelectorAll\("link\[rel\*='icon'\]"\)/);
  assert.doesNotMatch(brandHook, /canvas\.toDataURL\('image\/png'\)/);
  assert.match(brandHook, /branding\/emprovex-dark-transparent\.png/);
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
assert.match(adminPanel, /window\.location\.replace\('\/central-empenhos'\)/, 'Retorno administrativo deve ir ao login, não à vitrine.');
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
    if (file === 'components/billing/BillingPortalShell.tsx') {
      const returnButton = source('components/billing/BillingReturnButton.tsx');
      assert.match(content, /<BillingReturnButton/, 'Portal precisa delegar o retorno seguro.');
      assert.match(returnButton, /window\.location\.assign\('\/central-empenhos'\)/,
        'Retorno financeiro nunca pode redirecionar à vitrine institucional.');
      assert.match(returnButton, /\/api\/billing\/portal\?view=access/,
        'Retorno financeiro deve manter gate de autorização.');
    } else {
      assert.match(content, /\/central-empenhos/, file);
    }
  }
  assert.match(source('components/admin/PlatformAdminView.tsx'), /window\.location\.replace\('\/central-empenhos'\)/);
  const mobileHome = source('features/warehouse/mobile/WarehouseMobileHome.tsx');
  assert.match(mobileHome, /data-testid="operator-mobile-back-emprovex"/);
  assert.match(mobileHome, /href="\/central-empenhos"/);
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
  for (const hiddenPrice of ['39,90', '49,90', '59,90', '69,90']) {
    assert.doesNotMatch(html, new RegExp('R\\$ ' + hiddenPrice));
  }
  assert.doesNotMatch(html, /value-ramp|value-commercial-note|evolução da mensalidade|evolução trimestral/i);
  assert.doesNotMatch(html, /valor progride|três meses de assinatura paga|13º mês pago/i);
  assert.doesNotMatch(css, /\\.value-ramp|\\.value-commercial-note/);
  assert.match(html, /href="#acesso">Solicitar meu teste acompanhado/);
  assert.match(css, /\.value-faq-item/);
  assert.match(css, /prefers-reduced-motion/);
});

// Release regression: apenas HTML operacional deve evitar cache; imagens e chunks
// continuam com nomes versionados e cache padrao para nao aumentar custos.
test('Cloud Run R1: entrada canonica HTML dinamica e sem cache no Next e Hosting', () => {
  const entry = source('app/central-empenhos/page.tsx');
  const nextConfig = source('next.config.ts');
  const hosting = JSON.parse(source('ops/cloud-run-hosting/firebase.json'));
  assert.match(entry, /export const dynamic = 'force-dynamic';/);
  assert.match(entry, /export const revalidate = 0;/);
  assert.match(entry, /export \{ default \} from '\.\.\/login\/page';/);
  assert.match(nextConfig, /source: '\/central-empenhos',[\s\S]*?Cache-Control',[^\n]*?private, no-store, max-age=0, must-revalidate/);
  const rule = hosting.hosting.headers.find(x => x.source === '/central-empenhos');
  assert.ok(rule, 'Firebase Hosting sem regra da rota autenticada');
  assert.equal(rule.headers.find(x => x.key === 'Cache-Control')?.value, 'private, no-store, max-age=0, must-revalidate');
  assert.ok(!hosting.hosting.headers.some(x => /_next/.test(x.source)), 'nao alterar cache de assets _next');
  assert.equal(hosting.hosting.rewrites[0].run.serviceId, 'emprovex-cloudrun-candidate');
  assert.equal(hosting.hosting.rewrites[0].run.region, 'southamerica-east1');
});

test('P0 admin: HTML dinâmico e cache privado em Cloud Run + Hosting', () => {
  const adminLayout = source('app/admin/layout.tsx');
  const adminPage = source('app/admin/page.tsx');
  const hosting = JSON.parse(source('ops/cloud-run-hosting/firebase.json'));
  assert.match(adminLayout, /export const dynamic = 'force-dynamic';/);
  assert.match(adminLayout, /export const revalidate = 0;/);
  assert.match(adminLayout, /return children;/);
  assert.match(adminPage, /resolveWorkspaceContext\(user\?\.email\)/, 'Não trocar autorização fundadora');
  assert.match(adminPage, /context\.status !== 'platformAdmin'/, 'Não remover a guarda do admin');

  const nextConfig = source('next.config.ts');
  for (const route of ['/admin', '/admin/:path*']) {
    const sourceRoute = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(nextConfig, new RegExp("source: '" + sourceRoute + "',[\\s\\S]*?Cache-Control',[^\\n]*?private, no-store, max-age=0, must-revalidate"));
  }
  for (const route of ['/admin', '/admin/**']) {
    const rule = hosting.hosting.headers.find(entry => entry.source === route);
    assert.equal(rule?.headers.find(entry => entry.key === 'Cache-Control')?.value,
      'private, no-store, max-age=0, must-revalidate', route + ': no-store obrigatório');
  }
  assert.equal(hosting.hosting.rewrites[0].run.serviceId, 'emprovex-cloudrun-candidate');
  assert.ok(!hosting.hosting.headers.some(entry => /_next/.test(entry.source)),
    'Assets de versão continuam com cache imutável');
});

test('P0 Cloud Run: arquivos JS/CSS de versões antigas permanecem disponíveis entre revisões', () => {
  const stage = source('.github/workflows/emprovex-cloud-run-stage.yml');
  const promotion = source('.github/workflows/emprovex-cloud-run-promote.yml');
  const extraction = source('scripts/ops/retain-legacy-next-assets.sh');
  const overlay = source('ops/cloud-run/Dockerfile.legacy-static');
  const dockerfile = source('Dockerfile');

  assert.ok(stage.indexOf('Build the existing production Dockerfile (no Google credentials)') <
    stage.indexOf('Obtain temporary Google credentials through Workload Identity Federation'),
    'Build do aplicativo deve continuar sem credenciais de produção');
  assert.ok(stage.indexOf('Preserve prior Next.js CSS and JS') <
    stage.indexOf('Push immutable SHA-tagged image'), 'Arquivamento precede publicação da imagem');
  assert.match(stage, /retain-legacy-next-assets\.sh/);
  assert.match(stage, /Dockerfile\.legacy-static/);
  assert.match(stage, /page-90bf4e32d0dfc3aa\.js/);
  assert.match(stage, /3ebef08104e37cca\.css/);
  assert.match(promotion, /page-90bf4e32d0dfc3aa\.js/);
  assert.match(promotion, /3ebef08104e37cca\.css/);
  assert.ok(promotion.indexOf('prod-static.headers') <
    promotion.indexOf('finished=1'), 'Rollback permanece ativo até validar JS e CSS no domínio');
  assert.match(extraction, /gcloud run revisions list/);
  assert.match(extraction, /docker pull/);
  assert.match(extraction, /docker cp/);
  assert.match(extraction, /test -s "\$target_dir\/chunks\/app\/admin\/page-90bf4e32d0dfc3aa\.js"/);
  assert.match(extraction, /test -s "\$target_dir\/css\/3ebef08104e37cca\.css"/);
  assert.match(overlay, /COPY --chown=node:node legacy-next-static\/ \/app\/\.next\/static\//);
  assert.match(dockerfile, /COPY --chown=node:node --from=builder \/app\/\.next\/static \.\/\.next\/static/);
  assert.match(source('.dockerignore'), /gha-creds-\*\.json/);
});
