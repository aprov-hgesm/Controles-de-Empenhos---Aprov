import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const PAGE_PATH = 'app/page.tsx';
const VIEW_PATH = 'features/cronogramas/components/CronogramasView.tsx';

let source = fs.readFileSync(PAGE_PATH, 'utf8');
const originalLineCount = source.split('\n').length;

const startNeedle = "{activeTab === 'cronogramas' && (";
const nextMarker = '{/* Modal de Confirmação de Exclusão de Empenho Específico */}';
const start = source.indexOf(startNeedle);
if (start < 0) throw new Error('Bloco de Cronogramas não encontrado.');
const markerIndex = source.indexOf(nextMarker, start);
if (markerIndex < 0) throw new Error('Marcador após Cronogramas não encontrado.');

const block = source.slice(start, markerIndex).trimEnd();
if (!block.endsWith(')}')) throw new Error(`Final inesperado do bloco de Cronogramas: ${block.slice(-160)}`);

const andIndex = block.indexOf('&&');
let expression = block.slice(andIndex + 2).trim();
expression = expression.slice(0, -1).trim();

const parsedExpression = ts.createSourceFile(
  'cronogramas-expression.tsx',
  `const __view = ${expression};`,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const declaration = parsedExpression.statements[0]?.declarationList?.declarations?.[0];
const initializer = declaration?.initializer;
if (!initializer || parsedExpression.parseDiagnostics.length) {
  throw new Error(`Não foi possível analisar a expressão de Cronogramas: ${parsedExpression.parseDiagnostics.map(d => d.messageText).join('; ')}`);
}

const declared = new Set();
const used = new Set();
function addBindingName(name) {
  if (ts.isIdentifier(name)) { declared.add(name.text); return; }
  for (const element of name.elements || []) {
    if (!ts.isOmittedExpression(element)) addBindingName(element.name);
  }
}
function collectDeclarations(node) {
  if (ts.isVariableDeclaration(node)) addBindingName(node.name);
  if (ts.isParameter(node)) addBindingName(node.name);
  if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isClassDeclaration(node) || ts.isClassExpression(node)) && node.name) declared.add(node.name.text);
  if (ts.isCatchClause(node) && node.variableDeclaration) addBindingName(node.variableDeclaration.name);
  ts.forEachChild(node, collectDeclarations);
}
function isDeclarationIdentifier(node) {
  const p = node.parent;
  return (ts.isVariableDeclaration(p) && p.name === node)
    || (ts.isParameter(p) && p.name === node)
    || (ts.isBindingElement(p) && p.name === node)
    || (((ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isClassDeclaration(p) || ts.isClassExpression(p))) && p.name === node);
}
function isNonValueIdentifier(node) {
  const p = node.parent;
  if (isDeclarationIdentifier(node)) return true;
  if (ts.isPropertyAccessExpression(p) && p.name === node) return true;
  if (ts.isPropertyAssignment(p) && p.name === node && !ts.isShorthandPropertyAssignment(p)) return true;
  if (ts.isBindingElement(p) && p.propertyName === node) return true;
  if (ts.isPropertySignature(p) && p.name === node) return true;
  if (ts.isPropertyDeclaration(p) && p.name === node) return true;
  if (ts.isMethodSignature(p) && p.name === node) return true;
  if (ts.isMethodDeclaration(p) && p.name === node) return true;
  if (ts.isJsxAttribute(p) && p.name === node) return true;
  if (ts.isTypeReferenceNode(p) && p.typeName === node) return true;
  if (ts.isQualifiedName(p) && p.right === node) return true;
  if (ts.isTypeParameterDeclaration(p) && p.name === node) return true;
  if (ts.isInterfaceDeclaration(p) && p.name === node) return true;
  if (ts.isTypeAliasDeclaration(p) && p.name === node) return true;
  if ((ts.isJsxOpeningElement(p) || ts.isJsxClosingElement(p) || ts.isJsxSelfClosingElement(p)) && p.tagName === node && /^[a-z]/.test(node.text)) return true;
  return false;
}
function collectUses(node) {
  if (ts.isIdentifier(node) && !isNonValueIdentifier(node)) used.add(node.text);
  ts.forEachChild(node, collectUses);
}
collectDeclarations(initializer);
collectUses(initializer);

const globals = new Set([
  'Array','Boolean','Date','Error','Infinity','Intl','JSON','Map','Math','NaN','Number','Object','Promise','RegExp','Set','String','Symbol','WeakMap','WeakSet',
  'console','document','navigator','undefined','window','confirm','parseFloat','parseInt','isNaN','setTimeout','clearTimeout'
]);

const pageAst = ts.createSourceFile(PAGE_PATH, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const imported = new Map();
for (const stmt of pageAst.statements) {
  if (!ts.isImportDeclaration(stmt) || !stmt.importClause || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;
  const module = stmt.moduleSpecifier.text;
  const clause = stmt.importClause;
  if (clause.name) imported.set(clause.name.text, { module, kind: 'default', imported: 'default' });
  const bindings = clause.namedBindings;
  if (bindings && ts.isNamespaceImport(bindings)) {
    imported.set(bindings.name.text, { module, kind: 'namespace', imported: '*' });
  } else if (bindings && ts.isNamedImports(bindings)) {
    for (const spec of bindings.elements) {
      imported.set(spec.name.text, { module, kind: 'named', imported: spec.propertyName?.text || spec.name.text });
    }
  }
}

const free = [...used]
  .filter((name) => !declared.has(name) && !globals.has(name) && name !== '__view')
  .sort((a, b) => a.localeCompare(b));
const directImportNames = free.filter((name) => imported.has(name));
const contextNames = free.filter((name) => !imported.has(name));

function adjustModule(specifier) {
  if (!specifier.startsWith('.')) return specifier;
  const absoluteLike = path.posix.normalize(path.posix.join(path.posix.dirname(PAGE_PATH), specifier));
  let relative = path.posix.relative(path.posix.dirname(VIEW_PATH), absoluteLike);
  if (!relative.startsWith('.')) relative = `./${relative}`;
  return relative;
}

const importGroups = new Map();
for (const name of directImportNames) {
  const meta = imported.get(name);
  const module = adjustModule(meta.module);
  if (!importGroups.has(module)) importGroups.set(module, { defaults: [], namespaces: [], named: [] });
  const group = importGroups.get(module);
  if (meta.kind === 'default') group.defaults.push(name);
  else if (meta.kind === 'namespace') group.namespaces.push(name);
  else group.named.push({ local: name, imported: meta.imported });
}

const importLines = ["'use client';", '', "import React from 'react';"];
for (const [module, group] of [...importGroups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  for (const name of group.defaults) {
    if (name !== 'React') importLines.push(`import ${name} from '${module}';`);
  }
  for (const name of group.namespaces) importLines.push(`import * as ${name} from '${module}';`);
  if (group.named.length) {
    const specs = group.named
      .sort((a, b) => a.local.localeCompare(b.local))
      .map(({ local, imported }) => imported === local ? local : `${imported} as ${local}`)
      .join(', ');
    importLines.push(`import { ${specs} } from '${module}';`);
  }
}
importLines.push("import type { CronogramaEmpenho, CronogramaEntregaColuna, Empenho } from '../../../lib/types';", '');

const typeFor = (name) => {
  if (name === 'empenhos') return 'Empenho[]';
  if (name === 'cronogramas') return 'CronogramaEmpenho[]';
  if (name === 'cronogramaColunas') return 'CronogramaEntregaColuna[]';
  if (name === 'selectedCronogramaEmpenhoId') return 'string | null';
  if (name === 'cronogramasSearch' || name === 'cronogramasPregaoFilter' || name === 'cronogramasYearFilter' || name === 'cronogramasClassFilter' || name === 'cronogramaLocalEntrega' || name === 'cronogramaHorarioEntrega' || name === 'cronogramaObservacoes' || name === 'cronogramaResponsavelNome' || name === 'cronogramaResponsavelCargo') return 'string';
  if (name === 'cronogramasStatusFilter') return "'Todos' | 'Com Saldo' | 'Ativos' | 'Encerrados'";
  if (name === 'cronogramaDistribuicao') return '{ [itemId: string]: { [colunaId: string]: number } }';
  if (name === 'showCronogramaPreviewModal' || name === 'isSavingCronograma') return 'boolean';
  if (name === 'uniquePregaos' || name === 'uniqueEmpenhoYears') return 'string[]';
  if (/^set[A-Z]/.test(name) || /^handle[A-Z]/.test(name) || name === 'showToast') return '(...args: any[]) => any';
  return 'any';
};

const contextInterface = [
  'interface CronogramasViewContext {',
  ...contextNames.map(name => `  ${name}: ${typeFor(name)};`),
  '}',
  '',
  'interface CronogramasViewProps {',
  '  context: CronogramasViewContext;',
  '}',
  '',
].join('\n');

const viewFile = `${importLines.join('\n')}\n${contextInterface}/** Tela de Cronogramas extraída sem alterar regras de negócio, persistência ou comportamento. */\nexport function CronogramasView({ context }: CronogramasViewProps) {\n  const { ${contextNames.join(', ')} } = context;\n  return ${expression};\n}\n`;
fs.mkdirSync(path.posix.dirname(VIEW_PATH), { recursive: true });
fs.writeFileSync(VIEW_PATH, viewFile);

const viewImport = "import { CronogramasView } from '../features/cronogramas/components/CronogramasView';\n";
const importAnchor = "import { ItensEmpenhoView } from '../features/empenhos/components/ItensEmpenhoView';\n";
if (!source.includes(viewImport)) {
  if (!source.includes(importAnchor)) throw new Error('Âncora de importação ItensEmpenhoView não encontrada.');
  source = source.replace(importAnchor, importAnchor + viewImport);
}

const replacementStart = source.indexOf(startNeedle);
if (replacementStart < 0) throw new Error('Bloco de Cronogramas desapareceu após inserir import.');
const replacementMarkerIndex = source.indexOf(nextMarker, replacementStart);
if (replacementMarkerIndex < 0) throw new Error('Marcador após Cronogramas desapareceu após inserir import.');
const replacement = `{activeTab === 'cronogramas' && (\n            <CronogramasView context={{ ${contextNames.join(', ')} }} />\n          )}\n\n          `;
source = source.slice(0, replacementStart) + replacement + source.slice(replacementMarkerIndex);

const verificationAst = ts.createSourceFile(PAGE_PATH, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
if (verificationAst.parseDiagnostics.length) {
  throw new Error(`Guardrail sintático do page.tsx falhou: ${verificationAst.parseDiagnostics.map(d => d.messageText).join('; ')}`);
}
const newLineCount = source.split('\n').length;
if (newLineCount < 2500 || newLineCount >= originalLineCount) throw new Error(`Guardrail: contagem de linhas inesperada (${originalLineCount} -> ${newLineCount}).`);
if (!source.includes(nextMarker)) throw new Error('Guardrail: modal de exclusão de empenho desapareceu.');
if (!source.includes("activeTab === 'itens_empenho'")) throw new Error('Guardrail: aba Itens do Empenho desapareceu.');
if (!source.includes('Mobile Bottom Navigation Bar')) throw new Error('Guardrail: navegação mobile desapareceu.');

fs.writeFileSync(PAGE_PATH, source);
console.log(`Cronogramas extraído com ${free.length} dependências livres, ${directImportNames.length} imports diretos e ${contextNames.length} props de contexto.`);
console.log(`Contexto: ${contextNames.join(', ')}`);
console.log(`Imports diretos: ${directImportNames.join(', ')}`);
console.log(`page.tsx: ${originalLineCount} -> ${newLineCount} linhas.`);
console.log(`Novo componente: ${VIEW_PATH}`);
