import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createHash, randomUUID } from 'node:crypto';
import ts from 'typescript';

function compile(path,deps={},globals={}){
  const code=readFileSync(new URL(path,import.meta.url),'utf8');
  const t=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
  assert.equal(t.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length??0,0);
  const exports={};
  runInNewContext(t.outputText,{exports,require(id){assert.ok(Object.hasOwn(deps,id),'Unexpected import '+id);return deps[id];},
    process,Date,BigInt,Map,Set,URL,URLSearchParams,AbortSignal,Request,Response,fetch,TextEncoder,console,...globals});
  return exports;
}
const model=compile('./model.ts');
const invoice=(direction='payable')=>({
  invoice:{number:'12345',series:'1',issuedOn:'2026-11-05',totalCents:10001},
  counterparty:{id:'partner-1',label:'Contraparte QA'},sourceOrderId:'order_1',dueOn:'2026-12-05'
});
const record=(overrides={})=>({id:'f8_test',schemaVersion:'company-r1-v1',companyId:'A',workspaceId:'A',
  status:'active',createdByUid:'ownerA',createdAt:'2026-11-05T00:00:00.000Z',updatedAt:'2026-11-05T00:00:00.000Z',
  revision:1,entries:[],financialStatus:'open',...model.parseFinanceDraft(invoice(),'payable'),...overrides});

test('NF entrada só cria obrigação a pagar; saída só receber, origem manual não verificada',()=>{
  const a=model.parseFinanceDraft(invoice(),'payable'),b=model.parseFinanceDraft(invoice(),'receivable');
  assert.equal(a.direction,'payable');assert.equal(b.direction,'receivable');
  assert.equal(a.invoice.verification,'unverified');assert.equal(b.invoice.source,'manual');
  assert.throws(()=>model.parseFinanceDraft({...invoice(),invoice:{...invoice().invoice,totalCents:1.2}},'payable'));
  assert.throws(()=>model.parseFinanceDraft({...invoice(),dueOn:'2026-02-30'},'payable'));
});
test('pagamentos parciais e centavos ímpares fecham exatamente, sem baixa automática',()=>{
  const p=model.applyEntry(record(),model.parseEntryCommand({kind:'settlement',amountCents:3333,
    occurredOn:'2026-11-05',reason:'Pagamento informado manualmente'}),'e1','ownerA','2026-11-05T00:00:00Z');
  assert.deepEqual({...model.balance(p)},{totalCents:10001,appliedCents:3333,outstandingCents:6668,status:'partial'});
  const q=model.applyEntry(p,model.parseEntryCommand({kind:'settlement',amountCents:6668,
    occurredOn:'2026-11-06',reason:'Complemento manual'}),'e2','ownerA','2026-11-06T00:00:00Z');
  assert.equal(model.balance(q).status,'settled');assert.equal(model.balance(q).outstandingCents,0);
  assert.throws(()=>model.applyEntry(q,model.parseEntryCommand({kind:'settlement',amountCents:1,
    occurredOn:'2026-11-07',reason:'Extra'}),'e3','ownerA','2026-11-07T00:00:00Z'),/FINANCE_OVERPAYMENT/);
});
test('estorno único de pagamento, histórico preservado e ajuste rastreado',()=>{
  const p=model.applyEntry(record(),model.parseEntryCommand({kind:'settlement',amountCents:7000,
    occurredOn:'2026-11-05',reason:'Conferência manual'}),'e1','ownerA','2026-11-05T00:00:00Z');
  const revert=model.parseEntryCommand({kind:'settlement_reversal',reversesEntryId:'e1',
    occurredOn:'2026-11-07',reason:'Estorno por comprovante inválido'});
  const q=model.applyEntry(p,revert,'e2','ownerA','2026-11-07T00:00:00Z');
  assert.equal(model.balance(q).outstandingCents,10001);assert.equal(q.entries.length,2);
  assert.throws(()=>model.applyEntry(q,revert,'e3','ownerA','2026-11-07T00:00:00Z'),/FINANCE_INVALID_REVERSAL/);
  const a=model.applyEntry(q,model.parseEntryCommand({kind:'adjustment',amountCents:-1001,
    occurredOn:'2026-11-08',reason:'Abatimento documentado por negociação'}),'e4','ownerA','2026-11-08T00:00:00Z');
  assert.equal(model.balance(a).totalCents,9000);
  assert.throws(()=>model.parseEntryCommand({kind:'adjustment',amountCents:100,occurredOn:'2026-11-08',reason:'x'}));
});
test('cancelamento exige trilha e impede baixa com pagamento ativo',()=>{
  const cancelled=model.cancelObligation(record(),'Cancelamento formal autorizado','2026-11-08T00:00:00Z');
  assert.equal(cancelled.financialStatus,'cancelled');
  assert.throws(()=>model.applyEntry(cancelled,model.parseEntryCommand({kind:'settlement',
    amountCents:1,occurredOn:'2026-11-08',reason:'Teste'}),'e1','ownerA','2026-11-08T00:00:00Z'));
  const p=model.applyEntry(record(),model.parseEntryCommand({kind:'settlement',amountCents:1,
    occurredOn:'2026-11-08',reason:'Pagamento informado'}),'e1','ownerA','2026-11-08T00:00:00Z');
  assert.throws(()=>model.cancelObligation(p,'Cancelamento documentado','2026-11-08T00:00:00Z'));
});
test('margem mantém lacunas, projeção não se apresenta como realizada, caixa é previsão',()=>{
  const incomplete=model.estimateMargin({revenueCents:20000,materialCostCents:14000});
  assert.equal(incomplete.knownComponentMarginCents,6000);
  assert.deepEqual([...incomplete.missing],['freightCents','taxesCents','otherCents']);
  assert.equal(incomplete.complete,false);assert.equal(incomplete.basis,'estimate');
  const complete=model.estimateMargin({revenueCents:20000,materialCostCents:14000,
    freightCents:1000,taxesCents:500,otherCents:0});
  assert.equal(complete.knownComponentMarginCents,4500);assert.equal(complete.complete,true);
  const flow=model.cashflow([record(),record({direction:'receivable',id:'b'})]);
  assert.equal(flow[0].netForecastCents,0);
  assert.equal(flow[0].basis,'open_obligations_not_confirmed_cash');
});
function fixture(){
  const data=new Map();let serial=0;
  const encode=v=>typeof v==='string'?{stringValue:v}:typeof v==='number'?{integerValue:String(v)}:
    typeof v==='boolean'?{booleanValue:v}:v===null?{nullValue:'NULL_VALUE'}:
    Array.isArray(v)?{arrayValue:{values:v.map(encode)}}:
    {mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encode(x)]))}};
  const decode=v=>v.stringValue!==undefined?v.stringValue:v.integerValue!==undefined?Number(v.integerValue):
    v.booleanValue!==undefined?v.booleanValue:v.nullValue?null:v.arrayValue?(v.arrayValue.values??[]).map(decode):
    Object.fromEntries(Object.entries(v.mapValue.fields??{}).map(([k,x])=>[k,decode(x)]));
  const pathOf=url=>decodeURIComponent(url.split('/documents/')[1]||'').split('?')[0];
  const resp=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
  async function mockFetch(url,options={}){
    const u=new URL(url),p=pathOf(u.pathname);
    if(u.pathname.endsWith(':commit')){
      const {writes}=JSON.parse(options.body);
      for(const w of writes){const name=pathOf(w.update.name),old=data.get(name);
        if((w.currentDocument.exists===false&&old)||
          (w.currentDocument.updateTime&&old?.updateTime!==w.currentDocument.updateTime))return resp({error:'CONFLICT'},409);
      }
      for(const w of writes){const name=pathOf(w.update.name);
        data.set(name,{fields:w.update.fields,updateTime:'t'+(++serial)});}
      return resp({});
    }
    if(data.has(p))return resp({...data.get(p),name:p});
    if(u.searchParams.has('pageSize')){
      const all=[...data].filter(([k])=>k.startsWith(p+'/')&&!k.slice(p.length+1).includes('/'));
      const start=Number(u.searchParams.get('pageToken')||0),limit=Number(u.searchParams.get('pageSize')||20);
      return resp({documents:all.slice(start,start+limit).map(([name,v])=>({...v,name})),
        nextPageToken:start+limit<all.length?String(start+limit):undefined});
    }
    return resp({error:'NOT_FOUND'},404);
  }
  const store=compile('./store.ts',{
    'server-only':{},'node:crypto':{createHash,randomUUID},
    '../../../firebase-applet-config.json':{projectId:'demo-w8',firestoreDatabaseId:'(default)'},
    '../../server/sectorProvisioningAdmin':{getGoogleAccessToken:async()=>''},
    '../contracts':{COMPANY_CONTRACT_VERSION:'company-r1-v1',
      companyDocumentPath:(companyId,col,id)=>'supplierCompanyWorkspaces/'+companyId+'/'+col+'/'+id},
    './model':model,
  },{fetch:mockFetch,process:{env:{EMPROVEX_E2E_SERVER_AUTH:'1',
    NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID:'demo-w8',
    FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099'}}});
  const ctx=(tenant,action='accountsPayable:write',role='owner')=>({
    uid:'owner'+tenant,companyId:tenant,rootPath:'supplierCompanyWorkspaces/'+tenant,action,role
  });
  return {store,ctx,data,decode};
}
test('A/B isolados: mesmo número NF, documentos independentes e guard role financeiro',async()=>{
  const {store,ctx}=fixture();
  const a=await store.createObligation(ctx('A'),'payable',invoice(),'key-a-123456789');
  const b=await store.createObligation(ctx('B'),'payable',invoice(),'key-b-123456789');
  assert.equal(a.result.companyId,'A');assert.equal(b.result.companyId,'B');
  assert.equal((await store.one(ctx('A','accountsPayable:read'),'payable',a.result.id)).companyId,'A');
  await assert.rejects(()=>store.one(ctx('B','accountsPayable:read'),'payable','foreign_missing'));
  await assert.rejects(()=>store.createObligation(ctx('A','accountsPayable:write','driver'),'payable',invoice(),'key-c-123456789'),/FINANCE_FORBIDDEN/);
  await assert.rejects(()=>store.createObligation(ctx('A','accountsReceivable:write'),'payable',invoice(),'key-d-123456789'),/FINANCE_FORBIDDEN/);
});
test('idempotência, colisão por NF e tentativa de alteração de payload',async()=>{
  const {store,ctx}=fixture();
  const a=await store.createObligation(ctx('A'),'payable',invoice(),'key-one-123456');
  const b=await store.createObligation(ctx('A'),'payable',invoice(),'key-one-123456');
  assert.equal(b.replay,true);assert.equal(a.result.id,b.result.id);
  await assert.rejects(()=>store.createObligation(ctx('A'),'payable',
    {...invoice(),dueOn:'2026-12-06'},'key-one-123456'),/FINANCE_CONFLICT/);
  await assert.rejects(()=>store.createObligation(ctx('A'),'payable',invoice(),'key-two-123456'),/FINANCE_DUPLICATE_INVOICE/);
});
test('duas baixas concorrentes não superam saldo; CAS e retry são atômicos',async()=>{
  const {store,ctx}=fixture();
  const c=ctx('A');
  const base=(await store.createObligation(c,'payable',invoice(),'key-create-123456')).result;
  const cmd={expectedRevision:1,kind:'settlement',amountCents:9000,occurredOn:'2026-11-06',reason:'Depósito informado manualmente'};
  const settled=await Promise.allSettled([
    store.recordEntry(c,'payable',base.id,cmd,'key-pay-one-123456'),
    store.recordEntry(c,'payable',base.id,cmd,'key-pay-two-123456')
  ]);
  assert.equal(settled.filter(x=>x.status==='fulfilled').length,1);
  const current=await store.one(ctx('A','accountsPayable:read'),'payable',base.id);
  assert.equal(model.balance(current).outstandingCents,1001);
  const repeat=await store.recordEntry(c,'payable',base.id,cmd,
    settled[0].status==='fulfilled'?'key-pay-one-123456':'key-pay-two-123456');
  assert.equal(repeat.replay,true);
  assert.equal((await store.page(ctx('A','accountsPayable:read'),'payable',10,'')).items.length,1);
});
