#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

const shell = read('features/warehouse/components/WarehouseModuleShell.tsx');
const sidebar = read('features/warehouse/components/WarehouseSidebar.tsx');
const tabs = read('features/warehouse/components/WarehouseTabNavigation.tsx');
const surface = read('features/warehouse/components/WarehouseTabContent.tsx');
const landing = read('features/warehouse/components/WarehouseLandingOperational.tsx');
const home = read('features/warehouse/components/WarehouseHomeOperational.tsx');
const sections = read('features/warehouse/components/WarehouseSectionContent.tsx');
const routes = read('features/warehouse/navigation.ts');

assert.match(shell, /useState<WarehouseSectionId>/, 'As abas devem ter estado local.');
assert.match(shell, /setActiveSectionId\(target\.id\)/, 'Navegação precisa trocar estado sem aguardar fetch.');
assert.match(shell, /renderLocalSection = isPrimaryRoute &&/, 'Apenas rotas principais são interceptadas pelo shell.');
assert.match(shell, /hasLocalTabNavigation \|\| activeSection\.id !== routeSection\.id/, 'Navegação local e redirecionamento Essencial preservam a seção ativa.');
assert.match(shell, /setHasLocalTabNavigation\(true\)/, 'Troca de abas ativa a superfície local persistente.');
assert.match(shell, /window\.history\.pushState\(/, 'URLs precisam acompanhar o estado local.');
assert.match(shell, /addEventListener\('popstate'/, 'Voltar/avançar deve restaurar aba.');
assert.match(shell, /WarehouseTabNavigationProvider/, 'As ações internas devem usar o mesmo padrão.');
assert.match(shell, /<WarehouseTabContent/, 'A seção ativa deve ser exibida pelo shell.');
assert.match(shell, /\{children\}/, 'Aliases legados não podem perder seus redirects.');
assert.doesNotMatch(shell, /router\.(?:push|replace|refresh)\(/, 'Navegação principal não pode depender do router Next.');

assert.match(sidebar, /<button/, 'Abas devem ser botões, como na página principal.');
assert.match(sidebar, /onNavigate\(item\.href\)/, 'Botões acionam a navegação local.');
assert.match(sidebar, /aria-current=\{active \? 'page'/, 'Indicação da aba ativa preservada.');
assert.match(tabs, /event\.preventDefault\(\);\s*navigate\(href\)/, 'Links internos usam troca local.');
assert.match(tabs, /event\.metaKey/, 'Abertura em nova aba deve continuar disponível.');
assert.match(surface, /WarehouseSectionContent/, 'Reuso dos mesmos módulos operacionais.');
assert.match(landing, /useWarehouseTabNavigation/, 'Atalhos da entrada precisam usar a navegação local.');
assert.doesNotMatch(landing, /router\.push\(/, 'Atalhos não devem iniciar nova transição de rota.');
assert.match(home, /WarehouseTabLink/, 'Atalhos para croquis precisam usar a mesma navegação.');
assert.match(sections, /dynamic\(/, 'Manter carregamento sob demanda.');
assert.match(sections, /WarehouseSectionLoading/, 'Abertura de módulo deve ter feedback.');
for (const href of [
  '/central-depositos', '/central-depositos/meus-depositos',
  '/central-depositos/cadastro-de-itens', '/central-depositos/saida-de-material',
  '/central-depositos/controle-de-depositos', '/central-depositos/controle-de-itens',
]) assert.ok(routes.includes("href: '" + href + "'"), 'URL canônica perdida: ' + href);
assert.match(read('features/warehouse/components/WarehouseProtectedSurface.tsx'), /WarehouseAccessBoundary/);
assert.match(read('app/central-depositos/layout.tsx'), /WarehouseProtectedLayout/);

console.log('WAREHOUSE REACT TAB NAVIGATION: PASS — estado local, URL, histórico, guard e lazy loading preservados.');
