#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { planMobileOutboundAutomaticLots as plan } from '../lib/warehouse/mobileOutboundPlan.mjs';

const text=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const lot=(id,quantity,expiresOn='2027-02-01',status='active')=>({
  id:'lot_'+id.repeat(32),code:'L-'+id,quantity,expiresOn,status,
});

test('baixa tecnica escolhe referencia estavel, sem prioridade de validade',()=>{
  assert.deepEqual(plan({quantity:4,physicalQuantity:20,today:new Date('2026-10-24'),
    lots:[lot('a',10,'2027-04-01'),lot('b',5,'2026-11-01')]}),
    [{lotId:'lot_'+'a'.repeat(32),quantity:4}]);
});
test('baixa sem FEFO divide a quantidade e preserva a soma',()=>{
  assert.deepEqual(plan({quantity:12,physicalQuantity:20,today:new Date('2026-10-24'),
    lots:[lot('a',8,'2027-04-01'),lot('b',5,'2026-11-01')]}),
    [{lotId:'lot_'+'a'.repeat(32),quantity:8},
     {lotId:'lot_'+'b'.repeat(32),quantity:4}]);
});
test('Sem lotes permite a baixa de estoque livre; mistura lote e livre corretamente',()=>{
  assert.deepEqual(plan({quantity:6,physicalQuantity:6,lots:[]}),
    [{lotId:null,quantity:6}]);
  assert.deepEqual(plan({quantity:6,physicalQuantity:10,
    lots:[lot('a',4)]}),
    [{lotId:'lot_'+'a'.repeat(32),quantity:4},{lotId:null,quantity:2}]);
});
test('Lotes vencidos, inativos ou atribuidos em excesso nao sao baixados implicitamente',()=>{
  assert.throws(()=>plan({quantity:4,physicalQuantity:10,today:new Date('2026-10-24'),
    lots:[lot('a',9,'2026-01-01')]}),/LOTS_NOT_ELIGIBLE/);
  assert.throws(()=>plan({quantity:3,physicalQuantity:10,
    lots:[lot('a',11)]}),/LOT_OVERATTRIBUTED/);
  assert.throws(()=>plan({quantity:0,physicalQuantity:10,lots:[]}),/INVALID_QUANTITY/);
  assert.throws(()=>plan({quantity:11,physicalQuantity:10,lots:[]}),/INVALID_QUANTITY/);
});
test('Scanner aceita item e local apenas no modo de saida, sem relaxar outras telas',()=>{
  const src=text('lib/warehouse/mobileScanner.ts');
  assert.match(src,/'EXPECT_PRODUCT_OR_LOCATION'/);
  assert.match(src,/kind === 'PRODUCT' \|\| kind === 'LOCATION'/);
  assert.match(src,/kind === expectedWarehouseMobileScanKind\(expectation\)/);
});
test('UI: primeira leitura resolve ambos, destino sem responsavel ou lote manual',()=>{
  const ui=text('features/warehouse/mobile/WarehouseMobileOutbound.tsx');
  assert.match(ui,/EXPECT_PRODUCT_OR_LOCATION/);
  assert.match(ui,/loadWarehouseMobilePhysicalPositionContents/);
  assert.match(ui,/getWarehouseMobileBarcodeByCode/);
  assert.match(ui,/available\.length===1\?available\[0\]:null/);
  assert.match(ui,/warehouseStockPositionsEqual\(o\.position,location\.resolved\.position\)/);
  assert.match(ui,/planMobileOutboundAutomaticLots/);
  assert.match(ui,/WITHDRAWAL_FINALIZE_MOBILE/);
  assert.doesNotMatch(ui,/chooseLot|setLotId|selectedLot|pickedBy|setPickedBy|onClick.*lot/);
  assert.match(ui,/1 · LER CÓDIGO DE BARRAS/);
  assert.match(ui,/2 · INDICAR QUANTIDADE/);
  assert.match(ui,/3 · DESTINO/);
  assert.match(ui,/4 · REVISAR E CONFIRMAR/);
});
test('Servidor define retirado por usando exclusivamente identidade autenticada',()=>{
  const route=text('app/api/central-depositos/operations/route.ts');
  const engine=text('lib/server/warehouseMobileTrust.mjs');
  assert.match(route,/case 'WITHDRAWAL_FINALIZE_MOBILE'/);
  assert.match(route,/withdrawnBy:access\.email/);
  assert.match(engine,/'WITHDRAWAL_FINALIZE_MOBILE'/);
  assert.match(route,/verifyWarehouseRequest/);
  assert.match(route,/finalizeWarehouseWithdrawalServer/);
});
test('motor canonico rejeita referencia vencida diretamente no servidor',()=>{
  const code=text('lib/server/warehouseOutboundWrite.ts');
  assert.match(code,/warehouseLotExpiryState\(lot\)==='EXPIRED'/);
  assert.match(code,/WAREHOUSE_OUTBOUND_LOT_EXPIRED/);
});

test('Alocacao nao exige codigo manual de lote; validade e rastreio continuam',()=>{
  const alloc=text('features/warehouse/mobile/WarehouseMobileIntakeAllocation.tsx');
  assert.doesNotMatch(alloc,/setLotCode|Lote · opcional/);
  assert.match(alloc,/lotCode: ''/);
  assert.match(alloc,/setExpiresOn/);
  assert.match(text('lib/server/warehouseOutboundWrite.ts'),/warehouseAdminTransaction/);
  assert.match(text('lib/server/warehouseWithdrawalWrite.ts'),/WAREHOUSE_CONSUMPTION_IDEMPOTENCY_CONFLICT/);
});
