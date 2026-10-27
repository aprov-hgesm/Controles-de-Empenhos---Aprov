import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Execute the actual TS server engine with a deterministic in-memory Firestore
// REST transport: no Firebase credentials, no network and no production writes.
const read = p => fs.readFileSync(p, 'utf8');
function loadTs(path, dependencies = {}) {
  const js = ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    reportDiagnostics: true,
  });
  assert.deepEqual(js.diagnostics ?? [], [], 'TS transpilation: ' + path);
  const module = { exports: {} };
  const resolve = id => {
    if (id === 'node:crypto') return requireCrypto;
    if (id in dependencies) return dependencies[id];
    throw new Error('Undeclared dependency ' + id);
  };
  new Function('module', 'exports', 'require', js.outputText)(module, module.exports, resolve);
  return module.exports;
}
const requireCrypto = await import('node:crypto');
const domain = loadTs('lib/billing.ts');
const billingAccess = loadTs('lib/billingAccess.ts', { './billing': domain });
const rampPricing = await import('../lib/server/payments/emprovexRampPricing.mjs');
const infiniteCheckout = await import('../lib/server/payments/infinitepayCheckout.mjs');
const smokeHarness = await import('../lib/server/payments/infinitepaySmokeHarness.mjs');
const billingQaPilot = await import('../lib/server/payments/billingAccessQaPilot.mjs');
const projectId = 'demo-billing-server-regression';
const database = '(default)';
const prefix = 'projects/' + projectId + '/databases/' + database + '/documents/';
const firestoreBase = 'https://firestore.googleapis.com/v1/' + prefix.slice(0, -1);
const founder = { uid: 'founder-uid', email: 'aprov1hgesm@gmail.com' };
const docs = new Map();
let readCount = 0;
let writeCount = 0;
let failCommit = false;
let version = 1;
const document = (p, data) => ({ value: structuredClone(data), updateTime: '2026-10-26T01:00:' + String(version++).padStart(2, '0') + 'Z' });
const store = (p, data) => docs.set(p, document(p, data));
const get = p => structuredClone(docs.get(p)?.value);
const fields = obj => Object.fromEntries(Object.entries(obj).filter(([,v])=>v!==undefined).map(([k,v])=>[k,encode(v)]));
function encode(v) {
  if (v===null) return { nullValue: 'NULL_VALUE' };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v==='string') return { stringValue:v };
  if (typeof v==='number') return { integerValue:String(v) };
  if (typeof v==='boolean') return { booleanValue:v };
  if (Array.isArray(v)) return { arrayValue:{values:v.map(encode)} };
  return { mapValue:{fields:fields(v)} };
}
function decode(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values??[]).map(decode);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields).map(([k,x])=>[k,decode(x)]));
  throw Error('unrecognized value');
}
const json = (o, status=200) => new Response(JSON.stringify(o), {status, headers:{'content-type':'application/json'}});
function fixture() {
  docs.clear(); readCount=0; writeCount=0; failCommit=false; version=1;
  store('platformBillingConfig/main', { ...domain.buildPlatformBillingConfig(founder.email), monthlyPriceCents:5000 });
  for(const [i, id] of ['hgesm-aprov','vip-legacy-a','vip-legacy-b'].entries()) {
    const ws = { id, ug: String(160416+i), status:'active', authorizedEmail: i===0?founder.email:'vip'+i+'@example.com' };
    store('workspaces/'+id, ws);
    store('billingAccounts/'+id, {...domain.buildInitialBillingAccount(ws,founder.email,false), status:'exempt',
      monthlyPriceCents:0, exemptionSource:i===0?'founder':'legacy_vip'});
  }
}
function firestoreFetch(url, init={}) {
  assert.equal(init.headers?.authorization, 'Bearer server-test-token', 'server IAM required');
  const path = String(url).replace(firestoreBase,'');
  if (init.method === 'POST') {
    const body = JSON.parse(init.body);
    if(path === ':beginTransaction') return Promise.resolve(json({transaction:'tx-1'}));
    if(path === ':rollback') return Promise.resolve(json({}));
    if(path === ':batchGet') {
      readCount+=body.documents.length;
      return Promise.resolve(json(body.documents.map(name => {
        const local = name.slice(prefix.length);
        const d = docs.get(local);
        return d ? { found:{name,fields:fields(d.value),updateTime:d.updateTime} } : {missing:name};
      })));
    }
    if(path === ':commit') {
      if(failCommit) return Promise.resolve(json({error:{status:'ABORTED'}},409));
      for(const w of body.writes){
        const p = w.update.name.slice(prefix.length), current=docs.get(p);
        if (current && w.currentDocument.updateTime !== current.updateTime)
          return Promise.resolve(json({error:'concurrent modification'},409));
        if (!current && w.currentDocument.exists !== false)
          return Promise.resolve(json({error:'missing precondition'},409));
      }
      for(const w of body.writes) {
        if (w.update.name.includes('/platformAuditEvents/')) {
          assert.equal(typeof w.update.fields.createdAt.timestampValue, 'string', 'audit timestamp must be native Firestore timestamp');
        }
        store(w.update.name.slice(prefix.length),Object.fromEntries(Object.entries(w.update.fields).map(([k,v])=>[k,decode(v)])));
        writeCount++;
      }
      return Promise.resolve(json({commitTime:'2026-10-26T01:00:00Z'}));
    }
  }
  if (init.method === 'GET' || !init.method) {
    if (path.startsWith('/billingAccounts?') || path.startsWith('/billingCycles?')) {
      readCount++;
      const collection = path.split('?')[0].slice(1);
      return Promise.resolve(json({documents:[...docs.entries()].filter(([p])=>p.startsWith(collection+'/')).map(([p,d])=>({
        name: prefix+p,fields:fields(d.value),updateTime:d.updateTime,
      }))}));
    }
    const local=path.slice(1), doc=docs.get(local);
    readCount++;
    return Promise.resolve(doc?json({name:prefix+local,fields:fields(doc.value),updateTime:doc.updateTime}):json({error:'not found'},404));
  }
  throw Error('unexpected request '+path);
}
fixture();
globalThis.fetch = firestoreFetch;
const engine = loadTs('lib/server/platformBillingAdminStore.ts', {
  '../../firebase-applet-config.json':{projectId,firestoreDatabaseId:database},
  '../billing':domain,
  '../hgesmWorkspace':{HGESM_UG:'160416',HGESM_WORKSPACE_ID:'hgesm-aprov'},
  './sectorProvisioningAdmin':{getGoogleAccessToken: async()=> 'server-test-token'},
  './payments/emprovexRampPricing.mjs': rampPricing,
  './payments/infinitepayCheckout.mjs': infiniteCheckout,
  './payments/infinitepaySmokeHarness.mjs': smokeHarness,
  './payments/billingAccessQaPilot.mjs': billingQaPilot,
  './warehouseBillingMirror': { syncWarehouseBillingMirror: async () => undefined },
  '../billingAccess': billingAccess,
});
test('pilot-only server access: unpaid deny, paid allow, other sectors/VIPs unaffected', async () => {
  fixture();
  const ws = { id:'aprovisionamento-teste-3', ug:'160777', status:'active',
    authorizedEmail:'test3@example.com', billingPolicyId:'emprovex_individual_ramp_v1',
    billingEntitlementUntil:new Date().toISOString() };
  const account = domain.buildInitialBillingAccount(ws, founder.email, false, undefined, undefined, true);
  store('workspaces/'+ws.id, ws);
  store('billingAccounts/'+ws.id, account);
  const vars = ['EMPROVEX_BILLING_QA_WORKSPACE_ID','INFINITEPAY_BILLING_ENABLED',
    'INFINITEPAY_BILLING_SCOPE','INFINITEPAY_BILLING_PILOT_WORKSPACE_ID'];
  const previous = Object.fromEntries(vars.map(k => [k, process.env[k]]));
  try {
    Object.assign(process.env, {
      EMPROVEX_BILLING_QA_WORKSPACE_ID:ws.id,
      INFINITEPAY_BILLING_ENABLED:'1', INFINITEPAY_BILLING_SCOPE:'pilot',
      INFINITEPAY_BILLING_PILOT_WORKSPACE_ID:ws.id,
    });
    const unpaid = await engine.readSectorBillingAccess(ws.id, ws.authorizedEmail);
    assert.equal(unpaid.enforcementEnabled, true);
    assert.equal(unpaid.allowed, false);
    assert.equal(unpaid.reason, 'payment_required');
    assert.equal(unpaid.requiresPayment, true);

    const vip = await engine.readSectorBillingAccess('vip-legacy-a','vip1@example.com');
    assert.equal(vip.allowed, true);
    assert.equal(vip.enforcementEnabled, false);
    assert.equal(vip.reason, 'observe');

    const referenceMonth = domain.paidServicePeriod(account).referenceMonth;
    store('billingCycles/'+ws.id+'__'+referenceMonth,
      {workspaceId:ws.id,referenceMonth,status:'paid'});
    const paid = await engine.readSectorBillingAccess(ws.id, ws.authorizedEmail);
    assert.equal(paid.allowed, true);
    assert.equal(paid.reason, 'paid');
    assert.equal(writeCount, 0, 'read-only QA does not mutate Firestore');
  } finally {
    for (const k of vars) {
      if (previous[k] === undefined) delete process.env[k];
      else process.env[k] = previous[k];
    }
  }
});

test('read-only dashboard: R$50 config and three VIPs retained, no writes',async()=>{
  fixture();
  const data=await engine.readBillingAdminDirectory();
  assert.equal(data.config.monthlyPriceCents,5000);
  assert.equal(data.accounts.length,3);
  assert.equal(data.cycles.length,0);
  assert.ok(data.accounts.every(a=>a.status==='exempt' && a.monthlyPriceCents===0));
  assert.equal(writeCount,0);
});
test('explicit config save preserves historical price and atomically audits',async()=>{
  fixture();
  const next=await engine.mutateBillingAdmin(founder,{action:'config',input:{supportContact:'contato@emprovex.com.br'}});
  assert.equal(next.monthlyPriceCents,5000);
  assert.equal(get('platformBillingConfig/main').monthlyPriceCents,5000);
  assert.equal(writeCount,2);
  const audit=[...docs].filter(([k])=>k.startsWith('platformAuditEvents/'));
  assert.equal(audit.length,1);
  assert.equal(audit[0][1].value.actorUid,founder.uid);
  assert.equal(audit[0][1].value.operation,'billing.config_update');
});
test('forbid automatic migration even when UI requests R$70',async()=>{
  fixture();
  await assert.rejects(engine.mutateBillingAdmin(founder,{action:'config',input:{monthlyPriceCents:7000}}),/BILLING_PRICE_CHANGE_REQUIRES_CONTRACT_FLOW/);
  assert.equal(writeCount,0);
  assert.equal(get('platformBillingConfig/main').monthlyPriceCents,5000);
});
test('founder and legacy VIP permanent protection: no nonconsensual exemption removal',async()=>{
  fixture();
  for(const id of ['hgesm-aprov','vip-legacy-a','vip-legacy-b']){
    await assert.rejects(engine.mutateBillingAdmin(founder,{action:'exemption',workspaceId:id,exempt:false}),/BILLING_(FOUNDER_PERMANENTLY_EXEMPT|EXEMPTION_REMOVAL_REQUIRES_CONTRACT)/);
    assert.equal(get('billingAccounts/'+id).monthlyPriceCents,0);
  }
  assert.equal(writeCount,0);
});
test('no unauthorized provisioning from billing mutations',async()=>{
  fixture();
  store('workspaces/new-client',{id:'new-client',ug:'160777',status:'active',authorizedEmail:'new@example.com'});
  await assert.rejects(engine.mutateBillingAdmin(founder,{action:'trial',workspaceId:'new-client',days:30}),/BILLING_ACCOUNT_NOT_PROVISIONED/);
  assert.equal(writeCount,0);
});
test('server refuses transaction on Firestore commit conflict without partial data',async()=>{
  fixture();failCommit=true;
  await assert.rejects(engine.mutateBillingAdmin(founder,{action:'config',input:{supportContact:'updated'}}),/BILLING_CONFLICT_RETRY/);
  assert.equal(get('platformBillingConfig/main').supportContact,'');
  assert.equal([...docs.keys()].filter(k=>k.startsWith('platformAuditEvents/')).length,0);
  assert.equal(writeCount,0);
});
test('non-exempt historical prices remain unchanged across status and cycle transitions',async()=>{
  fixture();
  const p='billingAccounts/billing-client';
  const ws={id:'billing-client',ug:'161555',status:'active',authorizedEmail:'billing@example.com'};
  store('workspaces/billing-client',ws);
  store(p,{...domain.buildInitialBillingAccount(ws,founder.email,false),monthlyPriceCents:3990,status:'active'});
  await engine.mutateBillingAdmin(founder,{action:'status',workspaceId:'billing-client',status:'pending'});
  assert.equal(get(p).monthlyPriceCents,3990);
  const cycle=await engine.mutateBillingAdmin(founder,{action:'cycle',workspaceId:'billing-client',month:'2026-10',status:'paid',note:'Transferência verificada: COMPROVANTE-TESTE-2026-10'});
  assert.equal(cycle.amountCents,3990);
  assert.equal(get(p).monthlyPriceCents,3990);
  await engine.mutateBillingAdmin(founder,{action:'cycle',workspaceId:'billing-client',month:'2026-10',status:'waived'});
  assert.equal(get('billingCycles/billing-client__2026-10').amountCents,3990);
  assert.equal(get(p).status,'active');
});
test('workspace/account mismatch denies money movement before any write',async()=>{
  fixture();
  const p='billingAccounts/vip-legacy-a';
  const wrong=get(p);wrong.ug='999999';store(p,wrong);
  await assert.rejects(engine.mutateBillingAdmin(founder,{action:'exemption',workspaceId:'vip-legacy-a',exempt:true}),/BILLING_WORKSPACE_MISMATCH/);
  assert.equal(writeCount,0);
});
test('no implicit client Firestore traffic or auto migration code',()=>{
  const hook=read('hooks/usePlatformAdminBilling.ts'),bridge=read('lib/platformBillingStore.ts');
  assert.doesNotMatch(bridge,/from ['"]firebase\/firestore['"]/);
  assert.doesNotMatch(bridge,/\bonSnapshot\(|\brunTransaction\(/);
  assert.doesNotMatch(hook,/ensurePlatformBillingFoundation|subscribePlatformBilling/);
  assert.match(bridge,/\/api\/admin\/billing/);
});

const mockFounderError = class FounderAuthError extends Error {
  constructor(status) { super('mocked founder auth rejected'); this.status=status; }
};
const route = loadTs('app/api/admin/billing/route.ts', {
  'next/server': { NextResponse: { json: (data, opts={}) => Response.json(data,opts) } },
  '../../../../lib/server/firebaseFounderAuth': {
    FounderAuthError: mockFounderError,
    verifyFounderFirebaseRequest: async authorization => {
      if (authorization !== 'Bearer founder-token') throw new mockFounderError(403);
      return founder;
    },
  },
  '../../../../lib/server/platformBillingAdminStore': engine,
});
test('unauthenticated and outsider API requests never touch billing IAM or write',async()=>{
  fixture();
  for(const token of ['Bearer outsider','Bearer password-founder','Bearer ']){
    const request=new Request('https://emprovex.com.br/api/admin/billing', {
      method:'POST',headers:{authorization:token,'content-type':'application/json'},
      body:JSON.stringify({action:'config',input:{supportContact:'hacked'}}),
    });
    const answer=await route.POST(request);
    assert.equal(answer.status,403);
  }
  assert.equal(readCount,0);assert.equal(writeCount,0);
});
test('founder API authorizes read and explicit save only',async()=>{
  fixture();
  const readReq=new Request('https://emprovex.com.br/api/admin/billing',{headers:{authorization:'Bearer founder-token'}});
  const rd=await route.GET(readReq);
  assert.equal(rd.status,200);
  assert.equal((await rd.json()).accounts.length,3);
  assert.equal(writeCount,0);
  const writeReq=new Request('https://emprovex.com.br/api/admin/billing',{
    method:'POST',headers:{authorization:'Bearer founder-token','content-type':'application/json'},
    body:JSON.stringify({action:'config',input:{supportContact:'https://emprovex.com.br/ajuda'}}),
  });
  const wr=await route.POST(writeReq);
  assert.equal(wr.status,200);
  assert.equal(writeCount,2);
  assert.equal(get('platformBillingConfig/main').monthlyPriceCents,5000);
});
test('oversized POST fails before calling server IAM',async()=>{
  fixture();
  const raw=JSON.stringify({action:'config',input:{supportContact:'X'.repeat(9000)}});
  const resp=await route.POST(new Request('https://emprovex.com.br/api/admin/billing',{
    method:'POST',headers:{authorization:'Bearer founder-token','content-type':'application/json'},body:raw,
  }));
  assert.equal(resp.status,413);
  assert.equal(readCount,0);assert.equal(writeCount,0);
});
