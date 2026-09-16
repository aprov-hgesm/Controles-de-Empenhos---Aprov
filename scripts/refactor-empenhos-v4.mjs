import fs from 'node:fs';
import ts from 'typescript';

const PAGE_PATH = 'app/page.tsx';
const VIEW_PATH = 'features/empenhos/components/EmpenhosView.tsx';

let source = fs.readFileSync(PAGE_PATH, 'utf8');
const originalLineCount = source.split('\n').length;

const startNeedle = "{activeTab === 'empenhos' && (";
const nextMarker = '{/* CONSULTA CONSOLIDADA DE ITENS */}';
const start = source.indexOf(startNeedle);
if (start < 0) throw new Error('Bloco de Empenhos não encontrado.');
const markerIndex = source.indexOf(nextMarker, start);
if (markerIndex < 0) throw new Error('Marcador da Consulta de Itens não encontrado.');

const blockEnd = source.lastIndexOf('\n', markerIndex);
const block = source.slice(start, blockEnd).trimEnd();
if (!block.endsWith(')}')) throw new Error(`Final inesperado do bloco de Empenhos: ${block.slice(-80)}`);

const andIndex = block.indexOf('&&');
let expression = block.slice(andIndex + 2).trim();
expression = expression.slice(0, -1).trim();

const parsed = ts.createSourceFile('empenhos-expression.tsx', `const __view = ${expression};`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declaration = parsed.statements[0]?.declarationList?.declarations?.[0];
const initializer = declaration?.initializer;
if (!initializer) throw new Error('Não foi possível analisar a expressão de Empenhos.');

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
  return (ts.isVariableDeclaration(p) && p.name === node) || (ts.isParameter(p) && p.name === node) || (ts.isBindingElement(p) && p.name === node) || (((ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isClassDeclaration(p) || ts.isClassExpression(p))) && p.name === node);
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

const globals = new Set(['Array','Boolean','Date','Error','Infinity','Intl','JSON','Map','Math','NaN','Number','Object','Promise','RegExp','Set','String','Symbol','WeakMap','WeakSet','console','document','navigator','undefined','window','confirm']);
const free = [...used].filter((name) => !declared.has(name) && !globals.has(name) && name !== '__view').sort((a,b) => a.localeCompare(b));
if (!free.length) throw new Error('Nenhuma dependência externa detectada.');

const iconNames = ['AlertCircle','ArrowLeft','Braces','Calendar','Camera','Check','CheckCircle2','ChevronDown','ChevronRight','ChevronUp','Coins','Copy','Edit','Eye','FileDown','FileSpreadsheet','FileText','Filter','ImageIcon','Info','Layers','Package','Plus','Printer','RefreshCw','Save','Search','Sparkles','Trash2','Upload','X'].filter((n) => free.includes(n));
const nonIconFree = free.filter((n) => !iconNames.includes(n) && n !== 'EmpenhoDocumentActions');

const imports = [
  "'use client';",
  '',
  "import React from 'react';",
  ...(iconNames.length ? [`import { ${iconNames.map(n => n === 'ImageIcon' ? 'Image as ImageIcon' : n).join(', ')} } from 'lucide-react';`] : []),
  ...(free.includes('EmpenhoDocumentActions') ? ["import { EmpenhoDocumentActions } from '../../../components/EmpenhoDocumentActions';"] : []),
  '',
].join('\n');

const viewFile = `${imports}interface EmpenhosViewProps {\n  context: Record<string, any>;\n}\n\n/** Tela de cadastro e detalhe de empenhos extraída sem alterar comportamento. */\nexport function EmpenhosView({ context }: EmpenhosViewProps) {\n  const { ${nonIconFree.join(', ')} } = context;\n  return ${expression};\n}\n`;
fs.mkdirSync('features/empenhos/components', { recursive: true });
fs.writeFileSync(VIEW_PATH, viewFile);

const viewImport = "import { EmpenhosView } from '../features/empenhos/components/EmpenhosView';\n";
const importAnchor = "import { DashboardView } from '../features/dashboard/components/DashboardView';\n";
if (!source.includes(viewImport)) source = source.replace(importAnchor, importAnchor + viewImport);

const replacement = `{activeTab === 'empenhos' && (\n            <EmpenhosView context={{ ${nonIconFree.join(', ')} }} />\n          )}`;
source = source.slice(0, start) + replacement + source.slice(blockEnd);

const newLineCount = source.split('\n').length;
if (newLineCount < 1000 || newLineCount >= originalLineCount) throw new Error(`Guardrail: contagem de linhas inesperada (${originalLineCount} -> ${newLineCount}).`);
if (!source.includes(nextMarker)) throw new Error('Guardrail: marcador da Consulta de Itens desapareceu.');
if (!source.includes("activeTab === 'itens'")) throw new Error('Guardrail: aba Consulta de Itens desapareceu.');
if (!source.includes("activeTab === 'nova_nf'")) throw new Error('Guardrail: aba Notas Fiscais desapareceu.');

fs.writeFileSync(PAGE_PATH, source);
console.log(`Empenhos extraído com ${free.length} dependências livres.`);
console.log(`Dependências: ${free.join(', ')}`);
console.log(`page.tsx: ${originalLineCount} -> ${newLineCount} linhas.`);
console.log(`Novo componente: ${VIEW_PATH}`);
