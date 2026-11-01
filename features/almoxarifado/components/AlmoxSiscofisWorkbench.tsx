'use client';

import { useState } from 'react';
import { auth } from '../../../lib/firebase';
import { createSeparationSheetPdf } from '../pdf/SeparationSheet';
import type { AlmoxPreviewResultV1 } from '../../../lib/almoxarifado/integration';
import type { PositionChoiceV1 } from '../../../lib/almoxarifado/positionPlanner';
import { warehouseStockPositionKey } from '../../../lib/warehouse/location';

type Ready = Extract<AlmoxPreviewResultV1,{ok:true}>;
type Alloc = PositionChoiceV1['allocations'][number];
function toBase64(file:File):Promise<string> {
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('Falha ao ler arquivo'));
    reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'');
    reader.readAsDataURL(file);
  });
}
/** Synthetic TXT/PDF preview only; no stock mutations or official authorization. */
export function AlmoxSiscofisWorkbench() {
  const [file,setFile]=useState<File|null>(null);
  const [current,setCurrent]=useState<Ready|null>(null);
  const [choices,setChoices]=useState<Record<string,PositionChoiceV1>>({});
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [separated,setSeparated]=useState(false);
  const [printed,setPrinted]=useState(false);
  const [lastHash,setLastHash]=useState('');
  const [revision,setRevision]=useState(0);

  async function preview(nextChoices:Record<string,PositionChoiceV1> = choices) {
    if (!file || busy) return;
    setBusy(true);setError('');setSeparated(false);setPrinted(false);
    try {
      if (file.size > 2*1024*1024 || file.size === 0) throw new Error('Arquivo deve ter até 2 MiB.');
      const ext=file.name.toLowerCase().endsWith('.pdf')?'PDF':file.name.toLowerCase().endsWith('.txt')?'TXT':null;
      if(!ext) throw new Error('Selecione PDF ou TXT.');
      const token=await auth.currentUser?.getIdToken();
      if(!token) throw new Error('Sessão não autenticada.');
      const resp=await fetch('/api/almoxarifado/preview',{method:'POST',cache:'no-store',
        headers:{'content-type':'application/json',authorization:'Bearer '+token},
        body:JSON.stringify({base64:await toBase64(file),format:ext,filename:file.name,choices:nextChoices})});
      const data=await resp.json() as {ok:boolean;error?:string;result?:Ready};
      if (!resp.ok||!data.ok||!data.result) throw new Error(data.error||'Prévia indisponível');
      if (revision===0 && data.result.request.source.sha256===lastHash) {
        throw new Error('Este arquivo já foi conferido nesta sessão. Não abrir pedido duplicado.');
      }
      setCurrent(data.result);setLastHash(data.result.request.source.sha256);
      setRevision(x=>x+1);
    } catch(e) {
      setError(e instanceof Error?e.message:'Falha na conferência');
    } finally {setBusy(false);}
  }
  function setQuantity(rowId:string, part:Ready['availablePositions'][number], value:string) {
    const quantity=Number(value);
    setChoices(prev=>{
      const old=prev[rowId]||{allowPartial:false,allocations:[]};
      const key=warehouseStockPositionKey(part.position);
      const entries=old.allocations.filter(a=>warehouseStockPositionKey(a.position)!==key);
      if (Number.isFinite(quantity) && quantity>0) entries.push({
        position:part.position as Alloc['position'],balanceRevision:part.balanceRevision,plannedBaseQuantity:quantity});
      return {...prev,[rowId]:{...old,allocations:entries}};
    });
  }
  async function printPdf() {
    if(!current?.sheet)return;
    setBusy(true);setError('');
    try {
      const data=await createSeparationSheetPdf({
        sheet:current.sheet,request:current.request,depots:current.depots,
        locations:current.locations,almoxarifadoName:'Almoxarifado'});
      data.doc.save(data.filename);
      setPrinted(true);
    } catch(e) {setError(e instanceof Error?e.message:'Não foi possível gerar a ficha');}
    finally {setBusy(false);}
  }
  return <div className="mt-6 space-y-4" data-testid="almox-siscofis-w5">
    <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100">
      <strong>Ambiente técnico R1-C:</strong> somente pedidos sintéticos W2. Layouts reais SISCOFIS
      não homologados são rejeitados. Ficha auxiliar não autoriza saída ou baixa.
    </div>
    <label className="block text-sm">Pedido sintético PDF/TXT (até 2 MiB)
      <input className="mt-2 block w-full text-xs" type="file" accept=".pdf,.txt,application/pdf,text/plain"
        onChange={e=>{setFile(e.target.files?.[0]||null);setCurrent(null);setChoices({});setError('');setRevision(0);setLastHash('');}}/>
    </label>
    <button type="button" disabled={!file||busy} onClick={()=>void preview({})}
      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold disabled:opacity-50">
      {busy?'Conferindo...':'Importar e conferir'}
    </button>
    {error&&<p role="alert" className="text-sm text-rose-300">{error}</p>}
    {current&&<>
      <div className="space-y-1 rounded-xl border border-slate-700 p-4 text-sm">
        <p><strong>Pedido:</strong> {current.request.externalRequestNumber} · {current.request.requestingUnit}</p>
        <p><strong>Origem:</strong> {current.request.source.format} · hash {current.request.source.sha256.slice(0,16)}…</p>
        <p><strong>Etapa:</strong> {current.plan.status==='PLANNED'?'Separação planejada':current.plan.status==='PARTIAL'?'Planejamento parcial':'Conferência pendente'}</p>
        <p className="text-amber-200">Sem baixa de estoque. Situação oficial do SISCOFIS não é alterada.</p>
      </div>
      {current.request.rows.map(row=>{
        const p=current.plan.rows.find(p=>p.sourceRowId===row.sourceRowId);
        const pos=current.availablePositions.filter(p=>p.sourceRowId===row.sourceRowId);
        const choice=choices[row.sourceRowId];
        return <div key={row.sourceRowId} className="space-y-2 rounded-xl border border-slate-700 p-3 text-sm">
          <p className="font-semibold">{row.sourceItemCode} · {row.description}</p>
          <p>Solicitada: {row.sourceQuantity} {row.sourceUnit}; unidade-base: {row.canonicalQuantity??'pendente'};
            planejada: {p?.plannedBaseQuantity??0}; correspondência: {row.matchStatus}</p>
          {p?.issues.map((issue,i)=><p className="text-amber-200" key={i}>{issue.code}: {issue.details}</p>)}
          {pos.length>0&&<div className="space-y-2"><p>Posições físicas para conferência e escolha humana:</p>
            {pos.map(item=><label key={warehouseStockPositionKey(item.position)} className="flex flex-wrap items-center gap-2 text-xs">
              <span>{item.depotCode} / {item.locationCode} / {item.subpositionCode||'direto'} (saldo {item.quantity})</span>
              <input type="number" min="0" max={item.quantity} step="any" placeholder="Qtd a separar" aria-label={'Quantidade em '+item.locationCode}
                className="w-28 rounded border border-slate-600 bg-slate-900 p-1"
                value={choice?.allocations.find(a=>warehouseStockPositionKey(a.position)===warehouseStockPositionKey(item.position))?.plannedBaseQuantity??''}
                onChange={e=>setQuantity(row.sourceRowId,item,e.target.value)}/>
            </label>)}
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={choice?.allowPartial||false}
                onChange={e=>setChoices(prev=>({...prev,[row.sourceRowId]:{
                  allowPartial:e.target.checked,allocations:prev[row.sourceRowId]?.allocations||[]}}))}/>
              Autorizo planejar atendimento parcial (não autoriza saída)</label>
          </div>}
        </div>;
      })}
      {current.plan.issues.filter(i=>i.severity==='BLOCKING').map((i,n)=>
        <p key={n} className="text-sm text-amber-300">{i.code}: {i.details}</p>)}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={()=>void preview(choices)} disabled={busy}
          className="rounded-lg border border-slate-500 px-4 py-2 text-sm disabled:opacity-50">
          Validar escolhas e replanejar</button>
        <button type="button" onClick={()=>void printPdf()} disabled={busy||!current.sheet}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm disabled:opacity-50">Emitir ficha PDF A4</button>
      </div>
      {printed&&<label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={separated} onChange={e=>setSeparated(e.target.checked)}/>
        Material separado fisicamente — marcação local de demonstração
      </label>}
      <p className="text-xs text-amber-200">
        {separated?'Separação conferida localmente. ':'Aguardando conferência física. '}
        Confirmação de retirada e movimentação auxiliar DESABILITADAS até homologação
        do evento operacional, idempotência persistente e transação atômica.
      </p>
    </>}
  </div>;
}
