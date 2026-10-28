'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import {warehouseServerCommand} from '../../../lib/warehouse/serverCommandClient';
import {listWarehouseDepots,listWarehouseLocations} from '../../../lib/warehouse/locationRepository';
import {listWarehouseMaterials} from '../../../lib/warehouse/materialRepository';
import type {WarehouseDepotReturnPending} from '../../../lib/server/warehouseDepotReturnReadAndAllocate';
import type {WarehouseStockPosition} from '../../../lib/warehouse/location';

type Target={key:string;label:string;position:Exclude<WarehouseStockPosition,{kind:'UNASSIGNED'}>};
type Catalog={depots:Awaited<ReturnType<typeof listWarehouseDepots>>;
  locations:Awaited<ReturnType<typeof listWarehouseLocations>>;
  names:Record<string,string>};
const emptyCatalog:Catalog={depots:[],locations:[],names:{}};

export function WarehouseDepotReturnsPending({workspaceId}:{workspaceId:string}){
  const [rows,setRows]=useState<WarehouseDepotReturnPending[]>([]);
  const [archived,setArchived]=useState<WarehouseDepotReturnPending[]>([]);
  const [selectedIds,setSelectedIds]=useState<string[]>([]);
  const [showArchived,setShowArchived]=useState(false);
  const [expiryEdit,setExpiryEdit]=useState<{
    returnId:string;lotId:string;expiresOn:string;reason:string
  }|null>(null);
  const [catalog,setCatalog]=useState<Catalog>(emptyCatalog);
  const [selected,setSelected]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);

  const reload=useCallback(async()=>{
    setLoading(true);
    try{
      const [pending,depots,locations,materials]=await Promise.all([
        warehouseServerCommand<WarehouseDepotReturnPending[]>(
          workspaceId,'DEPOT_RETURNS_LIST',{includeArchived:true}),
        listWarehouseDepots(workspaceId),
        listWarehouseLocations(workspaceId),
        listWarehouseMaterials(workspaceId),
      ]);
      const live=pending.filter(item=>item.status==='PENDING');
      setRows(live);
      setArchived(pending.filter(item=>item.status==='ARCHIVED'));
      setSelectedIds(current=>current.filter(id=>live.some(item=>item.id===id)));
      setCatalog({depots,locations,names:Object.fromEntries(
        materials.map(item=>[item.id,item.description]))});
      setError(null);
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Não foi possível consultar devoluções ao recebimento.');
    }finally{setLoading(false);}
  },[workspaceId]);
  useEffect(()=>{void reload();},[reload]);

  const targets=useMemo<Target[]>(()=>{
    const active=new Map(catalog.depots.filter(x=>x.depot.status==='active')
      .map(item=>[item.depot.id,item.depot]));
    const locals=catalog.locations.filter(item=>
      item.location.status==='active'&&item.location.kind==='LOCAL'
      &&active.has(item.location.depotId));
    const byId=new Map(locals.map(item=>[item.location.id,item.location]));
    const choices:Target[]=[];
    for(const {location} of catalog.locations){
      if(location.status!=='active'||!active.has(location.depotId))continue;
      const depot=active.get(location.depotId)!;
      if(location.kind==='LOCAL'){
        choices.push({key:'L:'+location.id,label:depot.code+' · '+location.code+' · '+location.name,
          position:{kind:'LOCATION',depotId:location.depotId,
            locationId:location.id,subpositionId:null}});
      }else if(location.kind==='SUBPOSITION'){
        const parent=byId.get(location.parentLocationId||'');
        if(!parent||parent.depotId!==location.depotId)continue;
        choices.push({key:'S:'+location.id,
          label:depot.code+' · '+parent.code+' / '+location.code+' · '+location.name,
          position:{kind:'SUBPOSITION',depotId:location.depotId,
            locationId:parent.id,subpositionId:location.id}});
      }
    }
    return choices.sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'));
  },[catalog]);

  const allocate=async(row:WarehouseDepotReturnPending)=>{
    const destination=targets.find(item=>item.key===selected[row.id]);
    if(!destination){setError('Selecione o depósito e o local de destino.');return;}
    if(!window.confirm('Realocar '+row.pendingQuantity+' unidade(s) de '
      +(catalog.names[row.materialId]||row.materialId)+' do recebimento para '
      +destination.label+'? Os saldos e lotes serão transferidos em uma transação.'))return;
    setWorking(row.id);setError(null);setMessage(null);
    try{
      await warehouseServerCommand(workspaceId,'DEPOT_RETURN_ALLOCATE',{
        returnId:row.id,position:destination.position,
      });
      setMessage('Material realocado com sucesso. ID preservado e movimentação registrada.');
      await reload();
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Falha ao realocar material.');
    }finally{setWorking(null);}
  };


  const groups=useMemo(()=>{
    const grouped=new Map<string,WarehouseDepotReturnPending[]>();
    for(const item of rows)grouped.set(item.depotId,[...(grouped.get(item.depotId)||[]),item]);
    return [...grouped].map(([id,items])=>({id,items,
      label:items[0].depotCode+' · '+items[0].depotName}));
  },[rows]);
  const toggleIds=(ids:string[],checked:boolean)=>setSelectedIds(current=>
    checked?[...new Set([...current,...ids])]:current.filter(id=>!ids.includes(id)));
  const bulkQueue=async(ids:string[],action:'ARCHIVE'|'RESTORE')=>{
    if(working||!ids.length)return;
    if(ids.length>400){setError('Selecione no máximo 400 registros por operação.');return;}
    const prompt=action==='ARCHIVE'
      ?'Retirar '+ids.length+' registro(s) da fila? Os materiais continuarão no recebimento, sem baixa ou exclusão do estoque. A ação é reversível.'
      :'Restaurar '+ids.length+' registro(s) à fila de recebimento?';
    if(!window.confirm(prompt))return;
    setWorking('bulk');setMessage(null);setError(null);
    try{
      const result=await warehouseServerCommand<{changed:number}>(
        workspaceId,'DEPOT_RETURNS_QUEUE_BULK',{action,returnIds:ids});
      await reload();
      setMessage(result.changed+' registro(s) '+(action==='ARCHIVE'
        ?'retirados da fila. Estoque preservado.':'restaurados para realocação.'));
    }catch(error){setError(error instanceof Error?error.message:'Erro ao atualizar a fila.');}
    finally{setWorking(null);}
  };

  const saveReturnExpiry=async()=>{
    if(!expiryEdit||working||!expiryEdit.expiresOn||expiryEdit.reason.trim().length<5)return;
    setWorking('expiry');setError(null);setMessage(null);
    try{
      await warehouseServerCommand(workspaceId,'DEPOT_RETURN_EXPIRY_UPDATE',{
        returnId:expiryEdit.returnId,lotId:expiryEdit.lotId,
        expiresOn:expiryEdit.expiresOn,reason:expiryEdit.reason.trim(),
      });
      setExpiryEdit(null);
      await reload();
      setMessage('Validade corrigida. A nova data acompanhará o material na realocação, e a alteração foi auditada.');
    }catch(error){setError(error instanceof Error?error.message:'Falha ao corrigir validade.');}
    finally{setWorking(null);}
  };

  if(loading)return <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
    Consultando retornos de depósitos ao recebimento…
  </div>;
  return <section data-testid="warehouse-depot-returns-receiving"
    className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 className="text-sm font-black text-[#00288e]">Recebimento · Materiais devolvidos de depósitos excluídos</h3>
        <p className="text-xs text-slate-600">São retornos internos para realocação, sem gerar Nota Fiscal ou uma nova entrada no estoque.</p>
      </div>
      <button type="button" onClick={()=>void reload()} disabled={!!working}
        className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-800">
        Atualizar
      </button>
    </div>
    {error&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs font-bold text-red-800">{error}</p>}
    {message&&<p role="status" className="rounded-lg border border-green-200 bg-green-50 p-2 text-xs font-semibold">{message}</p>}
    {rows.length>0&&<div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-100 bg-white p-3">
      <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
        <input type="checkbox" disabled={!!working}
          checked={rows.every(item=>selectedIds.includes(item.id))}
          onChange={event=>toggleIds(rows.map(item=>item.id),event.target.checked)}
          className="h-4 w-4" />
        Selecionar todos ({rows.length})
      </label>
      <span className="text-xs text-slate-500">{selectedIds.length} selecionado(s)</span>
      <button type="button" disabled={!!working||selectedIds.length===0}
        onClick={()=>void bulkQueue(selectedIds,'ARCHIVE')}
        className="ml-auto rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold text-amber-900 disabled:opacity-40">
        Remover selecionados
      </button>
      <button type="button" disabled={!!working||rows.length>400}
        onClick={()=>void bulkQueue(rows.map(item=>item.id),'ARCHIVE')}
        className="rounded-lg bg-[#00288e] px-3 py-2 text-xs font-bold text-white disabled:opacity-40">
        Remover todos da fila
      </button>
    </div>}
    {rows.length===0&&!error
      ?<p className="text-xs text-slate-500">Não há retornos de depósito aguardando alocação.</p>
      :groups.map(group=><div key={group.id} className="space-y-2 rounded-xl border border-blue-100 bg-white/70 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-black text-blue-900">
            <input type="checkbox" disabled={!!working}
              checked={group.items.every(item=>selectedIds.includes(item.id))}
              onChange={event=>toggleIds(group.items.map(item=>item.id),event.target.checked)}
              className="h-4 w-4" />
            {group.label} · {group.items.length} material(is)
          </label>
          <button type="button" disabled={!!working||group.items.length>400}
            onClick={()=>void bulkQueue(group.items.map(item=>item.id),'ARCHIVE')}
            className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold text-amber-900 disabled:opacity-40">
            Remover grupo
          </button>
        </div>
        {group.items.map(row=><div key={row.id} className="rounded-xl border border-slate-200 bg-white p-3">
        <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
          <input type="checkbox" disabled={!!working}
            checked={selectedIds.includes(row.id)}
            onChange={event=>toggleIds([row.id],event.target.checked)}
            className="h-4 w-4" />
          Selecionar material
        </label>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-slate-800">{catalog.names[row.materialId]||row.materialId}</p>
            <p className="text-xs text-slate-600">
              {row.pendingQuantity.toLocaleString('pt-BR')} em recebimento · Origem: {row.depotCode} ({row.depotName})
            </p>
            <p className="text-[10px] text-slate-500">
              {row.lotReferences.length>0
                ?row.lotReferences.length+' referência(s) de lote/validade preservada(s)'
                :'Material sem lote de validade vinculado'}
            </p>
            {row.lotReferences.map(lot=><div key={lot.id}
              className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
              <div className="flex flex-wrap items-center gap-2">
                <span>Validade: <strong>{lot.expiresOn?lot.expiresOn.split('-').reverse().join('/'):'Não informada'}</strong></span>
                <button type="button" disabled={!!working}
                  onClick={()=>setExpiryEdit({returnId:row.id,lotId:lot.id,
                    expiresOn:lot.expiresOn||'',reason:''})}
                  className="rounded-lg border border-blue-200 bg-white px-2 py-1 text-[10px] font-bold text-blue-900 disabled:opacity-40">
                  Editar validade
                </button>
              </div>
              {expiryEdit?.returnId===row.id&&expiryEdit?.lotId===lot.id&&
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input type="date" value={expiryEdit.expiresOn} disabled={!!working}
                    onChange={event=>setExpiryEdit(current=>current?{
                      ...current,expiresOn:event.target.value}:null)}
                    aria-label="Nova validade do material devolvido"
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1" />
                  <input value={expiryEdit.reason} maxLength={180} disabled={!!working}
                    placeholder="Justificativa documental"
                    onChange={event=>setExpiryEdit(current=>current?{
                      ...current,reason:event.target.value}:null)}
                    aria-label="Justificativa da nova validade"
                    className="min-w-44 rounded-lg border border-slate-300 bg-white px-2 py-1" />
                  <button type="button" onClick={()=>void saveReturnExpiry()}
                    disabled={!!working||!expiryEdit.expiresOn||expiryEdit.reason.trim().length<5}
                    className="rounded-lg bg-blue-900 px-2 py-1 text-xs font-bold text-white disabled:opacity-40">
                    Salvar
                  </button>
                  <button type="button" onClick={()=>setExpiryEdit(null)}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs">Cancelar</button>
                </div>}
            </div>)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold text-slate-700">Destino
              <select value={selected[row.id]||''} disabled={!!working}
                onChange={event=>setSelected(prev=>({...prev,[row.id]:event.target.value}))}
                className="ml-2 max-w-72 rounded-lg border border-slate-300 bg-white p-2 text-xs">
                <option value="">Selecione local ativo</option>
                {targets.map(t=><option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </label>
            <button type="button" disabled={!!working||!selected[row.id]}
              onClick={()=>void allocate(row)}
              className="rounded-xl bg-[#00288e] px-3 py-2 text-xs font-bold text-white disabled:opacity-40">
              {working===row.id?'Alocando…':'Alocar'}
            </button>
          </div>
        </div>
      </div>)}
      </div>)}
    <div className="border-t border-blue-100 pt-3">
      <button type="button" onClick={()=>setShowArchived(current=>!current)}
        className="text-xs font-bold text-blue-800 underline underline-offset-2">
        {showArchived?'Ocultar':'Ver'} retirados da fila ({archived.length})
      </button>
      {showArchived&&<div className="mt-3 space-y-2 rounded-xl bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-600">Pendências preservadas. O saldo continua no recebimento.</p>
          <button type="button" disabled={!!working||archived.length===0||archived.length>400}
            onClick={()=>void bulkQueue(archived.map(item=>item.id),'RESTORE')}
            className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-800 disabled:opacity-40">
            Restaurar todos
          </button>
        </div>
        {archived.map(item=><div key={item.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-2">
          <p className="text-xs font-semibold text-slate-700">
            {catalog.names[item.materialId]||item.materialId}
            {' · '}{item.pendingQuantity.toLocaleString('pt-BR')}{' · '}{item.depotCode}
          </p>
          <button type="button" disabled={!!working}
            onClick={()=>void bulkQueue([item.id],'RESTORE')}
            className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-800 disabled:opacity-40">
            Restaurar
          </button>
        </div>)}
      </div>}
    </div>
  </section>;
}
