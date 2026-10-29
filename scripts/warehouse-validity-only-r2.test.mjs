#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { planMobileOutboundAutomaticLots } from '../lib/warehouse/mobileOutboundPlan.mjs';
import { replanDesktopWithdrawalCart } from '../lib/warehouse/desktopWithdrawalReplan.mjs';
import ts from 'typescript';
import { runInNewContext } from 'node:vm';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const active=[
  'features/warehouse/components/WarehouseHomeOperational.tsx',
  'features/warehouse/components/WarehouseDepotViewOperational.tsx',
  'features/warehouse/components/WarehouseStockOperational.tsx',
  'features/warehouse/components/WarehouseMaterialWithdrawal.tsx',
  'features/warehouse/mobile/WarehouseMobileOutbound.tsx',
];
test('nenhuma area ativa seleciona prioridade FEFO ou exibe lotes tecnicos',()=>{
  for(const path of active){
    const s=read(path);
    assert.doesNotMatch(s,/selectWarehouseFefoLot|prioridade FEFO|Recomendação FEFO|Validade \/ FEFO|data-fefo-highlighted/,
      path);
  }
  assert.doesNotMatch(read('lib/warehouse/lot.ts'),/export function selectWarehouseFefoLot/);
  const item=read('features/warehouse/mobile/WarehouseMobileItemQuery.tsx');
  const physical=read('features/warehouse/mobile/WarehouseMobilePhysicalQueryResult.tsx');
  assert.doesNotMatch(item,/warehouseLotDisplayCode|Lote \{/);
  assert.doesNotMatch(physical,/warehouseLotDisplayCode|Lote \{/);
  const csv=read('features/warehouse/components/WarehouseConsumptionReports.tsx');
  assert.doesNotMatch(csv,/'Lote', 'SISCOFIS'/);
  assert.doesNotMatch(read('lib/warehouse/logisticsAlerts.ts'),/Lote ' \+ lot\.code/);
  assert.match(read('lib/warehouse/stockView.ts'),/left\.material\.description\.localeCompare/);
  const positionCheck=read('features/warehouse/mobile/WarehouseMobilePositionCheck.tsx');
  assert.doesNotMatch(positionCheck,/warehouseLotDisplayCode|Lote \{/);
  const intake=read('features/warehouse/mobile/WarehouseMobileIntakeAllocation.tsx');
  assert.doesNotMatch(intake,/referência técnica do lote|posição, lote, barcode/);
  const validityRepository=read('lib/warehouse/lotRepository.ts');
  assert.doesNotMatch(validityRepository,/expiryCompare|expiryA\.localeCompare/);
  assert.match(validityRepository,/left\.lot\.id\.localeCompare\(right\.lot\.id\)/);

});
test('baixa automatica ignora ordem de validade e preserva totais por referencia',()=>{
  const lots=[
    {id:'lot_'+'b'.repeat(32),code:'B',quantity:6,status:'active',expiresOn:'2027-01-01'},
    {id:'lot_'+'a'.repeat(32),code:'A',quantity:6,status:'active',expiresOn:'2028-10-01'},
  ];
  const result=planMobileOutboundAutomaticLots({quantity:8,physicalQuantity:12,lots,today:new Date('2026-10-24')});
  assert.deepEqual(result,[{lotId:lots[1].id,quantity:6},{lotId:lots[0].id,quantity:2}]);
});
test('inventario fisico concilia validades por ID, jamais por prioridade de vencimento',()=>{
  const inventory=read('lib/server/warehouseInventoryAdjustment.ts');
  assert.match(inventory,/active\.sort\(\(a,b\)=>a\.lot\.id\.localeCompare\(b\.lot\.id\)\)/);
  assert.doesNotMatch(inventory,/active\.sort\([^\n]*expiresOn|Reconciliar lotes FEFO/);
  assert.match(inventory,/warehouseAdminTransaction/);
});
test('retirada Desktop e Movel reutilizam o mesmo planejamento e autorizacao',()=>{
  const desktop=read('features/warehouse/components/WarehouseMaterialWithdrawal.tsx');
  const mobile=read('features/warehouse/mobile/WarehouseMobileOutbound.tsx');
  const route=read('app/api/central-depositos/operations/route.ts');
  assert.match(desktop,/planMobileOutboundAutomaticLots/);
  assert.match(mobile,/WAREHOUSE_WITHDRAWAL_COMMAND_V3/);
  const v3=read('lib/server/warehouseWithdrawalV3Write.ts');
  assert.match(v3,/planMobileOutboundAutomaticLots/);
  assert.match(v3,/snapshotVersions:snapshots/);
  assert.doesNotMatch(desktop,/setSelectedLotId|selectWarehouseFefoLot/);
  assert.doesNotMatch(mobile,/chooseLot/);
  assert.match(route,/withdrawnBy:access\.email/);
  assert.match(route,/verifyWarehouseRequest/);
});


test('GOV-SIMP: erro de saldo preserva reinicio seguro apos recarregar a pagina',()=>{
  const source=read('features/warehouse/components/warehouseWithdrawalDraft.ts');
  const code=ts.transpileModule(source,{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
  }).outputText;
  const storage=()=> {
    const memory=new Map();
    return {
      getItem:(k)=>memory.has(k)?memory.get(k):null,
      setItem:(k,v)=>memory.set(k,v),
      removeItem:(k)=>memory.delete(k),
    };
  };
  const context={exports:{},module:{exports:{}},window:{
    sessionStorage:storage(),localStorage:storage(),
  }};
  context.exports=context.module.exports;
  runInNewContext(code,context);
  const api=context.module.exports;
  const workspaceId='hgesm-aprov';
  const draft={withdrawalId:'wd_'+'1'.repeat(32),cart:[{lineId:'teste'}],
    destinationId:'dest_'+'2'.repeat(32),withdrawnBy:'QA',
    retryRequired:true,safeRestartAvailable:false};
  api.persistWarehouseWithdrawalDraft(workspaceId,draft);
  api.persistWarehouseWithdrawalRecovery(workspaceId,{
    ...draft,safeRestartAvailable:true,
  });
  assert.equal(api.readWarehouseWithdrawalDraft(workspaceId).safeRestartAvailable,true);
  assert.equal(api.readWarehouseWithdrawalDraft(workspaceId).retryRequired,true);
  assert.equal(api.readWarehouseWithdrawalDraft('outro-workspace'),null);
  // Um sinal de recuperacao de identidade antiga nao pode liberar a nova.
  api.persistWarehouseWithdrawalDraft(workspaceId,{
    ...draft,withdrawalId:'wd_'+'3'.repeat(32),
  });
  assert.equal(api.readWarehouseWithdrawalDraft(workspaceId).safeRestartAvailable,false);
  api.clearWarehouseWithdrawalDraft(workspaceId);
  assert.equal(api.readWarehouseWithdrawalDraft(workspaceId).safeRestartAvailable,true);
  api.clearWarehouseWithdrawalRecovery(workspaceId);
  assert.equal(api.readWarehouseWithdrawalDraft(workspaceId),null);
});

test('GOV-SIMP: preflight desktop redistribui validade obsoleta sem alterar saldo',()=>{
  const mat='mat_'+'a'.repeat(32);
  const position={kind:'LOCATION',depotId:'dep_'+'b'.repeat(32),
    locationId:'loc_'+'c'.repeat(32),subpositionId:null};
  const oldLine={lineId:'wline_'+'d'.repeat(32),materialId:mat,
    position,baseQuantity:3,requestedQuantity:3,lotId:null,lotCode:null,
    availableAtPosition:10,availableBalance:10};
  const validLot={id:'lot_'+'f'.repeat(32),position,
    code:'VALIDO',status:'active',expiresOn:'2027-10-31',quantity:10};
  const stock={
    [mat]:{globalQuantity:10,positions:[{position,quantity:10}],lots:[validLot]},
  };
  let sequence=0;
  const id=()=> 'wline_'+String(++sequence).padStart(32,'0');
  const recalculated=replanDesktopWithdrawalCart([oldLine],stock,id);
  assert.equal(recalculated.changed,true);
  assert.equal(recalculated.lines[0].lotId,validLot.id);
  assert.equal(recalculated.lines[0].baseQuantity,3);
  assert.equal(recalculated.lines[0].availableAtPosition,10);
  assert.equal(recalculated.lines[0].lineId!==oldLine.lineId,true);
  assert.equal(stock[mat].positions[0].quantity,10);
  assert.equal(stock[mat].lots[0].quantity,10);
  const stable=replanDesktopWithdrawalCart(recalculated.lines,stock,id);
  assert.equal(stable.changed,false);
  assert.equal(stable.lines[0].lineId,recalculated.lines[0].lineId);
});

test('GOV-SIMP: saldo zero e local sem estoque nao viram disponibilidade fantasma',()=>{
  const mat='mat_'+'a'.repeat(32);
  const position={kind:'LOCATION',depotId:'dep_'+'b'.repeat(32),
    locationId:'loc_'+'c'.repeat(32),subpositionId:null};
  const line={lineId:'wline_'+'d'.repeat(32),materialId:mat,
    position,baseQuantity:2,requestedQuantity:2,lotId:null,lotCode:null};
  const id=()=> 'wline_'+'e'.repeat(32);
  assert.throws(()=>replanDesktopWithdrawalCart([line],{
    [mat]:{globalQuantity:0,positions:[{position,quantity:0}],lots:[]},
  },id),/WAREHOUSE_OUTBOUND_LOCATION_INSUFFICIENT_STOCK/);
  assert.throws(()=>replanDesktopWithdrawalCart([line],{
    [mat]:{globalQuantity:0,positions:[{position,quantity:9}],lots:[]},
  },id),/WAREHOUSE_OUTBOUND_INSUFFICIENT_STOCK/);
});

test('GOV-SIMP: divergencia, vencimento e carrinho repetido falham sem nova baixa',()=>{
  const mat='mat_'+'a'.repeat(32);
  const position={kind:'LOCATION',depotId:'dep_'+'b'.repeat(32),
    locationId:'loc_'+'c'.repeat(32),subpositionId:null};
  const line={lineId:'wline_'+'d'.repeat(32),materialId:mat,
    position,baseQuantity:3,requestedQuantity:3,lotId:null,lotCode:null};
  const expired={id:'lot_'+'e'.repeat(32),position,code:'VENCIDO',
    status:'active',expiresOn:'2024-01-01',quantity:5};
  const id=()=> 'wline_'+'f'.repeat(32);
  assert.throws(()=>replanDesktopWithdrawalCart([line],{
    [mat]:{globalQuantity:5,positions:[{position,quantity:5}],lots:[expired]},
  },id),/WAREHOUSE_MOBILE_OUTBOUND_LOTS_NOT_ELIGIBLE/);
  assert.throws(()=>replanDesktopWithdrawalCart([line],{
    [mat]:{globalQuantity:5,positions:[{position,quantity:5}],
      lots:[{...expired,expiresOn:'2027-12-01',quantity:7}]},
  },id),/WAREHOUSE_MOBILE_OUTBOUND_LOT_OVERATTRIBUTED/);
  assert.throws(()=>replanDesktopWithdrawalCart([line,line],{
    [mat]:{globalQuantity:5,positions:[{position,quantity:5}],lots:[]},
  },id),/WAREHOUSE_OUTBOUND_INSUFFICIENT_STOCK/);
});
