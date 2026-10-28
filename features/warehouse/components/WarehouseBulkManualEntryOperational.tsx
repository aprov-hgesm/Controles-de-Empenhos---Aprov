'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, FileSpreadsheet, RefreshCw, TriangleAlert, Upload } from 'lucide-react';
import { auth } from '../../../lib/firebase';
import { bulkStockOperationId, type BulkStockPreflightLine } from '../../../lib/warehouse/bulkStockResolve';
import { registerWarehouseManualEntry } from '../../../lib/warehouse/manualEntryRepository';
import { warehouseManualEntryErrorMessage } from '../../../lib/warehouse/manualEntryMessages';

type ResolvedLine=BulkStockPreflightLine;
interface Checkpoint {completed:Record<string,string>}
const AMBIGUOUS='Selecione o cadastro do material na prévia';

function resolveRows(items:ResolvedLine[],selectedMaterialIds:Record<string,string>):ResolvedLine[] {
  return items.map(item=>{
    if(item.candidates.length<=1)return item;
    const choice=item.candidates.find(m=>m.id===selectedMaterialIds[item.group]);
    const errors=item.errors.filter(error=>error!==AMBIGUOUS);
    if(!choice)errors.push(AMBIGUOUS);
    return {...item,materialId:choice?.id||null,errors};
  });
}
async function token():Promise<string>{
  const user=auth.currentUser;
  if(!user)throw new Error('Sessão não autenticada.');
  return user.getIdToken();
}
function checkpointKey(workspaceId:string,depotId:string,digest:string){
  return 'emprovex:stock-import-r1:'+workspaceId+':'+depotId+':'+digest;
}
function readCheckpoint(key:string):Checkpoint {
  try {
    const raw=window.localStorage.getItem(key);
    if(!raw)return {completed:{}};
    const parsed=JSON.parse(raw) as Checkpoint;
    if(!parsed||typeof parsed.completed!=='object'||!parsed.completed)
      return {completed:{}};
    return parsed;
  }catch{return {completed:{}};}
}

export function WarehouseBulkManualEntryOperational({
  workspaceId,onImported,
}:{
  workspaceId:string;
  onImported:()=>Promise<void>|void;
}){
  const [depotId,setDepotId]=useState('');
  const [depots,setDepots]=useState<Array<{id:string;name:string;code:string}>>([]);
  const [digest,setDigest]=useState('');
  const [filename,setFilename]=useState('');
  const [rows,setRows]=useState<ResolvedLine[]>([]);
  const [selectedMaterialIds,setSelectedMaterialIds]=useState<Record<string,string>>({});
  const [previewPage,setPreviewPage]=useState(0);
  const [errors,setErrors]=useState<string|null>(null);
  const [working,setWorking]=useState(false);
  const [progress,setProgress]=useState(0);
  const [confirm,setConfirm]=useState(false);
  const [report,setReport]=useState('');
  const resolved=useMemo(()=>resolveRows(rows,selectedMaterialIds),
    [rows,selectedMaterialIds]);
  const invalid=resolved.filter(row=>row.errors.length);
  const previewOrdered=useMemo(()=>[
    ...resolved.filter(row=>row.errors.length),
    ...resolved.filter(row=>!row.errors.length),
  ],[resolved]);
  const lastPage=Math.max(0,Math.ceil(previewOrdered.length/70)-1);
  const page=Math.min(previewPage,lastPage);
  const previewRows=previewOrdered.slice(page*70,page*70+70);
  const depot=depots.find(item=>item.id===depotId);
  const canSend=Boolean(depot&&rows.length&&digest&&!invalid.length&&confirm&&!working);
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try{
        const response=await fetch('/api/central-depositos/bulk-stock?list=depots',{
          headers:{authorization:'Bearer '+await token()},cache:'no-store',
        });
        const result=await response.json().catch(()=>null) as
          {ok?:boolean;depots?:Array<{id:string;name:string;code:string}>;error?:string}|null;
        if(!response.ok||!result?.ok||!Array.isArray(result.depots))
          throw new Error(result?.error||'Não foi possível consultar os depósitos.');
        if(!cancelled)setDepots(result.depots);
      }catch(error){
        if(!cancelled)setErrors('Falha ao consultar depósitos pelo servidor: '+
          (error instanceof Error?error.message:String(error)));
      }
    })();
    return ()=>{cancelled=true;};
  },[workspaceId]);


  async function downloadTemplate(){
    setErrors(null);
    try{
      const response=await fetch('/api/central-depositos/bulk-stock',{
        headers:{authorization:'Bearer '+await token()},cache:'no-store',
      });
      if(!response.ok)throw new Error('Não foi possível baixar o modelo Excel.');
      const blob=await response.blob(),url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;a.download='EMPROVEX_Carga_Inicial_Estoque.xlsx';a.click();
      URL.revokeObjectURL(url);
    }catch(err){setErrors(err instanceof Error?err.message:String(err));}
  }
  async function upload(file:File|null){
    setRows([]);setSelectedMaterialIds({});setPreviewPage(0);setDigest('');setProgress(0);setConfirm(false);setReport('');setErrors(null);
    if(!file)return;
    if(!depotId){setErrors('Selecione o depósito antes de importar a planilha.');return;}
    if(!file.name.toLowerCase().endsWith('.xlsx')){
      setErrors('Salve a planilha em formato Excel (.xlsx) antes de enviar.');return;
    }
    if(file.size>5*1024*1024){setErrors('Arquivo maior que 5 MB.');return;}
    setWorking(true);
    try{
      const bytes=await file.arrayBuffer();
      const fingerprint=await crypto.subtle.digest('SHA-256',bytes);
      const hash=Array.from(new Uint8Array(fingerprint),n=>n.toString(16).padStart(2,'0')).join('');
      const form=new FormData();form.set('file',file);form.set('depotId',depotId);
      const response=await fetch('/api/central-depositos/bulk-stock',{
        method:'POST',headers:{authorization:'Bearer '+await token()},
        body:form,cache:'no-store',
      });
      const body=await response.json().catch(()=>null) as
        {ok?:boolean;error?:string;rows?:ResolvedLine[]}|null;
      if(!response.ok||!body?.ok||!body.rows)
        throw new Error('Falha ao validar Excel: '+(body?.error||response.status));
      setRows(body.rows);setDigest(hash);setFilename(file.name);
    }catch(err){setErrors(err instanceof Error?err.message:String(err));}
    finally{setWorking(false);}
  }
  async function importAll(){
    if(!canSend||!depot)return;
    setWorking(true);setErrors(null);setReport('');
    const key=checkpointKey(workspaceId,depotId,digest);
    const checkpoint=readCheckpoint(key);
    const materialsByGroup=new Map<string,string>();
    // Identidades persistidas têm precedência apenas se compatíveis com a escolha atual.
    try {
      for(const line of resolved) {
        if(!line.materialId)continue;
        const existing=materialsByGroup.get(line.group);
        if(existing&&existing!==line.materialId)
          throw new Error('Identidade conflitante entre linhas do mesmo material.');
        materialsByGroup.set(line.group,line.materialId);
      }
      for(const line of resolved){
        const prior=checkpoint.completed[String(line.line)];
        if(!prior)continue;
        const existing=materialsByGroup.get(line.group);
        if(existing&&existing!==prior)
          throw new Error('Linha '+line.line+': já foi importada com outra identificação.');
        materialsByGroup.set(line.group,prior);
      }
      let completed=0;
      for(const row of resolved){
        if(!row.position||row.errors.length)throw new Error('Linha '+row.line+': validação incompleta.');
        const materialId=materialsByGroup.get(row.group)||null;
        // O depósito integra a chave: arquivos iguais em depósitos diferentes não colidem.
        const operationId=bulkStockOperationId(depotId,digest,row.line);
        // Reexecutar no servidor mesmo quando localStorage indica conclusão:
        // o ledger é a fonte de verdade, não o armazenamento do navegador.
        const result=await registerWarehouseManualEntry(workspaceId,{
          operationId,
          existingMaterialId:materialId,
          description:row.material,
          unitLabel:row.unit,
          quantity:row.quantity,
          position:row.position,
          provenance:row.provenance||'Contagem física inicial',
          reference:row.reference||('Planilha '+digest.slice(0,28)+' — linha '+row.line).slice(0,160),
          expiresOn:row.expiresOn,
          lotCode:null,
          barcode:row.barcode,
        });
        materialsByGroup.set(row.group,result.material.id);
        checkpoint.completed[String(row.line)]=result.material.id;
        try{window.localStorage.setItem(key,JSON.stringify(checkpoint));}catch{/* ledger server-side prevalece */}
        completed++;setProgress(completed);
      }
      setReport('Importação concluída: '+completed+' linhas verificadas no motor de estoque. A repetição do mesmo arquivo não duplica saldos.');
      await onImported();
    } catch(err){
      setErrors('Importação interrompida ('+Object.keys(checkpoint.completed).length+'/'+resolved.length+' linhas registradas neste navegador). Reenvie o MESMO arquivo: o servidor protege contra duplicação de movimentos. '+warehouseManualEntryErrorMessage(err));
      await onImported();
    } finally {setWorking(false);}
  }
  return <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm" data-testid="warehouse-bulk-stock-import">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-[#00288e] flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4"/> Carga inicial por planilha
        </p>
        <h3 className="mt-2 text-base font-black text-slate-900">Importar estoque de um depósito inteiro</h3>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
          Baixe o Excel, registre a contagem física e faça upload. Cada linha será conferida antes de gerar
          uma entrada avulsa auditável. Nenhum dado do SISCOFIS será alterado.
        </p>
      </div>
      <button type="button" disabled={working} onClick={()=>void downloadTemplate()}
        className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-4 py-2.5 text-xs font-black text-[#00288e] hover:bg-blue-50 disabled:opacity-50">
        <Download className="h-4 w-4"/> Baixar modelo Excel
      </button>
    </div>
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <label className="text-xs font-bold text-slate-700">
        Depósito de destino
        <select value={depotId} onChange={event=>{
            setDepotId(event.target.value);setConfirm(false);setRows([]);setDigest('');
            setPreviewPage(0);setSelectedMaterialIds({});setErrors(null);setReport('');
          }}
          disabled={working}
          className="mt-1 block h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs">
          <option value="">Selecione o depósito</option>
          {depots.map(entry=><option key={entry.id} value={entry.id}>{entry.code} · {entry.name}</option>)}
        </select>
      </label>
      <label className="text-xs font-bold text-slate-700">
        Excel preenchido (.xlsx, até 5 MB)
        <span className="mt-1 flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3">
          <Upload className="h-4 w-4"/><input type="file" accept=".xlsx" disabled={working}
            onChange={event=>void upload(event.target.files?.[0]||null)}
            className="w-full text-[11px]"/>
        </span>
      </label>
    </div>
    {rows.length>0&&<div className="mt-4 space-y-3">
      <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-900">
        <b>{filename}</b> · {rows.length} linhas · {invalid.length} pendências de validação.
        {invalid.length>0&&<span> Resolva as pendências indicadas: escolha diretamente abaixo o cadastro dos materiais ambíguos. Somente erros de dados exigem corrigir o Excel.</span>}
      </div>
      <div className="max-h-64 overflow-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[720px] text-left text-[11px]">
          <thead className="sticky top-0 bg-slate-100 text-slate-600">
            <tr>{['Linha','Material','Quantidade','Posição','Resultado'].map(h=><th key={h} className="px-3 py-2">{h}</th>)}</tr>
          </thead>
          <tbody>{previewRows.map(row=><tr key={row.line} className="border-t border-slate-100">
            <td className="px-3 py-2">{row.line}</td><td className="px-3 py-2">{row.material}</td>
            <td className="px-3 py-2">{row.quantity} {row.unit}</td>
            <td className="px-3 py-2">
              {row.matchedLocation
                ? <><span className="font-semibold text-slate-800">{row.matchedLocation}</span>
                    <span className="block text-[10px] text-slate-400">
                      Planilha: {row.localType} {row.localNumber}{row.subposition?' / '+row.subposition:''}
                    </span></>
                : <span>{row.localType} {row.localNumber}{row.subposition?' / '+row.subposition:''}</span>}
            </td>
            <td className={'px-3 py-2 '+(row.errors.length?'text-red-700':'text-emerald-700')}>
              {row.candidates.length>1&&<label className="mb-1 block text-xs font-medium">
                Identificação do material
                <select value={selectedMaterialIds[row.group]||''}
                  onChange={event=>{setSelectedMaterialIds(current=>({...current,[row.group]:event.target.value}));setConfirm(false);}}
                  disabled={working} aria-label={'Identificação do material '+row.material}
                  className="mt-1 block w-full rounded-md border border-slate-300 bg-white p-1.5 text-xs text-slate-800">
                  <option value="">Selecione o cadastro existente</option>
                  {row.candidates.map(candidate=><option key={candidate.id} value={candidate.id}>
                    {candidate.description} · {candidate.unit.label||candidate.unit.code} · {candidate.id}
                  </option>)}
                </select>
              </label>}
              {row.errors.length?row.errors.join('; '):row.materialId?'Material existente':'Novo material'}
            </td>
          </tr>)}</tbody>
        </table>
      </div>
      {rows.length>70&&<div className="flex items-center justify-between gap-2 text-xs text-slate-600">
        <span>Exibindo {page*70+1}–{Math.min((page+1)*70,rows.length)} de {rows.length} linhas, com pendências primeiro.</span>
        <span className="flex items-center gap-2">
          <button type="button" disabled={page===0||working} onClick={()=>setPreviewPage(page-1)}
            className="rounded border px-2 py-1 disabled:opacity-40">Anterior</button>
          <span>{page+1}/{lastPage+1}</span>
          <button type="button" disabled={page>=lastPage||working} onClick={()=>setPreviewPage(page+1)}
            className="rounded border px-2 py-1 disabled:opacity-40">Próxima</button>
        </span>
      </div>}
      <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
        <input type="checkbox" checked={confirm} disabled={working||Boolean(invalid.length)}
          onChange={event=>setConfirm(event.target.checked)} className="mt-1"/>
        Confirmo que a planilha representa uma contagem física aprovada e que a carga ADICIONA SALDO
        ao EMPROVEX, sem substituir estoque anterior e sem corrigir automaticamente o SISCOFIS.
        Já conferi o depósito, as posições e o risco de duplicação de entradas.
      </label>
      <button type="button" onClick={()=>void importAll()} disabled={!canSend}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#00288e] px-4 text-xs font-black text-white disabled:opacity-40">
        {working?<RefreshCw className="h-4 w-4 animate-spin"/>:<CheckCircle2 className="h-4 w-4"/>}
        {working?'Importando '+progress+'/'+rows.length:'Confirmar carga das '+rows.length+' linhas'}
      </button>
    </div>}
    {errors&&<p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
      <TriangleAlert className="h-4 w-4 shrink-0"/>{errors}
    </p>}
    {report&&<p className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">{report}</p>}
  </section>;
}
