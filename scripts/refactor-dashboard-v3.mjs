import fs from 'node:fs';
import ts from 'typescript';

const PAGE_PATH = 'app/page.tsx';
const DASHBOARD_PATH = 'features/dashboard/components/DashboardView.tsx';

let source = fs.readFileSync(PAGE_PATH, 'utf8');

const startNeedle = "{activeTab === 'painel' && (() => {";
const nextMarker = '{/* TAB 2: LISTA DE EMPENHOS / NOTAS DE EMPENHO */}';

const start = source.indexOf(startNeedle);
if (start < 0) throw new Error('Bloco do Dashboard não encontrado.');
const markerIndex = source.indexOf(nextMarker, start);
if (markerIndex < 0) throw new Error('Marcador da próxima aba não encontrado.');

const blockEnd = source.lastIndexOf('\n', markerIndex);
const block = source.slice(start, blockEnd).trimEnd();
if (!block.endsWith('})()}')) {
  throw new Error(`Final inesperado do Dashboard: ${block.slice(-40)}`);
}

const andIndex = block.indexOf('&&');
let expression = block.slice(andIndex + 2).trim();
expression = expression.slice(0, -1).trim(); // remove a chave externa do JSX expression

const parsed = ts.createSourceFile(
  'dashboard-expression.tsx',
  `const __dashboard = ${expression};`,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const declaration = parsed.statements[0]?.declarationList?.declarations?.[0];
const initializer = declaration?.initializer;
if (!initializer) throw new Error('Não foi possível analisar a expressão do Dashboard.');

const declared = new Set();
const used = new Set();

function addBindingName(name) {
  if (ts.isIdentifier(name)) {
    declared.add(name.text);
    return;
  }
  for (const element of name.elements || []) {
    if (ts.isOmittedExpression(element)) continue;
    addBindingName(element.name);
  }
}

function collectDeclarations(node) {
  if (ts.isVariableDeclaration(node)) addBindingName(node.name);
  if (ts.isParameter(node)) addBindingName(node.name);
  if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isClassDeclaration(node) || ts.isClassExpression(node)) && node.name) {
    declared.add(node.name.text);
  }
  if (ts.isCatchClause(node) && node.variableDeclaration) addBindingName(node.variableDeclaration.name);
  ts.forEachChild(node, collectDeclarations);
}

function isDeclarationIdentifier(node) {
  const p = node.parent;
  return (
    (ts.isVariableDeclaration(p) && p.name === node) ||
    (ts.isParameter(p) && p.name === node) ||
    (ts.isBindingElement(p) && p.name === node) ||
    ((ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isClassDeclaration(p) || ts.isClassExpression(p)) && p.name === node)
  );
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

  if (
    (ts.isJsxOpeningElement(p) || ts.isJsxClosingElement(p) || ts.isJsxSelfClosingElement(p)) &&
    p.tagName === node &&
    /^[a-z]/.test(node.text)
  ) return true;

  return false;
}

function collectUses(node) {
  if (ts.isIdentifier(node) && !isNonValueIdentifier(node)) used.add(node.text);
  ts.forEachChild(node, collectUses);
}

collectDeclarations(initializer);
collectUses(initializer);

const globals = new Set([
  'Array', 'Boolean', 'Date', 'Error', 'Infinity', 'Intl', 'JSON', 'Map', 'Math', 'NaN',
  'Number', 'Object', 'Promise', 'RegExp', 'Set', 'String', 'Symbol', 'WeakMap', 'WeakSet',
  'console', 'document', 'navigator', 'undefined', 'window',
]);

const free = [...used]
  .filter((name) => !declared.has(name) && !globals.has(name) && name !== '__dashboard')
  .sort((a, b) => a.localeCompare(b));

if (free.length === 0) throw new Error('Nenhuma dependência externa detectada para o Dashboard.');

const dashboardFile = `'use client';\n\nimport React from 'react';\n\ninterface DashboardViewProps {\n  context: Record<string, any>;\n}\n\n/**\n * Dashboard operacional extraído do page.tsx sem alterar regras, cálculos ou interações.\n * O contexto explícito mantém este primeiro corte de modularização conservador; os domínios\n * serão tipados e desacoplados progressivamente nos próximos blocos.\n */\nexport function DashboardView({ context }: DashboardViewProps) {\n  const { ${free.join(', ')} } = context;\n  return ${expression};\n}\n`;

fs.mkdirSync('features/dashboard/components', { recursive: true });
fs.writeFileSync(DASHBOARD_PATH, dashboardFile);

const dashboardImport = "import { DashboardView } from '../features/dashboard/components/DashboardView';\n";
const importAnchor = "import { ToastNotification } from '../components/layout/ToastNotification';\n";
if (!source.includes(dashboardImport)) {
  if (!source.includes(importAnchor)) throw new Error('Âncora de import do Dashboard não encontrada.');
  source = source.replace(importAnchor, importAnchor + dashboardImport);
}

const replacement = `{activeTab === 'painel' && (\n            <DashboardView context={{ ${free.join(', ')} }} />\n          )}`;
source = source.slice(0, start) + replacement + source.slice(blockEnd);
fs.writeFileSync(PAGE_PATH, source);

console.log(`Dashboard extraído com ${free.length} dependências explícitas.`);
console.log(`Dependências: ${free.join(', ')}`);
console.log(`page.tsx agora possui ${source.split('\\n').length} linhas.`);
console.log(`Novo componente: ${DASHBOARD_PATH}`);
