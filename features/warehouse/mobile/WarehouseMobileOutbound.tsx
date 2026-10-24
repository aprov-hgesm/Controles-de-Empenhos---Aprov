'use client';

import { ArrowLeft, CheckCircle2, ShieldCheck, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { auth } from '../../../lib/firebase';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { WarehouseBarcodeAssociation } from '../../../lib/warehouse/barcode';
import { getWarehouseMobileBarcodeByCode } from '../../../lib/warehouse/mobileBarcodeReadClient';
import {
  warehouseStockPositionKey, warehouseStockPositionsEqual,
  type WarehouseLocationBalance, type WarehouseStockPosition,
} from '../../../lib/warehouse/location';
import type { WarehouseStockPositionResolveResult } from '../../../lib/warehouse/locationBarcode';
import { resolveWarehouseStockPositionBarcode } from '../../../lib/warehouse/mobileLocationBarcodeResolver';
import { classifyWarehouseMobileProductScan } from '../../../lib/warehouse/mobileIntakeAllocation';
import {
  loadWarehouseMobileOutboundAvailability,
  type WarehouseMobileOutboundAvailability,
} from '../../../lib/warehouse/mobileOutboundRepository';
import {
  loadWarehouseMobilePhysicalPositionContents,
  type WarehouseMobilePhysicalQueryResult,
} from '../../../lib/warehouse/mobilePhysicalQuery';
import { prepareWarehouseMobileOutboundReview } from '../../../lib/warehouse/mobileOutbound';
import { planMobileOutboundAutomaticLots } from '../../../lib/warehouse/mobileOutboundPlan.mjs';
import type { WarehouseMobileScanEvent } from '../../../lib/warehouse/mobileScanner';
import { warehouseServerCommand } from '../../../lib/warehouse/serverCommandClient';
import {
  createWarehouseWithdrawalId,createWarehouseWithdrawalLineId,
  type WarehouseWithdrawalLineInput,
} from '../../../lib/warehouse/withdrawal';
import type { FinalizeWarehouseMaterialWithdrawalResult } from '../../../lib/warehouse/withdrawalRepository';
import {
  createWarehouseDestination,listWarehouseDestinationsCached,
} from '../../../lib/warehouse/mobileDestinationClient';
import type { WarehouseDestinationListItem } from '../../../lib/warehouse/withdrawal';
import { useWarehouseWorkspaceContext } from '../components/WarehouseModuleContext';
import { WarehouseMobileScanner } from './WarehouseMobileScanner';

type ResolvedPosition = Extract<WarehouseStockPositionResolveResult,{ok:true}>['value'];
type Product = {
  barcode: string|null;
  association: WarehouseBarcodeAssociation|null;
  availability: WarehouseMobileOutboundAvailability;
};
type Origin = {
  position: Exclude<WarehouseStockPosition,{kind:'UNASSIGNED'}>;
  balance: WarehouseLocationBalance;
  label:string;
};
type LocationScan = {
  code:string; resolved:ResolvedPosition;
  contents:WarehouseMobilePhysicalQueryResult;
};
type Review = {
  withdrawalId:string;
  requestedQuantity:number;
  baseQuantity:number;
  lines:WarehouseWithdrawalLineInput[];
};
type PendingWithdrawal = {
  workspaceId:string;ug:string;uid:string;destinationId:string;review:Review;
};
function pendingKey(workspaceId:string,uid:string) {
  return 'emprovex:mobile-withdrawal-r2:'+workspaceId+':'+uid;
}
type Success = {
  withdrawalId:string; movementIds:string[];
  quantity:number;
  balance:number|null;
};

function format(n:number){return n.toLocaleString('pt-BR',{maximumFractionDigits:6});}
function unit(code:string,label:string|null) {
  return label||({unit:'un',kg:'kg',g:'g',l:'L',ml:'mL',package:'pacote',box:'caixa',
    bundle:'fardo',other:'unidade'} as Record<string,string>)[code]||code;
}
function labelForPosition(value:ResolvedPosition) {
  if(value.position.kind==='UNASSIGNED')return 'Posição não física';
  return value.depot.code+' · '
    +(value.position.kind==='SUBPOSITION'
      ?(value.parentLocation?.code||value.position.locationId)+' · '
        +(value.location?.code||value.position.subpositionId)
      :(value.location?.code||value.position.locationId));
}
function messageFor(error:unknown) {
  const e=error instanceof Error?error.message:String(error);
  if(e.includes('WAREHOUSE_MOBILE_OUTBOUND_LOT_OVERATTRIBUTED'))
    return 'As quantidades vinculadas às validades excedem o saldo físico. Confira a Central.';
  if(e.includes('WAREHOUSE_MOBILE_OUTBOUND_LOTS_NOT_ELIGIBLE'))
    return 'Existe saldo vinculado a uma validade indisponível. A saída foi bloqueada.';
  if(e.includes('WAREHOUSE_OUTBOUND_LOCATION_INSUFFICIENT_STOCK')
    ||e.includes('WAREHOUSE_MOBILE_OUTBOUND_INVALID_QUANTITY'))
    return 'A posição não tem quantidade suficiente ou a quantidade é inválida.';
  if(e.includes('WAREHOUSE_DESTINATION_INACTIVE'))
    return 'O destino está inativo. Escolha outro.';
  if(e.includes('WAREHOUSE_BARCODE_INACTIVE'))return 'Código de barras inativo.';
  if(e.includes('WAREHOUSE_MOBILE_READ_')||e.includes('WAREHOUSE_MOBILE_TRUST_'))
    return 'Falha de autorização ou leitura no servidor. Confira o acesso e tente novamente.';
  if(e.includes('POSITION:'))return 'Não foi possível confirmar a localização. Leia um local ou subposição ativo.';
  if(e.includes('WAREHOUSE_IDEMPOTENCY_CONFLICT')
    ||e.includes('WAREHOUSE_WITHDRAWAL_IDEMPOTENCY_CONFLICT'))
    return 'A retirada mudou após ser preparada. Confira o histórico antes de iniciar outra.';
  return 'Não foi possível concluir. Se já confirmou a saída, consulte o saldo antes de criar outra operação. '
    +'Código: '+(e.match(/WAREHOUSE_[A-Z0-9_]+/)?.[0]||'NÃO CONFIRMADO');
}

function Panel({title,children}:{title:string;children:ReactNode}) {
  return <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
    <h2 className="text-base font-black text-slate-950">{title}</h2>{children}
  </section>;
}
function Primary({onClick,children,disabled=false}:{onClick:()=>void;children:ReactNode;disabled?:boolean}) {
  return <button type="button" disabled={disabled} onClick={onClick}
    className="min-h-12 w-full rounded-2xl bg-[#00288e] px-4 py-3 text-sm font-black text-white disabled:opacity-50">
    {children}
  </button>;
}
function Option({onClick,title,detail,disabled=false}:{onClick:()=>void;title:string;detail:string;disabled?:boolean}) {
  return <button type="button" disabled={disabled} onClick={onClick}
    className="min-h-16 w-full rounded-2xl border border-slate-200 bg-white p-4 text-left disabled:opacity-50">
    <span className="block text-sm font-black text-slate-950">{title}</span>
    <span className="mt-1 block text-xs font-semibold text-slate-500">{detail}</span>
  </button>;
}

export function WarehouseMobileOutbound() {
  const workspace=useWarehouseWorkspaceContext();
  const requestId=useRef(0);
  const confirming=useRef(false);
  const [location,setLocation]=useState<LocationScan|null>(null);
  const [product,setProduct]=useState<Product|null>(null);
  const [origin,setOrigin]=useState<Origin|null>(null);
  const [quantityText,setQuantityText]=useState('');
  const [review,setReview]=useState<Review|null>(null);
  const [destinationId,setDestinationId]=useState('');
  const [destinations,setDestinations]=useState<WarehouseDestinationListItem[]>([]);
  const [destinationsLoaded,setDestinationsLoaded]=useState(false);
  const [newDestination,setNewDestination]=useState('');
  const [destinationReady,setDestinationReady]=useState(false);
  const [success,setSuccess]=useState<Success|null>(null);
  const [working,setWorking]=useState(false);
  const [message,setMessage]=useState<string|null>(null);
  const [pending,setPending]=useState<PendingWithdrawal|null>(null);
  const [recoveryLoaded,setRecoveryLoaded]=useState(false);
  const [recoveryBlocked,setRecoveryBlocked]=useState(false);

  // Após reload/queda de rede, NÃO gerar outra identidade de retirada.
  // O mesmo comando persiste apenas nesta sessão e neste usuário/workspace.
  useEffect(()=>{
    const uid=auth.currentUser?.uid;
    if(!uid){setRecoveryLoaded(true);return;}
    try {
      const saved=sessionStorage.getItem(pendingKey(workspace.workspaceId,uid));
      if(saved) {
        const raw=JSON.parse(saved) as Partial<PendingWithdrawal>;
        if(raw.workspaceId!==workspace.workspaceId||raw.ug!==workspace.ug
          ||raw.uid!==uid||typeof raw.destinationId!=='string'
          ||!raw.review||!/^wd_[a-f0-9]{32}$/.test(raw.review.withdrawalId)
          ||!Array.isArray(raw.review.lines)||raw.review.lines.length===0) {
          throw Error('WAREHOUSE_WITHDRAWAL_PENDING_INVALID');
        }
        setPending(raw as PendingWithdrawal);
      }
    } catch {
      // Não apagar um comando possivelmente confirmado sem reconciliação.
      setRecoveryBlocked(true);
      setMessage('Há uma saída pendente que não pôde ser recuperada nesta sessão. Consulte o histórico antes de criar outra.');
    }
    setRecoveryLoaded(true);
  },[workspace.workspaceId,workspace.ug]);

  const reset=useCallback(()=>{
    if(pending)return; // Baixa incerta nunca é descartada por troca de tela.
    requestId.current++;
    setLocation(null);setProduct(null);setOrigin(null);setQuantityText('');
    setReview(null);setDestinationId('');setNewDestination('');setDestinationReady(false);
    setSuccess(null);setMessage(null);setWorking(false);
  },[pending]);

  const options=(value:Product):Origin[]=>value.availability.locationBalances
    .filter((row):row is WarehouseLocationBalance & {position:Exclude<WarehouseStockPosition,{kind:'UNASSIGNED'}>}=>
      row.quantity>0&&row.position.kind!=='UNASSIGNED')
    .map(row=>({
      position:row.position,
      balance:row,
      label:value.availability.positionLabels.find(l=>l.key===warehouseStockPositionKey(row.position))?.label
        ||warehouseStockPositionKey(row.position),
    }));

  const loadProduct=useCallback(async(materialId:string,association:WarehouseBarcodeAssociation|null,barcode:string|null)=>{
    const availability=await loadWarehouseMobileOutboundAvailability(workspace.workspaceId,materialId);
    if(availability.material.status!=='active'||availability.material.id!==materialId
      ||availability.material.ug!==workspace.ug)throw Error('WAREHOUSE_MOBILE_MATERIAL_INACTIVE');
    return {availability,association,barcode} as Product;
  },[workspace.workspaceId,workspace.ug]);

  const scan=useCallback((event:WarehouseMobileScanEvent)=>{
    const current=++requestId.current;
    setWorking(true);setMessage(null);
    void (async()=>{
      if(!workspace.ug)throw Error('WAREHOUSE_MOBILE_UG_REQUIRED');
      if(event.kind==='LOCATION') {
        const resolved=await resolveWarehouseStockPositionBarcode({
          code:event.value,workspaceId:workspace.workspaceId,ug:workspace.ug,
        });
        if(!resolved.ok)throw Error('POSITION:'+resolved.error);
        const contents=await loadWarehouseMobilePhysicalPositionContents({
          workspaceId:workspace.workspaceId,ug:workspace.ug,position:resolved.value.position,
        });
        if(current!==requestId.current)return;
        const available=contents.items.filter(item=>
          item.material.status==='active'&&item.balance.quantity>0);
        if(available.length===1) {
          const value=await loadProduct(available[0].material.id,null,null);
          if(current!==requestId.current)return;
          const selected=options(value).find(o=>
            warehouseStockPositionsEqual(o.position,resolved.value.position));
          if(!selected)throw Error('WAREHOUSE_OUTBOUND_LOCATION_INSUFFICIENT_STOCK');
          setLocation({code:event.value,resolved:resolved.value,contents});
          setProduct(value);setOrigin(selected);
        } else {
          setLocation({code:event.value,resolved:resolved.value,contents});
          setProduct(null);setOrigin(null);
        }
      } else if(event.kind==='PRODUCT') {
        const association=await getWarehouseMobileBarcodeByCode(workspace.workspaceId,event.value);
        if(!association||association.status!=='active'||association.ug!==workspace.ug)
          throw Error('WAREHOUSE_BARCODE_INACTIVE');
        const value=await loadProduct(association.materialId,association,event.value);
        if(current!==requestId.current)return;
        const available=options(value);
        if(!available.length)throw Error('WAREHOUSE_OUTBOUND_LOCATION_INSUFFICIENT_STOCK');
        setLocation(null);setProduct(value);
        setOrigin(available.length===1?available[0]:null);
      } else throw Error('WAREHOUSE_MOBILE_SCAN_UNKNOWN');
    })().catch(e=>{if(current===requestId.current)setMessage(messageFor(e));})
      .finally(()=>{if(current===requestId.current)setWorking(false);});
  },[workspace.workspaceId,workspace.ug,loadProduct]);

  const chooseFromLocation=useCallback(async(materialId:string)=>{
    if(!location)return;
    const current=++requestId.current;
    setWorking(true);setMessage(null);
    try {
      const value=await loadProduct(materialId,null,null);
      if(current!==requestId.current)return;
      const selected=options(value).find(o=>
        warehouseStockPositionsEqual(o.position,location.resolved.position));
      if(!selected)throw Error('WAREHOUSE_OUTBOUND_LOCATION_INSUFFICIENT_STOCK');
      setProduct(value);setOrigin(selected);
    }catch(e){if(current===requestId.current)setMessage(messageFor(e));}
    finally{if(current===requestId.current)setWorking(false);}
  },[location,loadProduct]);

  const continueQuantity=()=>{
    if(!product||!origin)return;
    try{
      const qty=Number(quantityText.trim().replace(',','.'));
      const plan=prepareWarehouseMobileOutboundReview({
        material:product.availability.material,
        balance:product.availability.balance,
        barcodeAssociation:product.association,
        requestedQuantity:qty,
        position:origin.position,
        locationBalance:origin.balance,
      });
      const positionLots=product.availability.lots.filter(lot=>
        warehouseStockPositionsEqual(lot.position,origin.position));
      const allocation=planMobileOutboundAutomaticLots({
        quantity:plan.baseQuantity,physicalQuantity:origin.balance.quantity,lots:positionLots,
      });
      const lines:WarehouseWithdrawalLineInput[]=allocation.map(line=>({
        lineId:createWarehouseWithdrawalLineId(),
        materialId:product.availability.material.id,
        materialDescription:product.availability.material.description,
        // Base oficial: cada parte conserva fator 1, inclusive multiplos lotes.
        requestedQuantity:line.quantity,baseQuantity:line.quantity,
        presentation:product.availability.material.unit,
        presentationLabel:unit(product.availability.material.unit.code,product.availability.material.unit.label),
        unitLabel:unit(product.availability.material.unit.code,product.availability.material.unit.label),
        position:origin.position,positionLabel:origin.label,
        barcodeAssociation:null,barcode:product.barcode,
        lotId:line.lotId,
        lotCode:positionLots.find(l=>l.id===line.lotId)?.code||null,
      }));
      setReview({
        withdrawalId:createWarehouseWithdrawalId(),requestedQuantity:qty,
        baseQuantity:plan.baseQuantity,lines,
      });
      setMessage(null);setDestinationReady(false);
    }catch(e){setMessage(messageFor(e));}
  };

  const loadDestinations=useCallback(async()=>{
    if(destinationsLoaded)return;
    try{
      const values=await listWarehouseDestinationsCached(workspace.workspaceId,250);
      setDestinations(values);setDestinationsLoaded(true);
    }catch(e){setMessage(messageFor(e));}
  },[workspace.workspaceId,destinationsLoaded]);
  useEffect(()=>{if(review&&!destinationsLoaded)void loadDestinations();},[review,destinationsLoaded,loadDestinations]);

  const addDestination=async()=>{
    if(newDestination.trim().length<2)return;
    setWorking(true);setMessage(null);
    try{
      const destination=await createWarehouseDestination(workspace.workspaceId,{name:newDestination.trim()});
      setDestinations(prev=>[...prev,{destination,createdAt:null,updatedAt:null}]);
      setDestinationsLoaded(true);setDestinationId(destination.id);setNewDestination('');
    }catch(e){setMessage(messageFor(e));}
    finally{setWorking(false);}
  };

  const resumeWithdrawal=async(command:PendingWithdrawal)=>{
    if(confirming.current)return;
    confirming.current=true;setWorking(true);setMessage(null);
    try {
      const uid=auth.currentUser?.uid;
      if(!uid||command.uid!==uid||command.workspaceId!==workspace.workspaceId
        ||command.ug!==workspace.ug)throw Error('WAREHOUSE_WITHDRAWAL_AUTH_REQUIRED');
      const result=await warehouseServerCommand<FinalizeWarehouseMaterialWithdrawalResult>(
        command.workspaceId,'WITHDRAWAL_FINALIZE_MOBILE',{
          withdrawalId:command.review.withdrawalId,
          destinationId:command.destinationId,lines:command.review.lines,
        });
      if(result.withdrawal.id!==command.review.withdrawalId
        ||result.withdrawal.status!=='FINALIZED') {
        throw Error('WAREHOUSE_WITHDRAWAL_RECONCILIATION_REQUIRED');
      }
      let updated:number|null=null;
      if(product) {
        try {
          const availability=await loadWarehouseMobileOutboundAvailability(
            command.workspaceId,product.availability.material.id);
          updated=availability.balance.quantity;
        } catch { /* Commit já confirmado; leitura complementar não decide sucesso. */ }
      }
      sessionStorage.removeItem(pendingKey(command.workspaceId,uid));
      setPending(null);
      setSuccess({
        withdrawalId:result.withdrawal.id,movementIds:result.movementIds,
        quantity:command.review.baseQuantity,balance:updated,
      });
      setMessage(null);
    }catch(e){
      // Retirar da sessão um comando de resultado desconhecido permitiria dupla baixa.
      setMessage(messageFor(e)+' Retente a MESMA retirada abaixo; não inicie outra.');
    }finally{confirming.current=false;setWorking(false);}
  };
  const confirm=async()=>{
    if(!product||!origin||!review||!destinationReady||!destinationId
      ||working||confirming.current||pending)return;
    try {
      const uid=auth.currentUser?.uid;
      if(!uid)throw Error('WAREHOUSE_WITHDRAWAL_AUTH_REQUIRED');
      const command:PendingWithdrawal={
        workspaceId:workspace.workspaceId,ug:workspace.ug,uid,destinationId,review,
      };
      // Persistir ANTES do envio: uma resposta perdida ou reload preserva
      // withdrawalId, lineIds, validades e payload exatamente idênticos.
      sessionStorage.setItem(pendingKey(workspace.workspaceId,uid),JSON.stringify(command));
      setPending(command);
      await resumeWithdrawal(command);
    }catch(e){setMessage(messageFor(e));}
  };

  const allPositions=product?options(product):[];
  const activeDestinations=destinations.filter(x=>x.destination.status==='active');
  const destinationName=activeDestinations.find(x=>x.destination.id===destinationId)?.destination.name||'';
  const productLabel=product?.availability.material.description||'';

  return <div className="space-y-5" data-testid="warehouse-mobile-outbound">
    <header className="rounded-3xl bg-[#00288e] p-5 text-white">
      <Link href="/operador-movel" className="inline-flex items-center gap-2 text-xs font-black text-blue-100">
        <ArrowLeft className="h-4 w-4"/> Operador Móvel
      </Link>
      <h1 className="mt-4 text-2xl font-black">Saída de materiais</h1>
      <p className="mt-2 text-xs font-semibold text-blue-100">
        Ler código de barras → quantidade → destino → revisar e confirmar
      </p>
    </header>
    {message&&<p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{message}</p>}
    {working&&<p className="rounded-2xl bg-blue-50 p-3 text-xs font-bold text-blue-900">
      Verificando dados com o servidor…
    </p>}

    {!recoveryLoaded&&<p className="text-sm font-semibold">Verificando retirada pendente nesta sessão…</p>}
    {recoveryBlocked&&<Panel title="Reconciliação necessária">
      <p className="text-sm text-red-800">A operação pendente está ilegível ou o armazenamento da sessão falhou.
      Nenhuma nova baixa será permitida nesta tela até a conferência do histórico.</p>
    </Panel>}
    {pending&&<Panel title="Retirada pendente · reconciliar antes de continuar">
      <p className="text-sm font-semibold text-amber-900">
        O resultado da última confirmação pode ter sido perdido pela rede.
        Não será gerada uma segunda retirada: o servidor verificará a mesma identidade.
      </p>
      <p className="break-all font-mono text-[10px]">{pending.review.withdrawalId}</p>
      <Primary disabled={working} onClick={()=>void resumeWithdrawal(pending)}>
        {working?'VERIFICANDO…':'VERIFICAR E RETOMAR A MESMA SAÍDA'}
      </Primary>
    </Panel>}
    {recoveryLoaded&&!recoveryBlocked&&!pending&&!success&&<Panel title="1 · LER CÓDIGO DE BARRAS">
      {!location&&!product&&<WarehouseMobileScanner
        expectation="EXPECT_PRODUCT_OR_LOCATION"
        identifyScan={classifyWarehouseMobileProductScan}
        onValidatedScan={scan}
        title="LER ITEM OU LOCAL"
      />}
      {location&&<p className="rounded-xl bg-blue-50 p-3 text-xs font-bold text-blue-900">
        Local lido: {labelForPosition(location.resolved)}
      </p>}
      {location&&!product&&<>
        <p className="text-xs font-semibold text-slate-600">Selecione o material deste local:</p>
        {location.contents.items.length===0&&
          <p className="text-xs text-amber-800">Este local não possui materiais com saldo positivo.</p>}
        {location.contents.items.filter(item=>item.material.status==='active').map(item=>
          <Option key={item.material.id} disabled={working}
            title={item.material.description}
            detail={'Disponível: '+format(item.balance.quantity)}
            onClick={()=>void chooseFromLocation(item.material.id)}/>
        )}
      </>}
      {product&&<p className="rounded-xl bg-emerald-50 p-3 text-sm font-black text-emerald-950">
        {productLabel}
      </p>}
      {product&&!origin&&<>
        <p className="text-xs font-semibold text-slate-600">
          Este item está em mais de um local. Selecione a origem:
        </p>
        {allPositions.map(option=><Option key={warehouseStockPositionKey(option.position)}
          disabled={working} title={option.label}
          detail={'Saldo: '+format(option.balance.quantity)}
          onClick={()=>{setOrigin(option);setQuantityText('');setReview(null);}}/>)}
      </>}
      {origin&&<p className="rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-700">
        Origem: {origin.label} · Disponível: {format(origin.balance.quantity)}
      </p>}
      {(location||product)&&<button type="button" onClick={reset}
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-xs font-black">
        Ler outro código
      </button>}
    </Panel>}

    {recoveryLoaded&&!recoveryBlocked&&!pending&&product&&origin&&!review&&!success&&<Panel title="2 · INDICAR QUANTIDADE">
      <p className="text-xs text-slate-600">
        Apresentação: {product.association
          ?unit(product.association.presentation.code,product.association.presentation.label)
          :unit(product.availability.material.unit.code,product.availability.material.unit.label)}
      </p>
      <input type="text" inputMode="decimal" value={quantityText}
        data-testid="warehouse-mobile-outbound-quantity"
        onChange={e=>{setQuantityText(e.target.value);setMessage(null);}}
        placeholder="Quantidade a retirar"
        className="min-h-12 w-full rounded-xl border border-slate-200 px-4 font-bold"/>
      <p className="text-xs text-slate-500">
        A validade continua registrada automaticamente. A baixa de estoque é conciliada automaticamente.
      </p>
      <Primary onClick={continueQuantity}>Continuar para destino</Primary>
    </Panel>}

    {recoveryLoaded&&!recoveryBlocked&&!pending&&review&&!destinationReady&&!success&&<Panel title="3 · DESTINO">
      <p className="text-xs font-semibold text-slate-600">
        A identidade do responsável será registrada automaticamente pela conta autenticada.
      </p>
      <select value={destinationId}
        data-testid="warehouse-mobile-outbound-destination"
        onChange={e=>{setDestinationId(e.target.value);setMessage(null);}}
        className="min-h-12 w-full rounded-xl border border-slate-200 px-3 font-semibold">
        <option value="">{destinationsLoaded?'Selecione o destino':'Carregando destinos…'}</option>
        {activeDestinations.map(x=><option key={x.destination.id} value={x.destination.id}>
          {x.destination.name}</option>)}
      </select>
      <div className="flex gap-2">
        <input value={newDestination} data-testid="warehouse-mobile-outbound-new-destination"
          onChange={e=>setNewDestination(e.target.value)} maxLength={120}
          placeholder="Cadastrar novo destino" className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-200 px-3"/>
        <button type="button" disabled={working||newDestination.trim().length<2}
          data-testid="warehouse-mobile-outbound-create-destination"
          onClick={()=>void addDestination()}
          className="rounded-xl border border-blue-900 px-3 text-xs font-black text-blue-900 disabled:opacity-50">
          Cadastrar
        </button>
      </div>
      <Primary disabled={!destinationId||working} onClick={()=>setDestinationReady(true)}>
        Revisar saída
      </Primary>
    </Panel>}

    {recoveryLoaded&&!recoveryBlocked&&!pending&&review&&destinationReady&&!success&&<Panel title="4 · REVISAR E CONFIRMAR">
      <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-xs font-semibold"
        data-testid="warehouse-mobile-outbound-review">
        <p className="flex items-center gap-2 font-black text-emerald-800">
          <ShieldCheck className="h-4 w-4"/> Nenhuma baixa foi realizada até a confirmação.
        </p>
        <p>Material: {productLabel}</p>
        <p>Origem: {origin?.label}</p>
        <p>Quantidade: {format(review.requestedQuantity)} → {format(review.baseQuantity)} em unidade-base</p>
        <p>Destino: {destinationName}</p>
        <p>Responsável: conta autenticada no EMPROVEX</p>
        <p>Validade rastreada automaticamente na movimentação.</p>
      </div>
      <Primary disabled={working} onClick={()=>void confirm()}>
        {working?'REVALIDANDO…':'CONFIRMAR SAÍDA'}
      </Primary>
      <button type="button" disabled={working} onClick={()=>setDestinationReady(false)}
        className="w-full rounded-xl border border-slate-200 p-3 text-xs font-bold">
        Alterar destino
      </button>
      <p className="text-xs text-slate-500">
        Em falha de conexão, a mesma identificação é preservada para evitar baixa duplicada.
      </p>
    </Panel>}

    {success&&<Panel title="Saída concluída">
      <p className="flex items-center gap-2 font-black text-emerald-800">
        <CheckCircle2 className="h-5 w-5"/> Retirada registrada
      </p>
      <p className="text-xs font-semibold">
        Retirado: {format(success.quantity)} unidades-base
        {success.balance!==null?' · Saldo agregado: '+format(success.balance):''}
      </p>
      <p className="break-all font-mono text-[10px]">{success.withdrawalId}</p>
      <Primary onClick={reset}>Nova saída</Primary>
    </Panel>}
    <p className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
      <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600"/>
      A saída reduz estoque físico localizado; não transfere para outra posição.
      O servidor revalida os saldos, o destino, a autorização e a rastreabilidade antes de gravar.
    </p>
  </div>;
}
