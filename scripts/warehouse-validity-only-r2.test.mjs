#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { planMobileOutboundAutomaticLots } from '../lib/warehouse/mobileOutboundPlan.mjs';
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
