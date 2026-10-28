'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Download, FileSpreadsheet, RefreshCw, TriangleAlert, Upload } from 'lucide-react';
import { auth } from '../../../lib/firebase';
import type { WarehouseMaterial } from '../../../lib/warehouse/material';
import type { WarehouseDepotListItem, WarehouseLocationListItem } from '../../../lib/warehouse/locationRepository';
import type { WarehouseStockPosition } from '../../../lib/warehouse/location';
import { registerWarehouseManualEntry } from '../../../lib/warehouse/manualEntryRepository';
import { warehouseManualEntryErrorMessage } from '../../../lib/warehouse/manualEntryMessages';
import { matchBulkStockLocal, matchBulkStockSubposition } from '../../../lib/warehouse/bulkStockLocationMatcher';
import { bulkMaterialCandidates, bulkMaterialGroupKey } from '../../../lib/warehouse/bulkStockMaterialMatcher';

interface UploadLine {
  line:number;material:string;quantity:number;unit:string;expiresOn:string|null;
  barcode:string|null;localType:string;localNumber:string;subposition:string|null;
  lot:string|null;provenance:string|null;reference:string|null;
}
interface ResolvedLine extends UploadLine {
  position:WarehouseStockPosition|null;
  materialId:string|null;
  group:string;
  candidates:WarehouseMaterial[];
  errors:string[];
  matchedLocation:string|null;
}
interface Checkpoint {completed:Record<string,string>}

function resolveRows(
  items:UploadLine[],depotId:string,materials:WarehouseMaterial[],
  locations:WarehouseLocationListItem[],selectedMaterialIds:Record<string,string>
):ResolvedLine[]{
  const locals=locations.filter(item=>item.location.kind==='LOCAL'
    && item.location.depotId===depotId).map(item=>item.location);
  const subpositions=locations.filter(item=>item.location.kind==='SUBPOSITION'
    && item.location.depotId===depotId).map(item=>item.location);
  return items.map(item=>{
    const errors:string[]=[];
    // Excel "Estante 9" deve reconhecer o cadastro "Estante 09" / "EST-09".
    const matches=matchBulkStockLocal(locals,depotId,item.localType,item.localNumber);
    if(matches.length!==1){
      errors.push(matches.length?'Localização ambígua':'Local não cadastrado');
    }
    const local=matches[0];
    let matchedLocation:string|null=local && matches.length===1?local.name:null;
    let position:WarehouseStockPosition|null=null;
    if(local && matches.length===1){
      if(!item.subposition){
        position={kind:'LOCATION',depotId,locationId:local.id,subpositionId:null};
      }else{
        // Excel "1" corresponde à "Prateleira 01" / "PRT-01" do local pai.
        const subs=matchBulkStockSubposition(subpositions,depotId,local.id,item.subposition);
        if(subs.length!==1)errors.push(subs.length?'Subposição ambígua':'Subposição não cadastrada');
        else {
          position={kind:'SUBPOSITION',depotId,locationId:local.id,subpositionId:subs[0].id};
          matchedLocation=local.name+' / '+subs[0].name;
        }
      }
    }
    const group=bulkMaterialGroupKey(item.material,item.unit);
    const candidates=bulkMaterialCandidates(materials,item.material,item.unit);
    const choice=candidates.find(material=>material.id===selectedMaterialIds[group]);
    const materialId=candidates.length===1?candidates[0].id:choice?.id||null;
    // Nomes semelhantes ou unidades diferentes não impedem criar um material distinto.
    // Múltiplas identidades existentes exigem uma escolha explícita, sem editar o Excel.
    if(candidates.length>1&&!materialId)
      errors.push('Selecione o cadastro do material na prévia');
    if(item.barcode && item.barcode.length>128)errors.push('Código de barras inválido');
    return {...item,position,materialId,group,candidates,errors,matchedLocation};
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
  workspaceId,materials,depots,locations,onImported,
}:{
  workspaceId:string;
  materials:WarehouseMaterial[];
  depots:WarehouseDepotListItem[];
  locations:WarehouseLocationListItem[];
  onImported:()=>Promise<void>|void;
}){
  const [depotId,setDepotId]=useState('');
  const [digest,setDigest]=useState('');
  const [filename,setFilename]=useState('');
  const [rows,setRows]=useState<UploadLine[]>([]);
  const [selectedMaterialIds,setSelectedMaterialIds]=useState<Record<string,string>>({});
  const [errors,setErrors]=useState<string|null>(null);
  const [working,setWorking]=useState(false);
  const [progress,setProgress]=useState(0);
  const [confirm,setConfirm]=useState(false);
  const [report,setReport]=useState('');
  const resolved=useMemo(()=>resolveRows(rows,depotId,materials,locations,selectedMaterialIds),
    [rows,depotId,materials,locations,selectedMaterialIds]);
  const invalid=resolved.filter(row=>row.errors.length);
  const previewRows=invalid.length
    ? [...invalid.slice(0,70),...resolved.filter(row=>!row.errors.length).slice(0,Math.max(0,70-invalid.length))]
    : resolved.slice(0,70);
  const depot=depots.find(item=>item.depot.id===depotId)?.depot;
  const canSend=Boolean(depot&&rows.length&&digest&&!invalid.length&&confirm&&!working);

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
    setRows([]);setSelectedMaterialIds({});setDigest('');setProgress(0);setConfirm(false);setReport('');setErrors(null);
    if(!file)return;
    if(!file.name.toLowerCase().endsWith('.xlsx')){
      setErrors('Salve a planilha em formato Excel (.xlsx) antes de enviar.');return;
    }
    if(file.size>5*1024*1024){setErrors('Arquivo maior que 5 MB.');return;}
    setWorking(true);
    try{
      const bytes=await file.arrayBuffer();
      const fingerprint=await crypto.subtle.digest('SHA-256',bytes);
      const hash=Array.from(new Uint8Array(fingerprint),n=>n.toString(16).padStart(2,'0')).join('');
      const form=new FormData();form.set('file',file);
      const response=await fetch('/api/central-depositos/bulk-stock',{
        method:'POST',headers:{authorization:'Bearer '+await token()},
        body:form,cache:'no-store',
      });
      const body=await response.json().catch(()=>null) as
        {ok?:boolean;error?:string;rows?:UploadLine[]}|null;
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
    for(const line of resolved)if(line.materialId)materialsByGroup.set(line.group,line.materialId);
    for(const line of resolved){
      const prior=checkpoint.completed[String(line.line)];
      if(prior)materialsByGroup.set(line.group,prior);
    }
    let completed=0;
    try{
      for(const row of resolved) {
        const priorMaterialId=checkpoint.completed[String(row.line)];
        if(priorMaterialId && row.materialId && priorMaterialId!==row.materialId)
          throw new Error('Linha '+row.line+': a identidade selecionada difere daquela já confirmada nesta carga.');
        if(priorMaterialId){completed++;setProgress(completed);continue;}
        if(!row.position||row.errors.length)throw new Error('Linha '+row.line+': validação incompleta.');
        const materialId=materialsByGroup.get(row.group)||null;
        const result=await registerWarehouseManualEntry(workspaceId,{
          operationId:'bulk_'+digest.slice(0,28)+'_'+row.line,
          existingMaterialId:materialId,
          description:row.material,
          unitLabel:row.unit,
          quantity:row.quantity,
          position:row.position,
          provenance:row.provenance||'Contagem física inicial',
          reference:row.reference||('Planilha '+filename+' — linha '+row.line).slice(0,160),
          expiresOn:row.expiresOn,
          lotCode:null, // A referência técnica é criada pelo servidor a partir da validade.
          barcode:row.barcode,
        });
        materialsByGroup.set(row.group,result.material.id);
        checkpoint.completed[String(row.line)]=result.material.id;
        window.localStorage.setItem(key,JSON.stringify(checkpoint));
        completed++;setProgress(completed);
      }
      setReport('Importação concluída: '+completed+' linhas confirmadas no motor de estoque. Faça a conferência física e documental.');
      await onImported();
    }catch(err){
      setErrors('Importação parcial ('+completed+'/'+resolved.length+'). Linhas confirmadas já integram o estoque; selecione o MESMO arquivo e retome. '+warehouseManualEntryErrorMessage(err));
      await onImported();
    }finally{setWorking(false);}
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
        <select value={depotId} onChange={event=>{setDepotId(event.target.value);setConfirm(false);}}
          disabled={working}
          className="mt-1 block h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs">
          <option value="">Selecione o depósito</option>
          {depots.map(({depot:entry})=><option key={entry.id} value={entry.id}>{entry.code} · {entry.name}</option>)}
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
      {rows.length>70&&<p className="text-xs text-slate-500">Prévia de até 70 linhas, priorizando pendências ({invalid.length} no total). Todas as {rows.length} linhas são validadas.</p>}
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
