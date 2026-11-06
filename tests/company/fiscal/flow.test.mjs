import test from 'node:test';
import assert from 'node:assert/strict';
import {createTenantRequestBoundary, selectVerifiedProfile, safeConnection,
 fiscalSubmissionGate, safeIssues, displayIssueState, issueIsAuthorized} from '../../../features/company/fiscal/flow.mjs';
import {createFiscalBrowserApi} from '../../../features/company/fiscal/api.mjs';
const A={companyId:'empresa-a',workspaceId:'empresa-a',cnpj:'11222333000181',name:'Empresa A',legalName:'Empresa Alfa'};
const B={companyId:'empresa-b',workspaceId:'empresa-b',cnpj:'44555666000191',name:'Empresa B',legalName:'Empresa Beta'};
const p=(active,profiles=[A,B])=>({ok:true,activeCompanyId:active,profiles});
const connection=(cnpj=A.cnpj,status='connected',environment='homologacao')=>({ok:true,connection:{
  provider:'wlg',issuerCnpj:cnpj,status,environment,verifiedAt:'2026-11-06T00:00:00Z',credentialVersion:2}});
const draft={companyId:A.companyId,issuerCnpj:A.cnpj,orderId:'order-A',recipientCnpj:'77888999000166',
  recipientName:'Cliente A',series:1,number:4,items:[{sku:'item1'}]};
const caps={companyId:A.companyId,issuerCnpj:A.cnpj,canIssue:true,environment:'homologacao'};
const ready=()=>({profile:A,connection:safeConnection(connection(),A),capabilities:caps,draft,confirmed:true,busy:false,uncertain:false});
test('UID A+B only sees selected active CNPJ',()=>{
 assert.equal(selectVerifiedProfile(p(A.companyId),A.companyId).companyId,A.companyId);
 assert.equal(selectVerifiedProfile(p(B.companyId),B.companyId).companyId,B.companyId);
 assert.throws(()=>selectVerifiedProfile(p(B.companyId),A.companyId),{code:'PROFILE_MISMATCH'});
});
test('UID A-only cannot inherit B from A session',()=>{
 assert.throws(()=>selectVerifiedProfile(p(B.companyId,[A]),B.companyId),{code:'PROFILE_INVALID'});
});
test('revoked/suspended/missing profile never forms an active fiscal identity',()=>{
 assert.throws(()=>selectVerifiedProfile({ok:false,profiles:[A]},A.companyId));
 assert.throws(()=>selectVerifiedProfile(p(A.companyId,[]),A.companyId));
});
test('workspace mismatch and invalid CNPJ rejected',()=>{
 assert.throws(()=>selectVerifiedProfile(p(A.companyId,[{...A,workspaceId:'wrong'}]),A.companyId));
 assert.throws(()=>selectVerifiedProfile(p(A.companyId,[{...A,cnpj:'invalid'}]),A.companyId));
});
test('WLG provider cross-CNPJ connection is never displayed as connected',()=>{
 assert.equal(safeConnection(connection(B.cnpj),A).state,'integrity_error');
 assert.equal(safeConnection(connection(),A).state,'connected');
});
test('revoked connection and credential loss block submission',()=>{
 assert.equal(fiscalSubmissionGate({...ready(),connection:safeConnection(connection(A.cnpj,'revoked'),A)}).allowed,false);
 assert.equal(fiscalSubmissionGate({...ready(),connection:safeConnection({ok:true,connection:null},A)}).code,'WLG_UNAVAILABLE');
});
test('production environment is blocked even with server flag',()=>{
 assert.equal(fiscalSubmissionGate({...ready(),connection:safeConnection(connection(A.cnpj,'connected','producao'),A)}).allowed,false);
});
test('server permission is necessary and must match active profile',()=>{
 assert.equal(fiscalSubmissionGate({...ready(),capabilities:null}).code,'BACKEND_DISABLED');
 assert.equal(fiscalSubmissionGate({...ready(),capabilities:{...caps,companyId:B.companyId}}).code,'BACKEND_DISABLED');
 assert.equal(fiscalSubmissionGate({...ready(),capabilities:{...caps,issuerCnpj:B.cnpj}}).code,'BACKEND_DISABLED');
});
test('human issuer/destination confirmation is required',()=>{
 assert.equal(fiscalSubmissionGate({...ready(),confirmed:false}).code,'REVIEW_REQUIRED');
 assert.equal(fiscalSubmissionGate({...ready(),draft:{...draft,companyId:B.companyId}}).code,'REVIEW_REQUIRED');
 assert.equal(fiscalSubmissionGate(ready()).allowed,true);
});
test('two clicks and unknown outcome cannot start another submission',()=>{
 const b=createTenantRequestBoundary(); b.rotate(A.companyId);
 const free=b.lockSubmission(A.companyId,'intent-A');
 assert.equal(typeof free,'function');
 assert.equal(b.lockSubmission(A.companyId,'intent-A'),null);
 assert.equal(b.lockSubmission(A.companyId,'intent-A2'),null);
 assert.equal(fiscalSubmissionGate({...ready(),uncertain:true}).code,'IN_FLIGHT');
 free(); assert.equal(typeof b.lockSubmission(A.companyId,'intent-A'),'function');
});
test('profile A→B cancels A and forbids stale reads/writes',()=>{
 const b=createTenantRequestBoundary(); b.rotate(A.companyId); const a=b.capture(A.companyId);
 b.rotate(B.companyId); assert.equal(a.signal.aborted,true); assert.equal(a.current(),false);
 assert.throws(()=>b.capture(A.companyId),{code:'STALE_TENANT'});
 assert.equal(b.capture(B.companyId).current(),true);
 assert.equal(b.lockSubmission(A.companyId,'intent-A'),null);
});
test('cross-tenant fiscal list and XML metadata are filtered',()=>{
 const payload={ok:true,items:[
 {id:'a1',companyId:A.companyId,issuerCnpj:A.cnpj,status:'authorized',authorizationVerified:true,accessKey:'1'.repeat(44),authorizationProtocol:'100'},
 {id:'b1',companyId:B.companyId,issuerCnpj:B.cnpj,status:'authorized',accessKey:'2'.repeat(44)},
 {id:'a2',companyId:A.companyId,issuerCnpj:A.cnpj,status:'processing'},
 ]};
 const res=safeIssues(payload,A);assert.equal(res.length,2);assert.equal(res.some(x=>x.id==='b1'),false);
 assert.equal(res[1].accessKey,null);
 assert.equal(res[0].authorizationProtocol,'100');
 assert.match(displayIssueState(res[0]),/Autorizada/);
 assert.match(displayIssueState(res[1]),/sem autorização/);
});
test('HTTP 202/processing is never presented as fiscal authorization',()=>{
 assert.match(displayIssueState({status:'processing'}),/sem autorização/);
 assert.equal(issueIsAuthorized({status:'processing',accessKey:'1'.repeat(44)}),false);
});
test('rejected and uncertain remain distinct states',()=>{
 assert.equal(displayIssueState({status:'rejected'}),'Rejeitada');
 assert.match(displayIssueState({status:'uncertain'}),/não reenviar/);
});
test('network GET failure and malformed body fail closed',async()=>{
 const api=createFiscalBrowserApi({getIdToken:async()=> 'token',fetchImpl:async()=>{throw Error('offline')}});
 await assert.rejects(api.profiles(),{code:'NETWORK_UNAVAILABLE'});
 const bad=createFiscalBrowserApi({getIdToken:async()=> 'token',fetchImpl:async()=>({ok:true,json:async()=>({ok:false})})});
 await assert.rejects(bad.nfe(),{code:'SERVER_UNAVAILABLE'});
});
test('fiscal API does not inject tenant authorization from client or retry POST',async()=>{
 let calls=0; let captured=null;
 const api=createFiscalBrowserApi({getIdToken:async()=> 'token-A',fetchImpl:async(url,options)=>{
   calls++; captured={url,options}; return {ok:true,json:async()=>({ok:true,status:'processing'})};
 }});
 await api.submit({orderId:'o1'},'once');
 assert.equal(calls,1);assert.equal(captured.url,'/api/company/fiscal/nfe');
 assert.equal(captured.options.headers.Authorization,'Bearer token-A');
 assert.equal(captured.options.headers['Idempotency-Key'],'once');
 assert.equal(captured.options.credentials,'same-origin');
 assert.equal(captured.options.cache,'no-store');
});
test('POST timeout is unknown outcome and never silently retried',async()=>{
 let calls=0;const api=createFiscalBrowserApi({getIdToken:async()=> 'token',fetchImpl:async()=>{calls++;throw Error('timeout')}});
 await assert.rejects(api.submit({orderId:'o1'},'once'),{code:'UNKNOWN_OUTCOME'});
 assert.equal(calls,1);
});
test('abort on switching profiles prevents submitting to former tenant',async()=>{
 const b=createTenantRequestBoundary();b.rotate(A.companyId);
 const snap=b.capture(A.companyId);b.rotate(B.companyId);
 const api=createFiscalBrowserApi({getIdToken:async()=> 'token',fetchImpl:async()=>{throw Error('must not call')}});
 await assert.rejects(api.submit({},'once',snap.signal),{code:'ABORTED'});
});

test('status autorizado sem prova SEFAZ verificada não aparece como autorizada',()=>{
 assert.match(displayIssueState({status:'authorized',authorizationVerified:false}),/pendente de comprovação/);
 assert.match(displayIssueState({status:'authorized',authorizationVerified:true,accessKey:'1'.repeat(44),authorizationProtocol:'100'}),/Autorizada/);
});
test('HTTP 500 após POST é resultado incerto, sem retry automático',async()=>{
 let calls=0;
 const api=createFiscalBrowserApi({getIdToken:async()=> 'token',fetchImpl:async()=>{
   calls++;return {ok:false,status:500,json:async()=>({ok:false,code:'PROVIDER_FAILED'})};
 }});
 await assert.rejects(api.submit({orderId:'o1'},'once'),{code:'UNKNOWN_OUTCOME'});
 assert.equal(calls,1);
});
test('503 fail-closed de integração pendente é distinto de envio iniciado',async()=>{
 const api=createFiscalBrowserApi({getIdToken:async()=> 'token',fetchImpl:async()=>({
   ok:false,status:503,json:async()=>({ok:false,code:'NFE_INTEGRATION_PENDING'})
 })});
 await assert.rejects(api.submit({orderId:'o1'},'once'),{code:'NFE_INTEGRATION_PENDING'});
});
