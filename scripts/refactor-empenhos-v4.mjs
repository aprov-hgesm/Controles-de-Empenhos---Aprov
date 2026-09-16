import fs from 'node:fs';
import ts from 'typescript';

const PAGE_PATH = 'app/page.tsx';
const VIEW_PATH = 'features/empenhos/components/EmpenhosView.tsx';

let source = fs.readFileSync(PAGE_PATH, 'utf8');
const originalLineCount = source.split('\n').length;

const startNeedle = "{activeTab === 'empenhos' && (";
const nextMarker = '{/* TAB 3: GESTÃO DE NOTAS FISCAIS */}';
const start = source.indexOf(startNeedle);
if (start < 0) throw new Error('Bloco de Empenhos não encontrado.');
const markerIndex = source.indexOf(nextMarker, start);
if (markerIndex < 0) throw new Error('Marcador da aba Notas Fiscais não encontrado.');

const blockEnd = source.lastIndexOf('\n', markerIndex);
const block = source.slice(start, blockEnd).trimEnd();
if (!block.endsWith(')}')) throw new Error(`Final inesperado do bloco de Empenhos: ${block.slice(-80)}`);

const andIndex = block.indexOf('&&');
let expression = block.slice(andIndex + 2).trim();
expression = expression.slice(0, -1).trim();

const parsed = ts.createSourceFile('empenhos-expression.tsx', `const __view = ${expression};`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declaration = parsed.statements[0]?.declarationList?.declarations?.[0];
const initializer = declaration?.initializer;
if (!initializer || parsed.parseDiagnostics.length) {
  throw new Error(`Não foi possível analisar a expressão de Empenhos: ${parsed.parseDiagnostics.map(d => d.messageText).join('; ')}`);
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

const globals = new Set(['Array','Boolean','Date','Error','Infinity','Intl','JSON','Map','Math','NaN','Number','Object','Promise','RegExp','Set','String','Symbol','WeakMap','WeakSet','console','document','navigator','undefined','window','confirm','parseFloat']);
const free = [...used].filter((name) => !declared.has(name) && !globals.has(name) && name !== '__view').sort((a,b) => a.localeCompare(b));

const iconNames = ['AlertCircle','AlertTriangle','ArrowLeft','Braces','Calendar','CalendarDays','Camera','Check','CheckCircle2','ChevronDown','ChevronRight','ChevronUp','Coins','Copy','Edit','Eye','FileDown','FileSpreadsheet','FileText','Filter','ImageIcon','Info','Layers','Package','Plus','Printer','RefreshCw','Save','Search','Sparkles','Trash2','Upload','X'].filter((n) => free.includes(n));
const motionNames = ['AnimatePresence','motion'].filter((n) => free.includes(n));
const importedNames = new Set([...iconNames, ...motionNames, 'EmpenhoDocumentActions']);

const allowedContext = new Set([
  'copiedPrompt','empenhos','empenhosClassFilter','empenhosFilter','empenhosPregaoFilter','empenhosSearch','empenhosYearFilter',
  'formatDateOnly','handleAddItemToEmpenho','handleCopyPrompt','handleCreateEmpenho','handleDeleteItemFromEmpenho',
  'handleDownloadPromptPdf','handleDownloadPromptTxt','handleDownloadTermoRecebimento','handleEmpenhoDocumentUploaded',
  'handleGenerateEmpenhoReportPDF','handleProcessJson','handleSaveReviewEmpenho','handleSelectEmpenhoForCronograma','invoices','jsonError','jsonInput',
  'newEmpenhoForm','newEmpenhoMode','newItemForm','reviewEmpenho','selectedEmpenhoDetailId','setActiveTab','setEditingEmpenhoId',
  'setEditingInvoice','setEmpenhosClassFilter','setEmpenhosFilter','setEmpenhosPregaoFilter','setEmpenhosSearch','setEmpenhosYearFilter',
  'setEmpenhoToDelete','setJsonError','setJsonInput','setNewEmpenhoForm','setNewEmpenhoMode','setNewItemForm','setNfSubTab',
  'setReviewEmpenho','setSelectedEmpenhoDetailId','setSelectedNFCommitmentId','setSelectedReportInvoice','setShowAddItemFormInDetail',
  'setShowConfirmSaveModal','setShowNewEmpenhoModal','showAddItemFormInDetail','showConfirmSaveModal','showNewEmpenhoModal','showToast',
  'uniqueEmpenhoYears','uniquePregaos','user'
]);

const unexpected = free.filter((n) => !importedNames.has(n) && !allowedContext.has(n));
if (unexpected.length) throw new Error(`Dependências inesperadas no bloco de Empenhos: ${unexpected.join(', ')}`);
const contextNames = free.filter((n) => allowedContext.has(n));

const imports = [
  "'use client';",
  '',
  "import React from 'react';",
  "import type { Dispatch, SetStateAction } from 'react';",
  ...(iconNames.length ? [`import { ${iconNames.map(n => n === 'ImageIcon' ? 'Image as ImageIcon' : n).join(', ')} } from 'lucide-react';`] : []),
  ...(motionNames.length ? [`import { ${motionNames.join(', ')} } from 'motion/react';`] : []),
  ...(free.includes('EmpenhoDocumentActions') ? ["import { EmpenhoDocumentActions } from '../../../components/EmpenhoDocumentActions';"] : []),
  "import type { Empenho, Invoice, EmpenhoPdfDocument } from '../../../lib/types';",
  "import type { User } from 'firebase/auth';",
  '',
].join('\n');

const interfaceText = `type Setter<T = any> = Dispatch<SetStateAction<T>>;\n\ntype NewEmpenhoForm = {\n  id: string;\n  supplier: string;\n  description: string;\n  pregao: string;\n  date: string;\n  classification: 'QR' | 'CALI' | 'PASA';\n};\n\ntype NewItemForm = { id: string; name: string; unit: string; quantity: string; unitPrice: string };\n\ninterface EmpenhosViewContext {\n  copiedPrompt: boolean;\n  empenhos: Empenho[];\n  empenhosClassFilter: string;\n  empenhosFilter: 'Todos' | 'Com Saldo' | 'Ativos' | 'Encerrados';\n  empenhosPregaoFilter: string;\n  empenhosSearch: string;\n  empenhosYearFilter: string;\n  formatDateOnly: (dateStr?: string) => string;\n  handleAddItemToEmpenho: (...args: any[]) => any;\n  handleCopyPrompt: (...args: any[]) => any;\n  handleCreateEmpenho: (...args: any[]) => any;\n  handleDeleteItemFromEmpenho: (...args: any[]) => any;\n  handleDownloadPromptPdf: (...args: any[]) => any;\n  handleDownloadPromptTxt: (...args: any[]) => any;\n  handleDownloadTermoRecebimento: (...args: any[]) => any;\n  handleEmpenhoDocumentUploaded: (empenhoId: string, document: EmpenhoPdfDocument) => Promise<void>;\n  handleGenerateEmpenhoReportPDF: (...args: any[]) => any;\n  handleProcessJson: (...args: any[]) => any;\n  handleSaveReviewEmpenho: (...args: any[]) => any;\n  handleSelectEmpenhoForCronograma: (...args: any[]) => any;\n  invoices: Invoice[];\n  jsonError: string | null;\n  jsonInput: string;\n  newEmpenhoForm: NewEmpenhoForm;\n  newEmpenhoMode: 'manual' | 'json';\n  newItemForm: NewItemForm;\n  reviewEmpenho: any;\n  selectedEmpenhoDetailId: string | null;\n  setActiveTab: Setter<any>;\n  setEditingEmpenhoId: Setter<string>;\n  setEditingInvoice: Setter<Invoice | null>;\n  setEmpenhosClassFilter: Setter<string>;\n  setEmpenhosFilter: Setter<'Todos' | 'Com Saldo' | 'Ativos' | 'Encerrados'>;\n  setEmpenhosPregaoFilter: Setter<string>;\n  setEmpenhosSearch: Setter<string>;\n  setEmpenhosYearFilter: Setter<string>;\n  setEmpenhoToDelete: Setter<string | null>;\n  setJsonError: Setter<string | null>;\n  setJsonInput: Setter<string>;\n  setNewEmpenhoForm: Setter<NewEmpenhoForm>;\n  setNewEmpenhoMode: Setter<'manual' | 'json'>;\n  setNewItemForm: Setter<NewItemForm>;\n  setNfSubTab: Setter<any>;\n  setReviewEmpenho: Setter<any>;\n  setSelectedEmpenhoDetailId: Setter<string | null>;\n  setSelectedNFCommitmentId: Setter<string>;\n  setSelectedReportInvoice: Setter<Invoice | null>;\n  setShowAddItemFormInDetail: Setter<boolean>;\n  setShowConfirmSaveModal: Setter<boolean>;\n  setShowNewEmpenhoModal: Setter<boolean>;\n  showAddItemFormInDetail: boolean;\n  showConfirmSaveModal: boolean;\n  showNewEmpenhoModal: boolean;\n  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;\n  uniqueEmpenhoYears: string[];\n  uniquePregaos: string[];\n  user: User | null;\n}\n\ninterface EmpenhosViewProps { context: EmpenhosViewContext; }\n`;

const viewFile = `${imports}${interfaceText}\n/** Tela de cadastro e detalhe de empenhos extraída sem alterar comportamento. */\nexport function EmpenhosView({ context }: EmpenhosViewProps) {\n  const { ${contextNames.join(', ')} } = context;\n  return ${expression};\n}\n`;
fs.mkdirSync('features/empenhos/components', { recursive: true });
fs.writeFileSync(VIEW_PATH, viewFile);

// IMPORTANT: replace the original JSX before adding imports, so the original
// character offsets remain valid and cannot truncate the surrounding page.
const replacement = `{activeTab === 'empenhos' && (\n            <EmpenhosView context={{ ${contextNames.join(', ')} }} />\n          )}`;
source = source.slice(0, start) + replacement + source.slice(blockEnd);

const viewImport = "import { EmpenhosView } from '../features/empenhos/components/EmpenhosView';\n";
const importAnchor = "import { DashboardView } from '../features/dashboard/components/DashboardView';\n";
if (!source.includes(viewImport)) {
  if (!source.includes(importAnchor)) throw new Error('Âncora de import de Empenhos não encontrada.');
  source = source.replace(importAnchor, importAnchor + viewImport);
}

const fullParsed = ts.createSourceFile('page-transformed.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
if (fullParsed.parseDiagnostics.length) {
  throw new Error(`Guardrail sintático do page.tsx: ${fullParsed.parseDiagnostics.map(d => d.messageText).join('; ')}`);
}

const newLineCount = source.split('\n').length;
if (newLineCount < 4500 || newLineCount >= originalLineCount) throw new Error(`Guardrail: contagem de linhas inesperada (${originalLineCount} -> ${newLineCount}).`);
if (!source.includes(nextMarker)) throw new Error('Guardrail: marcador da aba Notas Fiscais desapareceu.');
if (!source.includes("activeTab === 'nova_nf'")) throw new Error('Guardrail: aba Notas Fiscais desapareceu.');
if (!source.includes("activeTab === 'itens'")) throw new Error('Guardrail: aba Consulta de Itens desapareceu.');

fs.writeFileSync(PAGE_PATH, source);
console.log(`Empenhos extraído com ${free.length} dependências livres e ${contextNames.length} props de contexto.`);
console.log(`Dependências: ${free.join(', ')}`);
console.log(`page.tsx: ${originalLineCount} -> ${newLineCount} linhas.`);
console.log(`Novo componente: ${VIEW_PATH}`);
