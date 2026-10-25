#!/usr/bin/env node
/**
 * CORE LEAN R2 / W5. Isolated observations, never production operations.
 * --cpu: pure planner benchmarks; --emulator: real Firestore REST read probes.
 * Probe timings MUST NOT be presented as end-to-end withdrawal v2/v3 timings.
 */
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { planMobileOutboundAutomaticLots } from '../lib/warehouse/mobileOutboundPlan.mjs';

export const FIXTURES = Object.freeze([
  { name: 'small', lotCount: 1, positions: 1, quantity: 1 },
  { name: 'medium', lotCount: 12, positions: 3, quantity: 4 },
  { name: 'large', lotCount: 60, positions: 5, quantity: 8 },
]);
const PROJECT = 'demo-emprovex-security';
const DATABASE = 'emprovex-warehouse';
const WS = 'w5-benchmark';
const UG = '160416';
const hex = n => String(n).padStart(32, '0');
const materialId = i => 'mat_' + hex(i + 1);
const lotId = (i, j) => 'lot_' + hex(i * 1000 + j + 1);
const docPath = (domain, id) => 'warehouse/' + WS + '/' + domain + '/' + id;
const hash = x => createHash('sha256').update(x).digest('hex');

export function percentile(samples, quantile) {
  if (!samples.length || samples.some(x => !Number.isFinite(x) || x < 0)) {
    throw new Error('W5_INVALID_SAMPLES');
  }
  const sorted = [...samples].sort((a,b) => a - b);
  return sorted[Math.ceil(quantile * sorted.length) - 1] ?? sorted[0];
}
export function summary(samples) {
  return {
    count: samples.length,
    medianMs: Number(percentile(samples, .5).toFixed(3)),
    p95Ms: Number(percentile(samples, .95).toFixed(3)),
    minMs: Number(Math.min(...samples).toFixed(3)),
    maxMs: Number(Math.max(...samples).toFixed(3)),
  };
}
/** Deduplicate per request; never cache across users, UGs or operations. */
export function uniqueReadPaths(paths) {
  if (!Array.isArray(paths) || paths.some(p => typeof p !== 'string' || !p)) {
    throw new Error('W5_INVALID_READ_PATHS');
  }
  return [...new Set(paths)];
}
export function planBatchGet(paths, chunkSize = 30) {
  if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > 30) {
    throw new Error('W5_INVALID_READ_CHUNK');
  }
  const unique = uniqueReadPaths(paths), groups = [];
  for (let i = 0; i < unique.length; i += chunkSize) {
    groups.push(unique.slice(i, i + chunkSize));
  }
  return groups;
}
export function checkedLotQueryCount(count, limit = 120) {
  if (!Number.isSafeInteger(count) || count < 0 || !Number.isInteger(limit) || limit < 1) {
    throw new Error('W5_INVALID_LOT_COUNT');
  }
  if (count > limit) throw new Error('WAREHOUSE_SERVER_QUERY_SATURATED');
  return count;
}
function lotsFor(fixture) {
  return Array.from({length:fixture.lotCount}, (_,j) => ({
    id: lotId(FIXTURES.indexOf(fixture), j), code: 'VALID-' + j,
    quantity: 1, status: 'active', expiresOn: '2099-12-31',
  }));
}
export async function timed(fn, repetitions = 25) {
  if (!Number.isInteger(repetitions) || repetitions < 3 || repetitions > 1000) {
    throw new Error('W5_INVALID_REPETITIONS');
  }
  const run = async () => {
    const t0 = performance.now();
    const result = await fn();
    return { elapsed: performance.now() - t0, result };
  };
  const cold = await run();
  const values = [];
  for (let i = 0; i < repetitions; i++) values.push((await run()).elapsed);
  return { coldMs: Number(cold.elapsed.toFixed(3)), warm: summary(values) };
}
export async function cpuProfile(repetitions = 150) {
  const result = {};
  for (const fixture of FIXTURES) {
    const lots = lotsFor(fixture);
    const input = { quantity:fixture.quantity, physicalQuantity: fixture.lotCount, lots,
      today: new Date('2026-10-25T00:00:00Z') };
    const before = planMobileOutboundAutomaticLots(input);
    const check = before.reduce((sum, part) => sum + part.quantity, 0);
    if (Math.abs(check - fixture.quantity) > 1e-6) throw new Error('W5_PLANNER_LOST_STOCK');
    const measurement = await timed(() => {
      const plan = planMobileOutboundAutomaticLots(input);
      if (JSON.stringify(plan) !== JSON.stringify(before)) throw new Error('W5_NONDETERMINISTIC');
      return plan;
    }, repetitions);
    result[fixture.name] = {
      ...measurement, fixture:{ lots:fixture.lotCount, positions:fixture.positions,
        withdrawalLines:fixture.quantity }, resultLines:before.length,
    };
  }
  return { kind:'cpu_planner_microbenchmark', samples:repetitions,
    warning:'CPU microbenchmark, NOT end-to-end Warehouse latency or Firestore billing',
    measurements:result };
}
function emulatorBase() {
  if (process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR !== '1'
    || process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID !== PROJECT) {
    throw new Error('W5_EMULATOR_ONLY');
  }
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!host || !/^(127\.0\.0\.1|localhost):[0-9]{2,5}$/.test(host)) {
    throw new Error('W5_EMULATOR_LOCALHOST_REQUIRED');
  }
  return 'http://' + host + '/v1/projects/' + PROJECT + '/databases/' + DATABASE + '/documents';
}
function encode(value) {
  if (value === null) return {nullValue:'NULL_VALUE'};
  if (typeof value === 'string') return {stringValue:value};
  if (typeof value === 'number') return {integerValue:String(value)};
  if (typeof value === 'boolean') return {booleanValue:value};
  if (Array.isArray(value)) return {arrayValue:{values:value.map(encode)}};
  return {mapValue:{fields:Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encode(v)]))}};
}
const fields = record => Object.fromEntries(Object.entries(record).map(([k,v])=>[k,encode(v)]));
function parseStream(value) {
  const s = value.trim();
  return s ? (s.startsWith('[') ? JSON.parse(s) : s.split(/\r?\n/).map(JSON.parse)) : [];
}
export function describeRPCs(events) {
  return events.reduce((r,e) => {
    r.calls++;
    r.requestedDocuments += e.requested;
    r.returnedDocuments += e.returned;
    r.byOperation[e.operation] = (r.byOperation[e.operation] || 0) + 1;
    return r;
  },{calls:0,requestedDocuments:0,returnedDocuments:0,byOperation:{}});
}
async function emulatorProfile(repetitions = 15) {
  const base = emulatorBase();
  const full = p => base + '/' + p;
  const events = [];
  const post = async (operation, payload, observed = true) => {
    const res = await fetch(base + operation, {
      method:'POST', headers:{authorization:'Bearer owner','content-type':'application/json'},
      body:JSON.stringify(payload), cache:'no-store',
    });
    if (!res.ok) { const diagnostic = (await res.text()).slice(0,450).replace(/[\r\n]+/g,' '); throw new Error('W5_FIRESTORE_EMULATOR_RPC_FAILED_' + operation.replace(/[^A-Za-z0-9_:/-]/g,'') + '_' + res.status + '_' + diagnostic); }
    const data = parseStream(await res.text());
    if (observed) events.push({operation:operation.split(':').at(-1),
      requested:payload.documents?.length || 0,
      returned:data.filter(x=>x.found || x.document).length});
    return data;
  };
  // Shared fictitious collection and equal seed for every probe. Setup is EXCLUDED.
  const writes = [];
  for (let i = 0; i < FIXTURES.length; i++) {
    const f = FIXTURES[i], id = materialId(i);
    const seed = (domain, key, value) => writes.push({update:{
      name:full(docPath(domain,key)),fields:fields(value),
    }});
    seed('materials',id,{id,workspaceId:WS,ug:UG,status:'active'});
    seed('balances',id,{materialId:id,workspaceId:WS,ug:UG,quantity:f.lotCount});
    seed('lotAttributionLocks',id,{materialId:id,revision:1});
    seed('barcodes','bar_'+hash(id),{materialId:id,barcode:'9810000000000'});
    for (let p = 0; p < f.positions; p++) {
      seed('locationBalances','locbal_'+hash(id+':'+p),{
        materialId:id,workspaceId:WS,ug:UG,quantity:f.lotCount,
        position:{kind:'LOCATION',depotId:'dep_'+hex(i+1),locationId:'loc_'+hex(p+1)},
      });
    }
    for (let j = 0; j < f.lotCount; j++) {
      seed('lots',lotId(i,j),{id:lotId(i,j),materialId:id,workspaceId:WS,ug:UG,
        quantity:1,status:'active',expiresOn:'2099-12-31'});
    }
  }
  await post(':commit',{writes},false);
  const batch = async paths => {
    const groups = planBatchGet(paths);
    let found = 0;
    for (const group of groups) {
      const rows = await post(':batchGet',{documents:group.map(full)});
      if (rows.length !== group.length) throw new Error('W5_INCOMPLETE_BATCH_READ');
      found += rows.filter(x=>x.found).length;
    }
    return found;
  };
  const lots = async (id, expected) => {
    const rows = await post('/warehouse/' + WS + ':runQuery',{
      structuredQuery:{from:[{collectionId:'lots'}],where:{fieldFilter:{
        field:{fieldPath:'materialId'},op:'EQUAL',value:{stringValue:id},
      }},limit:121},
    });
    const count = rows.filter(x=>x.document).length;
    checkedLotQueryCount(count,120);
    if (count !== expected) throw new Error('W5_LOT_FIXTURE_MISMATCH');
    return count;
  };
  const probes = {};
  for(let i=0;i<FIXTURES.length;i++){
    const fixture=FIXTURES[i], id=materialId(i);
    const sample = async (label,fn) => {
      events.length=0;
      const cold=await timed(fn,repetitions);
      const counts=describeRPCs(events);
      const perInvocation = repetitions+1;
      if (counts.calls % perInvocation !== 0
        || counts.requestedDocuments % perInvocation !== 0
        || counts.returnedDocuments % perInvocation !== 0) {
        throw new Error('W5_UNSTABLE_RPC_PROFILE');
      }
      return [label,{...cold,rpcCallsPerInvocation:counts.calls/perInvocation,
        requestedDocumentsPerInvocation:counts.requestedDocuments/perInvocation,
        returnedDocumentsPerInvocation:counts.returnedDocuments/perInvocation,
        note:'Observable REST calls and returned docs; NOT billed reads'}];
    };
    const [barcode,position,planning,replay]=await (async () => [
      await sample('barcode',()=>batch([docPath('barcodes','bar_'+hash(id))])),
      await sample('position',()=>batch([docPath('materials',id),docPath('balances',id),
        docPath('locationBalances','locbal_'+hash(id+':0'))])),
      await sample('v3_preplan_read_probe',async()=>{
        await batch([docPath('withdrawals','wd_'+hex(i+1))]);
        await batch([docPath('lotAttributionLocks',id)]);
        await lots(id,fixture.lotCount);
        await batch([docPath('lotAttributionLocks',id)]);
        return batch([docPath('materials',id),docPath('balances',id),
          docPath('locationBalances','locbal_'+hash(id+':0'))]);
      }),
      await sample('replay_header_read_probe',()=>batch([docPath('withdrawals','wd_'+hex(i+1))])),
    ])();
    probes[fixture.name] = Object.fromEntries([barcode,position,planning,replay]);
  }
  return {kind:'firebase_emulator_read_probes', project:PROJECT,database:DATABASE,
    seedDocuments:writes.length, samples:repetitions,
    warning:'Read-only probes after isolated seed. NOT v2/v3 transaction timing, NOT billed Firestore reads, NOT actual mobile E2E',
    measurements:probes};
}
export async function main(argv = process.argv.slice(2)) {
  const mode = argv.includes('--emulator') ? 'emulator' : 'cpu';
  const outAt = argv.indexOf('--out');
  const out = outAt < 0 ? null : argv[outAt+1];
  if (outAt >= 0 && (!out || out.startsWith('--'))) throw Error('W5_OUT_REQUIRED');
  const repetitions = mode==='cpu' ? 150 : 15;
  const output = {
    schema:'emprovex_core_lean_r2_w5_v1',date:new Date().toISOString(),
    node:process.version,mode,
    data:mode==='cpu'?await cpuProfile(repetitions):await emulatorProfile(repetitions),
  };
  if (out) writeFileSync(out,JSON.stringify(output,null,2)+'\n',{flag:'w'});
  process.stdout.write(JSON.stringify(output,null,2)+'\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(e=>{ console.error('W5_BENCHMARK_FAILED',e.message);process.exitCode=1; });
}
