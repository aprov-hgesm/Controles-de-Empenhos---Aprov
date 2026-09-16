import fs from 'node:fs';
import ts from 'typescript';

const PAGE = 'app/page.tsx';
const OUT = 'features/empenhos/hooks/useEmpenhoActions.ts';
const targets = [
  'handleEmpenhoDocumentUploaded',
  'handleCreateEmpenho',
  'handleDownloadPromptTxt',
  'handleDownloadPromptPdf',
  'handleCopyPrompt',
  'handleProcessJson',
  'handleSaveReviewEmpenho',
  'handleAddItemToEmpenho',
  'handleDeleteItemFromEmpenho',
  'handleFinishEmpenhoRegistry',
  'handleDeleteSpecificEmpenho',
];

let source = fs.readFileSync(PAGE, 'utf8');
const originalLines = source.split('\n').length;
const sf = ts.createSourceFile(PAGE, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const home = sf.statements.find(s => ts.isFunctionDeclaration(s) && s.name?.text === 'Home');
if (!home?.body) throw new Error('Home() não encontrado');

const found = [];
for (const statement of home.body.statements) {
  if (!ts.isVariableStatement(statement)) continue;
  for (const decl of statement.declarationList.declarations) {
    if (ts.isIdentifier(decl.name) && targets.includes(decl.name.text)) {
      found.push({ name: decl.name.text, start: statement.getFullStart(), end: statement.end, text: source.slice(statement.getFullStart(), statement.end).trimStart() });
    }
  }
}
const foundNames = found.map(x => x.name);
for (const name of targets) if (!foundNames.includes(name)) throw new Error(`Handler alvo não encontrado: ${name}`);
if (new Set(foundNames).size !== targets.length) throw new Error('Handlers duplicados ou contagem inesperada');

const contextNames = [
  'user', 'empenhos', 'setEmpenhos', 'alerts', 'setAlerts', 'invoices', 'setInvoices',
  'newEmpenhoForm', 'setNewEmpenhoForm', 'setShowNewEmpenhoModal', 'setEditingEmpenhoId',
  'setSelectedEmpenhoDetailId', 'setActiveTab', 'showToast', 'setCopiedPrompt', 'jsonInput',
  'setJsonError', 'setReviewEmpenho', 'reviewEmpenho', 'setJsonInput', 'setShowConfirmSaveModal',
  'newItemForm', 'setNewItemForm', 'editingEmpenhoId', 'setIsDeletingEmpenho', 'setEmpenhoToDelete',
  'activeTab',
];
let extracted = found.sort((a,b) => a.start-b.start).map(x => x.text.replace(/^\s{2}/gm, '')).join('\n\n');
// Os campos abaixo já são usados pelo código legado, embora ainda não estejam declarados nos tipos centrais.
// O cast é estritamente de tipagem e não altera o comportamento em runtime.
extracted = extracted
  .replace(/inv\.commitmentId/g, "(inv as Invoice & { commitmentId?: string }).commitmentId")
  .replace(/a\.empenhoId/g, "(a as Alert & { empenhoId?: string }).empenhoId");

const hook = `'use client';\n\nimport type React from 'react';\nimport type { User } from 'firebase/auth';\nimport jsPDF from 'jspdf';\nimport type { Alert, Empenho, EmpenhoPdfDocument, Invoice, Item } from '../../../lib/types';\nimport { saveAlert, saveEmpenho, removeAlert, removeEmpenho, removeInvoice } from '../../../lib/firebaseSync';\nimport { PROMPT_EXTRACAO_EMPENHO } from '../domain/empenhoHelpers';\n\ntype ActiveTab = 'painel' | 'empenhos' | 'itens' | 'nova_nf' | 'relatorios' | 'itens_empenho' | 'cronogramas';\ntype NewEmpenhoForm = { id: string; supplier: string; description: string; pregao: string; date: string; classification: 'QR' | 'CALI' | 'PASA' };\ntype NewItemForm = { id: string; name: string; unit: string; quantity: string; unitPrice: string };\ntype ToastType = 'success' | 'error' | 'info';\n\ninterface EmpenhoActionsContext {\n  user: User | null;\n  empenhos: Empenho[];\n  setEmpenhos: React.Dispatch<React.SetStateAction<Empenho[]>>;\n  alerts: Alert[];\n  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;\n  invoices: Invoice[];\n  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;\n  newEmpenhoForm: NewEmpenhoForm;\n  setNewEmpenhoForm: React.Dispatch<React.SetStateAction<NewEmpenhoForm>>;\n  setShowNewEmpenhoModal: React.Dispatch<React.SetStateAction<boolean>>;\n  setEditingEmpenhoId: React.Dispatch<React.SetStateAction<string>>;\n  setSelectedEmpenhoDetailId: React.Dispatch<React.SetStateAction<string | null>>;\n  setActiveTab: React.Dispatch<React.SetStateAction<ActiveTab>>;\n  showToast: (message: string, type?: ToastType) => void;\n  setCopiedPrompt: React.Dispatch<React.SetStateAction<boolean>>;\n  jsonInput: string;\n  setJsonError: React.Dispatch<React.SetStateAction<string | null>>;\n  setReviewEmpenho: React.Dispatch<React.SetStateAction<any | null>>;\n  reviewEmpenho: any | null;\n  setJsonInput: React.Dispatch<React.SetStateAction<string>>;\n  setShowConfirmSaveModal: React.Dispatch<React.SetStateAction<boolean>>;\n  newItemForm: NewItemForm;\n  setNewItemForm: React.Dispatch<React.SetStateAction<NewItemForm>>;\n  editingEmpenhoId: string;\n  setIsDeletingEmpenho: React.Dispatch<React.SetStateAction<boolean>>;\n  setEmpenhoToDelete: React.Dispatch<React.SetStateAction<string | null>>;\n  activeTab: ActiveTab;\n}\n\n/** Ações do domínio de empenhos; estado e persistência continuam injetados pelo orquestrador. */\nexport function useEmpenhoActions(context: EmpenhoActionsContext) {\n  const { ${contextNames.join(', ')} } = context;\n\n${extracted.split('\n').map(l => '  ' + l).join('\n')}\n\n  return {\n    ${targets.join(',\n    ')},\n  };\n}\n`;
const hookSf = ts.createSourceFile(OUT, hook, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
if (hookSf.parseDiagnostics.length) throw new Error('Hook inválido: ' + hookSf.parseDiagnostics.map(d => d.messageText).join('; '));
fs.mkdirSync('features/empenhos/hooks', { recursive: true });
fs.writeFileSync(OUT, hook);

for (const item of found.sort((a,b) => b.start-a.start)) {
  source = source.slice(0, item.start) + '\n' + source.slice(item.end);
}
const importAnchor = "import { useOperationalViewState } from '../hooks/useOperationalViewState';\n";
const importLine = "import { useEmpenhoActions } from '../features/empenhos/hooks/useEmpenhoActions';\n";
if (!source.includes(importAnchor)) throw new Error('Âncora de import não encontrada');
source = source.replace(importAnchor, importAnchor + importLine);

const stateAnchor = '  } = useOperationalViewState();\n';
if (!source.includes(stateAnchor)) throw new Error('Âncora de estado não encontrada');
const invocation = `\n\n  const {\n    ${targets.join(',\n    ')}\n  } = useEmpenhoActions({\n    ${contextNames.join(',\n    ')}\n  });`;
source = source.replace(stateAnchor, stateAnchor + invocation + '\n');

for (const name of targets) {
  const declarationRe = new RegExp(`const\\s+${name}\\s*=`);
  const matches = source.match(new RegExp(declarationRe.source, 'g')) || [];
  if (matches.length) throw new Error(`Declaração antiga permaneceu no page: ${name}`);
  if (!source.includes(name)) throw new Error(`Handler deixou de ser referenciado: ${name}`);
}
const pageSf = ts.createSourceFile(PAGE, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
if (pageSf.parseDiagnostics.length) throw new Error('page inválido: ' + pageSf.parseDiagnostics.map(d => d.messageText).join('; '));
fs.writeFileSync(PAGE, source);
console.log(`Extraídos ${targets.length} handlers de empenhos.`);
console.log(`page.tsx: ${originalLines} -> ${source.split('\n').length} linhas.`);
