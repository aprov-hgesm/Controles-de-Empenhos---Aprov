import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

function compiledExports(path, imports = () => { throw Error('Unexpected import'); }) {
  const output = ts.transpileModule(read(path), {
    fileName: path,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
    reportDiagnostics: true,
  });
  assert.equal(output.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length ?? 0, 0);
  const context = { module: { exports: {} }, require: imports };
  context.exports = context.module.exports;
  runInNewContext(output.outputText, context, { filename: path });
  return context.module.exports;
}

const catalog = compiledExports('features/support/tutorialCatalog.ts');

test('14 vídeos oficiais, sequência e allowlist da landing preservados sem invenções', () => {
  const html = read('public/institucional/content.html');
  const js = read('public/institucional/site.js');
  const htmlIds = [...html.matchAll(/data-video-id="([\w-]{11})"/g)].map(match => match[1]);
  const list = js.match(/const allowedVideos=new Set\(\[([^\]]+)\]\)/);
  assert.ok(list, 'allowlist oficial não encontrada');
  const allowedIds = [...list[1].matchAll(/'([\w-]{11})'/g)].map(match => match[1]);
  const official = catalog.SUPPORT_TUTORIALS;
  assert.equal(official.length, 14);
  assert.deepEqual(official.map(t => t.number), Array.from({ length: 14 }, (_, i) => i + 1));
  assert.equal(new Set(official.map(t => t.youtubeId)).size, 14);
  assert.equal(new Set(htmlIds).size, 14);
  assert.deepEqual([...htmlIds].sort(), official.map(t => t.youtubeId).sort());
  assert.deepEqual([...allowedIds].sort(), official.map(t => t.youtubeId).sort());
  for (const tutorial of official) {
    assert.match(tutorial.youtubeId, /^[\w-]{11}$/);
    assert.ok(html.includes('data-video-id="' + tutorial.youtubeId + '"'));
    assert.ok(html.includes('data-video-title="' + tutorial.title + '"'), 'título divergente: ' + tutorial.number);
  }
});

test('filtragem determinística, acentos, tópicos e vazio', () => {
  assert.equal(catalog.filterSupportTutorials('').length, 14);
  assert.equal(catalog.filterSupportTutorials('VALIDADE').length, 1);
  assert.equal(catalog.filterSupportTutorials('relatorio').length, 1);
  assert.equal(catalog.filterSupportTutorials('saldo').length, 2);
  assert.equal(catalog.filterSupportTutorials('fornecedores').length, 2);
  assert.equal(catalog.filterSupportTutorials('', 'depositos').length, 5);
  assert.equal(catalog.filterSupportTutorials('nota', 'depositos').length, 0);
  assert.equal(catalog.filterSupportTutorials('termo de recebimento')[0]?.number, 8);
  assert.equal(catalog.filterSupportTutorials('inexistente').length, 0);
});

test('URLs do YouTube derivam somente de IDs do catálogo', () => {
  const item = catalog.SUPPORT_TUTORIALS[0];
  assert.equal(catalog.getSupportVideoUrl(item.youtubeId), 'https://www.youtube.com/watch?v=' + item.youtubeId);
  assert.equal(catalog.getSupportVideoUrl(item.youtubeId, true), 'https://www.youtube-nocookie.com/embed/' + item.youtubeId + '?rel=0&playsinline=1');
  for (const invalid of ['bad', 'AAAAAAAAAAA', 'x/../other', 'https://evil', '', 'javascript:']) {
    assert.equal(catalog.getSupportVideoUrl(invalid, true), null);
  }
});

test('servidor renderiza ajuda sem iframe, fetch ou dependência de Firebase', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const view = compiledExports('features/support/EmprovexHelpCenter.tsx', name => {
    if (name === 'react') return React;
    if (name === 'react/jsx-runtime') return require(name);
    if (name === './tutorialCatalog') return catalog;
    throw Error('Dependência não permitida: ' + name);
  });
  const html = renderToStaticMarkup(React.createElement(view.EmprovexHelpCenter, {}));
  assert.doesNotMatch(html, /<iframe\b/i);
  assert.match(html, /Ajuda \/ Academia EMPROVEX/);
  assert.match(html, /type="search"/);
  assert.match(html, /grid-cols-1/);
  assert.match(html, /sm:grid-cols-2/);
  assert.match(html, /Operador Móvel/);
  assert.match(html, /mailto:aprov1hgesm@gmail.com/);
  assert.equal((html.match(/Assistir tutorial /g) ?? []).length, 14);
  const custom = renderToStaticMarkup(React.createElement(view.EmprovexHelpCenter, {
    initialTopic: 'depositos',
    supportContact: 'atendimento@exemplo.com',
  }));
  assert.equal((custom.match(/Assistir tutorial /g) ?? []).length, 5);
  assert.match(custom, /mailto:atendimento@exemplo.com/);
});

test('player sob demanda, controle de fechamento e isolamento dos shells', () => {
  const source = read('features/support/EmprovexHelpCenter.tsx');
  assert.match(source, /useState<SupportTutorial \| null>\(null\)/);
  assert.match(source, /playing && videoUrl && originalUrl &&/);
  assert.match(source, /<iframe/);
  assert.match(source, /onClick=\{event => \{/);
  assert.match(source, /setPlaying\(tutorial\)/);
  assert.match(source, /onClick=\{closePlayer\}/);
  assert.match(source, /onChange=\{event => setSearch\(event.target.value\)\}/);
  assert.match(source, /aria-pressed=\{topic === item.id\}/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /className="aspect-video/);
  assert.doesNotMatch(source, /from ['"][^'"]*(firebase|firestore|auth|billing)/i);
  assert.doesNotMatch(source, /fetch\s*\(|setInterval\s*\(/);
  for (const file of ['components/layout/AppSidebar.tsx', 'features/warehouse/components/WarehouseSidebar.tsx']) {
    assert.doesNotMatch(read(file), /EmprovexHelpCenter/, 'montagem reservada ao W4');
  }
});
