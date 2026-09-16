import fs from 'node:fs';
import ts from 'typescript';

const PAGE = 'app/page.tsx';
const OUT = 'features/notas-fiscais/hooks/useNotasFiscaisActions.ts';
const targets = [
  'handleSaveInvoice', 'handleEditInvoice', 'handleDeleteInvoice', 'handleDeleteAllInvoices',
  'handleDeleteAllComissoes', 'handleMarkComissao', 'handleMarkTesouraria',
  'handleSaveNumeroNS', 'handleSaveComissao',
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
for (const name of targets) if (!found.some(x => x.name === name)) throw new Error(`Handler não encontrado: ${name}`);

const ctx = [
  'user','empenhos','setEmpenhos','alerts','setAlerts','invoices','setInvoices','comissoes','setComissoes','showToast',
  'selectedNFCommitmentId','setSelectedNFCommitmentId','nfNumber','setNfNumber','nfDate','setNfDate','nfQuantities','setNfQuantities',
  'nfSubTab','setNfSubTab','editingInvoice','setEditingInvoice','setEditingNSId','setTempNSValue',
  'comissaoMes','comissaoBoletimNum','setComissaoBoletimNum','comissaoBoletimDate','setComissaoBoletimDate',
  'comissaoPresPosto','comissaoPresNome','setComissaoPresNome','comissaoAux1Posto','comissaoAux1Nome','setComissaoAux1Nome',
  'comissaoAux2Posto','comissaoAux2Nome','setComissaoAux2Nome','comissaoAux3Posto','comissaoAux3Nome','setComissaoAux3Nome',
];
const extracted = found.sort((a,b)=>a.start-b.start).map(x=>x.text.replace(/^\s{2}/gm,'')).join('\n\n');
const hook = (`'use client';\n\nimport type React from 'react';\nimport type { User } from 'firebase/auth';\nimport type { Alert, Comissao, Empenho, Invoice, InvoiceItem } from '../../../lib/types';\nimport { saveAlert, saveEmpenho, saveInvoice, removeInvoice, removeComissao, saveComissao } from '../../../lib/firebaseSync';\n\ntype ToastType = 'success' | 'error' | 'info';\ntype NfSubTab = 'acompanhar' | 'cadastrar' | 'comissao';\ninterface NotasActionsContext {\n  user: User | null;\n  empenhos: Empenho[]; setEmpenhos: React.Dispatch<React.SetStateAction<Empenho[]>>;\n  alerts: Alert[]; setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;\n  invoices: Invoice[]; setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;\n  comissoes: Comissao[]; setComissoes: React.Dispatch<React.SetStateAction<Comissao[]>>;\n  showToast: (message: string, type?: ToastType) => void;\n  selectedNFCommitmentId: string; setSelectedNFCommitmentId: React.Dispatch<React.SetStateAction<string>>;\n  nfNumber: string; setNfNumber: React.Dispatch<React.SetStateAction<string>>;\n  nfDate: string; setNfDate: React.Dispatch<React.SetStateAction<string>>;\n  nfQuantities: Record<string, number>; setNfQuantities: React.Dispatch<React.SetStateAction<Record<string, number>>>;\n  nfSubTab: NfSubTab; setNfSubTab: React.Dispatch<React.SetStateAction<NfSubTab>>;\n  editingInvoice: Invoice | null; setEditingInvoice: React.Dispatch<React.SetStateAction<Invoice | null>>;\n  setEditingNSId: React.Dispatch<React.SetStateAction<string | null>>; setTempNSValue: React.Dispatch<React.SetStateAction<string>>;\n  comissaoMes: string; comissaoBoletimNum: string; setComissaoBoletimNum: React.Dispatch<React.SetStateAction<string>>;\n  comissaoBoletimDate: string; setComissaoBoletimDate: React.Dispatch<React.SetStateAction<string>>;\n  comissaoPresPosto: string; comissaoPresNome: string; setComissaoPresNome: React.Dispatch<React.SetStateAction<string>>;\n  comissaoAux1Posto: string; comissaoAux1Nome: string; setComissaoAux1Nome: React.Dispatch<React.SetStateAction<string>>;\n  comissaoAux2Posto: string; comissaoAux2Nome: string; setComissaoAux2Nome: React.Dispatch<React.SetStateAction<string>>;\n  comissaoAux3Posto: string; comissaoAux3Nome: string; setComissaoAux3Nome: React.Dispatch<React.SetStateAction<string>>;\n}\n\n/** Ações de Notas Fiscais e Comissão, com dependências operacionais injetadas. */\nexport function useNotasFiscaisActions(context: NotasActionsContext) {\n  const { ${ctx.join(', ')} } = context;\n\n${extracted.split('\n').map(l=>'  '+l).join('\n')}\n\n  return {\n    ${targets.join(',\n    ')}\n  };\n}\n`).replace(/[ \t]+$/gm,'');
const hookSf = ts.createSourceFile(OUT, hook, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
if (hookSf.parseDiagnostics.length) throw new Error('Hook inválido: '+hookSf.parseDiagnostics.map(d=>d.messageText).join('; '));
fs.mkdirSync('features/notas-fiscais/hooks',{recursive:true});
fs.writeFileSync(OUT,hook);
for (const item of found.sort((a,b)=>b.start-a.start)) source = source.slice(0,item.start)+'\n'+source.slice(item.end);
const importAnchor = "import { useEmpenhoActions } from '../features/empenhos/hooks/useEmpenhoActions';\n";
const importLine = "import { useNotasFiscaisActions } from '../features/notas-fiscais/hooks/useNotasFiscaisActions';\n";
if (!source.includes(importAnchor)) throw new Error('Âncora import não encontrada');
source = source.replace(importAnchor, importAnchor+importLine);
const invokeAnchor = '  // Reset NF inputs when changing target empenho\n';
if (!source.includes(invokeAnchor)) throw new Error('Âncora reset NF não encontrada');
const invocation = `  const {\n    ${targets.join(',\n    ')}\n  } = useNotasFiscaisActions({\n    ${ctx.join(',\n    ')}\n  });\n\n`;
source = source.replace(invokeAnchor, invocation+invokeAnchor);
for (const name of targets) if (new RegExp(`const\\s+${name}\\s*=`).test(source)) throw new Error(`Declaração permaneceu: ${name}`);
const pageSf = ts.createSourceFile(PAGE, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
if (pageSf.parseDiagnostics.length) throw new Error('page inválido: '+pageSf.parseDiagnostics.map(d=>d.messageText).join('; '));
fs.writeFileSync(PAGE,source);
console.log(`Extraídos ${targets.length} handlers de NF/Comissão.`);
console.log(`page.tsx: ${originalLines} -> ${source.split('\n').length} linhas.`);
