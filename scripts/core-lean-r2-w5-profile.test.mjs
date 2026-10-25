import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { percentile, summary, uniqueReadPaths, planBatchGet,
  checkedLotQueryCount, describeRPCs, cpuProfile } from './core-lean-r2-w5-profile.mjs';
import { planMobileOutboundAutomaticLots } from '../lib/warehouse/mobileOutboundPlan.mjs';

test('p50/p95 are measured on sorted samples and do not mutate inputs',()=>{
  const values=[8,1,5,13,3,9,2,4,6,7,10,11,12,14,15,16,17,18,19,20];
  assert.equal(percentile(values,.5),10);
  assert.equal(percentile(values,.95),19);
  assert.equal(summary(values).count,20);
  assert.equal(values[0],8);
  assert.throws(()=>percentile([], .5),/W5_INVALID_SAMPLES/);
});
test('read-set optimization deduplicates without changing first-seen order',()=>{
  const paths=['w/a','w/b','w/a','w/c','w/b'];
  assert.deepEqual(uniqueReadPaths(paths),['w/a','w/b','w/c']);
  assert.deepEqual(planBatchGet(paths,2),[['w/a','w/b'],['w/c']]);
  assert.deepEqual(paths,['w/a','w/b','w/a','w/c','w/b']);
  assert.throws(()=>planBatchGet(paths,31),/W5_INVALID_READ_CHUNK/);
});
test('observability counts are NOT billing units',()=>{
  const counts=describeRPCs([
    {operation:'batchGet',requested:3,returned:2},
    {operation:'runQuery',requested:0,returned:6},
  ]);
  assert.deepEqual(counts,{calls:2,requestedDocuments:3,returnedDocuments:8,
    byOperation:{batchGet:1,runQuery:1}});
});
test('saturated validity candidate query must fail closed, never silently trim',()=>{
  assert.equal(checkedLotQueryCount(120),120);
  assert.throws(()=>checkedLotQueryCount(121),/WAREHOUSE_SERVER_QUERY_SATURATED/);
});
test('physical stock free of validity attribution remains eligible, not FEFO',()=>{
  const result=planMobileOutboundAutomaticLots({
    quantity:3,physicalQuantity:6,today:new Date('2026-10-25T00:00:00Z'),
    lots:[{id:'lot_b',code:'B',quantity:2,status:'active',expiresOn:'2099-01-01'},
      {id:'lot_a',code:'A',quantity:1,status:'active',expiresOn:'2020-01-01'}],
  });
  assert.deepEqual(result,[{lotId:'lot_b',quantity:2},{lotId:null,quantity:1}]);
});
test('invalid stock assignments or excess lines fail safely',()=>{
  const lot=(i)=>({id:'lot_'+i,code:'C'+i,quantity:1,status:'active',expiresOn:null});
  assert.throws(()=>planMobileOutboundAutomaticLots({quantity:2,physicalQuantity:1,
    lots:[lot(1)]}),/INVALID_QUANTITY/);
  assert.throws(()=>planMobileOutboundAutomaticLots({quantity:1,physicalQuantity:1,
    lots:[lot(1),lot(2)]}),/OVERATTRIBUTED/);
  assert.throws(()=>planMobileOutboundAutomaticLots({quantity:1,physicalQuantity:121,
    lots:Array.from({length:121},(_,i)=>lot(i))}),/INVALID_QUANTITY/);
});
test('CPU fixture repetitions measure the actual planner without mocks',async()=>{
  const result=await cpuProfile(5);
  for(const scenario of ['small','medium','large']){
    const m=result.measurements[scenario];
    assert.equal(m.warm.count,5);
    assert.ok(m.resultLines>0);
    assert.ok(m.warm.medianMs>=0);
    assert.ok(m.warm.p95Ms>=m.warm.medianMs);
  }
});
const v3File=fileURLToPath(new URL('../lib/server/warehouseWithdrawalV3Identity.mjs',import.meta.url));
test('v3 hash and derived identities are versioned and stable when W1 is composed',
  {skip:!existsSync(v3File)&&'Awaiting merge/composition of W1 SHA'}, async()=>{
    const {warehouseWithdrawalV3IntentHash:hash,
      warehouseWithdrawalV3DerivedLineId:lineId} = await import('../lib/server/warehouseWithdrawalV3Identity.mjs');
    const pos={kind:'LOCATION',depotId:'dep_'+'a'.repeat(32),
      locationId:'loc_'+'b'.repeat(32),subpositionId:null};
    const command={destinationId:'dest_'+'c'.repeat(32),
      lines:[{materialId:'mat_'+'d'.repeat(32),position:pos,requestedQuantity:1}]};
    const old=hash(command);
    assert.equal(hash({...command,lines:command.lines.map(line=>({...line}))}),old);
    assert.notEqual(hash({...command,destinationId:'dest_'+'e'.repeat(32)}),old);
    assert.notEqual(lineId('wd_'+'f'.repeat(32),0,0),
      lineId('wd_'+'f'.repeat(32),0,1));
  });
