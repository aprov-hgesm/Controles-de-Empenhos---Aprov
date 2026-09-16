import fs from 'node:fs';
import ts from 'typescript';

const PAGE='app/page.tsx';
const DOC_OUT='features/relatorios/hooks/useDocumentActions.ts';
const CRONO_OUT='features/cronogramas/hooks/useCronogramaActions.ts';
const docTargets=['handleDownloadTermoRecebimento','handleGenerateEmpenhoReportPDF'];
const cronoTargets=['getFutureDate','handleSelectEmpenhoForCronograma','applyCronogramaPreset','applyAllToFirstRemessa','clearCronogramaDistribuicao','handleAddRemessa','handleRemoveRemessa','handleSaveCronograma','handleGenerateCronogramaPDF'];
const returnedCrono=cronoTargets.filter(x=>x!=='getFutureDate');
let source=fs.readFileSync(PAGE,'utf8');
const originalLines=source.split('\n').length;
const sf=ts.createSourceFile(PAGE,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const home=sf.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='Home');
if(!home?.body) throw new Error('Home não encontrado');
const byName=new Map();
for(const statement of home.body.statements){
  if(!ts.isVariableStatement(statement)) continue;
  for(const decl of statement.declarationList.declarations){
    if(ts.isIdentifier(decl.name)&&(docTargets.includes(decl.name.text)||cronoTargets.includes(decl.name.text))){
      byName.set(decl.name.text,{name:decl.name.text,start:statement.getFullStart(),end:statement.end,text:source.slice(statement.getFullStart(),statement.end).trimStart()});
    }
  }
}
for(const n of [...docTargets,...cronoTargets]) if(!byName.has(n)) throw new Error(`Alvo não encontrado: ${n}`);

let docText=docTargets.map(n=>byName.get(n).text.replace(/^\s{2}/gm,'')).join('\n\n');
docText=docText.replace(/doc\.internal\.getNumberOfPages\(\)/g,'(doc.internal as any).getNumberOfPages()');
const docHook=(`'use client';\n\nimport type React from 'react';\nimport type { User } from 'firebase/auth';\nimport jsPDF from 'jspdf';\nimport autoTable from 'jspdf-autotable';\nimport type { Comissao, Empenho, Invoice } from '../../../lib/types';\nimport { saveInvoice } from '../../../lib/firebaseSync';\n\ntype ToastType='success'|'error'|'info';\ninterface DocumentActionsContext {\n  user: User|null;\n  invoices: Invoice[];\n  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;\n  comissoes: Comissao[];\n  empenhos: Empenho[];\n  showToast: (message:string,type?:ToastType)=>void;\n  formatDateOnly: (dateStr?:string)=>string;\n}\n\n/** Geração de termos e relatórios PDF, isolada da composição principal. */\nexport function useDocumentActions(context:DocumentActionsContext){\n  const { user,invoices,setInvoices,comissoes,empenhos,showToast,formatDateOnly }=context;\n\n${docText.split('\n').map(l=>'  '+l).join('\n')}\n\n  return { handleDownloadTermoRecebimento, handleGenerateEmpenhoReportPDF };\n}\n`).replace(/[ \t]+$/gm,'');

let cronoText=cronoTargets.map(n=>byName.get(n).text.replace(/^\s{2}/gm,'')).join('\n\n');
cronoText=cronoText.replace(/doc\.internal\.getNumberOfPages\(\)/g,'(doc.internal as any).getNumberOfPages()');
const cronoCtx=['user','empenhos','cronogramas','setCronogramas','selectedCronogramaEmpenhoId','setSelectedCronogramaEmpenhoId','cronogramaColunas','setCronogramaColunas','cronogramaDistribuicao','setCronogramaDistribuicao','cronogramaLocalEntrega','setCronogramaLocalEntrega','cronogramaHorarioEntrega','setCronogramaHorarioEntrega','cronogramaObservacoes','setCronogramaObservacoes','cronogramaResponsavelNome','setCronogramaResponsavelNome','cronogramaResponsavelCargo','setCronogramaResponsavelCargo','setIsSavingCronograma','showToast','formatDateOnly'];
const cronoHook=(`'use client';\n\nimport type React from 'react';\nimport type { User } from 'firebase/auth';\nimport jsPDF from 'jspdf';\nimport autoTable from 'jspdf-autotable';\nimport type { CronogramaEmpenho, CronogramaEntregaColuna, Empenho } from '../../../lib/types';\nimport { saveCronograma } from '../../../lib/firebaseSync';\n\ntype Distribution=Record<string,Record<string,number>>;\ninterface CronogramaActionsContext {\n  user: User|null;\n  empenhos: Empenho[];\n  cronogramas: CronogramaEmpenho[];\n  setCronogramas: React.Dispatch<React.SetStateAction<CronogramaEmpenho[]>>;\n  selectedCronogramaEmpenhoId: string|null;\n  setSelectedCronogramaEmpenhoId: React.Dispatch<React.SetStateAction<string|null>>;\n  cronogramaColunas: CronogramaEntregaColuna[];\n  setCronogramaColunas: React.Dispatch<React.SetStateAction<CronogramaEntregaColuna[]>>;\n  cronogramaDistribuicao: Distribution;\n  setCronogramaDistribuicao: React.Dispatch<React.SetStateAction<Distribution>>;\n  cronogramaLocalEntrega:string; setCronogramaLocalEntrega:React.Dispatch<React.SetStateAction<string>>;\n  cronogramaHorarioEntrega:string; setCronogramaHorarioEntrega:React.Dispatch<React.SetStateAction<string>>;\n  cronogramaObservacoes:string; setCronogramaObservacoes:React.Dispatch<React.SetStateAction<string>>;\n  cronogramaResponsavelNome:string; setCronogramaResponsavelNome:React.Dispatch<React.SetStateAction<string>>;\n  cronogramaResponsavelCargo:string; setCronogramaResponsavelCargo:React.Dispatch<React.SetStateAction<string>>;\n  setIsSavingCronograma:React.Dispatch<React.SetStateAction<boolean>>;\n  showToast:(message:string,type?:any)=>void;\n  formatDateOnly:(dateStr?:string)=>string;\n}\n\n/** Ações e geração de PDF dos cronogramas de entrega. */\nexport function useCronogramaActions(context:CronogramaActionsContext){\n  const { ${cronoCtx.join(', ')} }=context;\n\n${cronoText.split('\n').map(l=>'  '+l).join('\n')}\n\n  return {\n    ${returnedCrono.join(',\n    ')}\n  };\n}\n`).replace(/[ \t]+$/gm,'');

for(const [path,text,kind] of [[DOC_OUT,docHook,ts.ScriptKind.TS],[CRONO_OUT,cronoHook,ts.ScriptKind.TS]]){
  const ast=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,kind);
  if(ast.parseDiagnostics.length) throw new Error(`${path} inválido: ${ast.parseDiagnostics.map(d=>d.messageText).join('; ')}`);
  fs.mkdirSync(path.substring(0,path.lastIndexOf('/')),{recursive:true}); fs.writeFileSync(path,text);
}
const all=[...docTargets,...cronoTargets].map(n=>byName.get(n)).sort((a,b)=>b.start-a.start);
for(const item of all) source=source.slice(0,item.start)+'\n'+source.slice(item.end);
const importAnchor="import { useNotasFiscaisActions } from '../features/notas-fiscais/hooks/useNotasFiscaisActions';\n";
const imports="import { useDocumentActions } from '../features/relatorios/hooks/useDocumentActions';\nimport { useCronogramaActions } from '../features/cronogramas/hooks/useCronogramaActions';\n";
if(!source.includes(importAnchor)) throw new Error('Âncora import ausente'); source=source.replace(importAnchor,importAnchor+imports);
const invokeAnchor='  // Reset NF inputs when changing target empenho\n';
if(!source.includes(invokeAnchor)) throw new Error('Âncora invoke ausente');
const invocation=`  const { handleDownloadTermoRecebimento, handleGenerateEmpenhoReportPDF } = useDocumentActions({\n    user, invoices, setInvoices, comissoes, empenhos, showToast, formatDateOnly\n  });\n\n  const {\n    ${returnedCrono.join(',\n    ')}\n  } = useCronogramaActions({\n    ${cronoCtx.join(',\n    ')}\n  });\n\n`;
source=source.replace(invokeAnchor,invocation+invokeAnchor);
for(const n of [...docTargets,...cronoTargets]) if(new RegExp(`const\\s+${n}\\s*=`).test(source)) throw new Error(`Declaração antiga permaneceu: ${n}`);
const pageAst=ts.createSourceFile(PAGE,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
if(pageAst.parseDiagnostics.length) throw new Error('page inválido: '+pageAst.parseDiagnostics.map(d=>d.messageText).join('; '));
fs.writeFileSync(PAGE,source);
console.log(`Extraídos ${docTargets.length} handlers de documentos e ${returnedCrono.length} ações de cronogramas.`);
console.log(`page.tsx: ${originalLines} -> ${source.split('\n').length} linhas.`);
