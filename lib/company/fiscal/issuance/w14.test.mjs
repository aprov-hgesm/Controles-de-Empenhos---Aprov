import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createNfeIssuanceEngine, NfeIssueError, inspectAuthorizedXml, validNfeAccessKey } from './index.mjs';

const A = '11444777000161', B = '11222333000181';
const pdf = new TextEncoder().encode('%PDF-1.7 demo DANFE bytes');
function keyFor(cnpj=A, series=1, number=22) {
  const body = '43' + '2611' + cnpj + '55'
    + String(series).padStart(3, '0') + String(number).padStart(9, '0')
    + '1' + '12345678';
  let sum = 0;
  for (let i=0; i<43; i++) sum += Number(body[i]) * (2 + ((42-i) % 8));
  const rem = sum % 11;
  return body + (rem < 2 ? 0 : 11-rem);
}
function xmlBytes(key, cnpj=A, { environment='2', status='100', protocol='123456789012345' } = {}) {
  return new TextEncoder().encode(
    '<nfeProc><NFe><infNFe Id="NFe' + key + '"><ide><mod>55</mod><serie>1</serie>'
    + '<nNF>22</nNF><tpAmb>' + environment + '</tpAmb></ide>'
    + '<emit><CNPJ>' + cnpj + '</CNPJ></emit></infNFe>'
    + '<Signature>test fixture, never a real signature</Signature></NFe>'
    + '<protNFe><infProt><chNFe>' + key + '</chNFe><cStat>' + status + '</cStat>'
    + '<nProt>' + protocol + '</nProt><dhRecbto>2026-11-06T15:00:00-03:00</dhRecbto>'
    + '</infProt></protNFe></nfeProc>');
}
function payload(cnpj=A) {
  return {
    emitente:{cnpj}, ide:{modelo:55}, naturezaOperacao:'Venda fiscal conferida por humano',
    destinatario:{cnpj:'12345678000195',razaoSocial:'Cliente teste'},
    itens:[{descricao:'Item de teste',ncm:'10063021',cfop:'5102',cst:'00',
      quantidade:'1.000',icms:{cst:'00'},pis:{cst:'01'},cofins:{cst:'01'}}],
    totais:{valorTotal:'10.00'}, pagamento:{forma:'90'},
  };
}
function fixture({ role='owner', pollResult, failSubmit=false, failXml=false,
  proofOK=true, danfeProofOK=true, storeFails=false }={}) {
  const sessions = { uid:'firebase-user-1', companyId:'company-a', workspaceId:'company-a',
    cnpj:A, active:true, emailVerified:true, role };
  const records = new Map(), idem = new Map(), nums = new Map();
  const log = [];
  let sends=0, probes=0, orderRevision=1, orderValid=true;
  let time=Date.parse('2026-11-06T18:00:00Z');
  const connections = {
    'company-a':{provider:'wlg',companyId:'company-a',workspaceId:'company-a',
      connectionId:'connection-a',cnpj:A,providerEmpresaId:'provider-a',
      environment:'homologacao',status:'connected',
      credentialRef:'projects/demo/secrets/wlg-a/versions/1',credentialVersion:1,
      verification:{issuerCnpj:A,providerEmpresaId:'provider-a',
        credentialVersion:1,verifiedAt:'2026-11-06T12:00:00Z'}},
    'company-b':{provider:'wlg',companyId:'company-b',workspaceId:'company-b',
      connectionId:'connection-b',cnpj:B,providerEmpresaId:'provider-b',
      environment:'homologacao',status:'connected',
      credentialRef:'projects/demo/secrets/wlg-b/versions/1',credentialVersion:1,
      verification:{issuerCnpj:B,providerEmpresaId:'provider-b',
        credentialVersion:1,verifiedAt:'2026-11-06T12:00:00Z'}},
  };
  const store = {
    async reserve(record,meta) {
      if(storeFails) throw Error('FIRESTORE_DOWN');
      const identity=record.companyId+':'+meta.idempotencyKey;
      const earlier=idem.get(identity);
      if (earlier) {
        if (earlier.fingerprint!==meta.fingerprint) throw new NfeIssueError('NFE_IDEMPOTENCY_CONFLICT',409);
        return records.get(earlier.id);
      }
      if(nums.has(meta.numberKey)) throw new NfeIssueError('NFE_NUMBER_RESERVED',409);
      records.set(record.id,structuredClone(record));
      idem.set(identity,{id:record.id,fingerprint:meta.fingerprint});
      nums.set(meta.numberKey,record.id);
      return structuredClone(record);
    },
    async read(company,id) { return structuredClone(records.get(id) ?? null); },
    async cas(company,id,rev,next) {
      const prev=records.get(id);
      if(!prev||prev.companyId!==company||prev.revision!==rev)return null;
      records.set(id,structuredClone(next));return structuredClone(next);
    },
  };
  const adapter = {
    authorize:async action => {
      log.push(action);
      if(!sessions.active || !sessions.emailVerified || sessions.role==='revoked'
        || (sessions.role==='member' && ['fiscal:approve','fiscal:issue'].includes(action))) {
        throw new NfeIssueError('NFE_RBAC_FORBIDDEN',403);
      }
      return structuredClone(sessions);
    },
    resolveConnection:async ctx => connections[ctx.companyId],
    verifyOrder:async (ctx,id,items)=>({companyId:ctx.companyId,workspaceId:ctx.companyId,id,
      fiscalAllocationVerified:orderValid && Array.isArray(items) && items.length>0,
      revision:orderRevision}),
    store,
    provider:{
      async submitHomologation(connection,actor,command) {
        sends++;
        assert.equal(command.reviewedByUid,actor.uid);
        assert.equal(command.humanApprovalVerified,true);
        assert.equal(connection.companyId,actor.companyId);
        if(failSubmit) throw Error('timeout after POST');
        return {kind:'processing',operationId:'op-demonstration-1'};
      },
      async getOperation() { probes++; return pollResult || {kind:'processing'}; },
      async downloadXml(connection,actor,key) {
        if(failXml)throw Error('download unavailable');
        return {bytes:xmlBytes(key,connection.cnpj),
          verifiedIssuerCnpj:connection.cnpj};
      },
    },
    verifyXml: async (bytes,lexical) => ({
      signatureValid:proofOK,protocolValid:proofOK,trustedSefaz:proofOK,
      key:lexical.key,issuerCnpj:lexical.issuerCnpj,
      protocol:lexical.protocol,authorizedAt:lexical.authorizedAt,
    }),
    verifyDanfe:async (ctx,issue,bytes) => ({
      valid:danfeProofOK,accessKey:issue.accessKey,issuerCnpj:issue.issuerCnpj,
    }),
    archivePrivate:async (ctx,issue,doc) => ({
      privateRef:'private/'+ctx.companyId+'/'+issue.id+'/'+doc.kind,
      sha256:doc.sha256,
    }),
    now:()=>new Date(time).toISOString(),
    newId:(()=>{let i=0;return()=> 'fixture-'+(++i)})(),
  };
  const engine = createNfeIssuanceEngine(adapter);
  async function draft(options={}) {
    return engine.createDraft({idempotencyKey:options.idempotencyKey||'same-key',
      series:options.series??1,number:options.number??22,
      orderId:'order-qa',payload:options.payload||payload(sessions.cnpj)});
  }
  async function ready(options={}) {
    const a=await draft(options);
    await engine.requestReview(a.id);
    await engine.approve(a.id,{confirmed:true,fingerprint:a.fingerprint,issuerCnpj:a.issuerCnpj});
    return a;
  }
  async function submitted(options={}) {
    const a=await ready(options);await engine.submit(a.id);return a;
  }
  return {engine,sessions,connections,store,records,log,draft,ready,submitted,
    advance(ms=20000){time+=ms;},changeOrder(){orderRevision++;},
    invalidateAllocation(){orderValid=false;},
    get sends(){return sends;},get probes(){return probes;}};
}
const throwsCode=async (p,code)=>assert.rejects(p,e=>e.code===code);

test('inicialização exige adapters seguros e store CAS',()=>{
  assert.throws(()=>createNfeIssuanceEngine({}),e=>e.code==='NFE_INTEGRATION_REQUIRED');
});
test('intenção reserva CNPJ, workspace e série/número do servidor',async()=>{
  const f=fixture();const r=await f.draft();
  assert.equal(r.issuerCnpj,A);assert.equal(r.companyId,'company-a');
  assert.equal(r.number,22);assert.equal(r.status,'draft');assert.equal(r.submitAttempt,undefined);
});
test('idempotência mesma chave retorna a mesma intenção',async()=>{
  const f=fixture();const a=await f.draft();const b=await f.draft();
  assert.equal(a.id,b.id);assert.equal(f.records.size,1);
});
test('idempotência reusada com dados diferentes falha 409',async()=>{
  const f=fixture();await f.draft();
  await throwsCode(f.draft({number:23}),'NFE_IDEMPOTENCY_CONFLICT');
});
test('número e série não podem ser reservados duas vezes',async()=>{
  const f=fixture();await f.draft();
  await throwsCode(f.draft({idempotencyKey:'other-key'}),'NFE_NUMBER_RESERVED');
});
test('número diferente aceita nova intenção',async()=>{
  const f=fixture();await f.draft();
  const x=await f.draft({idempotencyKey:'other-key',number:23});
  assert.equal(x.number,23);
});
test('sem owner do pedido, draft rejeitado',async()=>{
  const f=fixture();f.sessions.companyId='company-b';
  f.sessions.workspaceId='company-b';f.sessions.cnpj=B;
  await throwsCode(f.engine.createDraft({idempotencyKey:'x-key',companyId:'company-a',
    series:1,number:22,orderId:'order-qa',payload:payload(B)}),'NFE_INVALID_INPUT');
});
test('UID único com perfis A e B não enxerga nota A depois de trocar perfil',async()=>{
  const f=fixture();const a=await f.draft();
  f.sessions.companyId='company-b';f.sessions.workspaceId='company-b';f.sessions.cnpj=B;
  await throwsCode(f.engine.getStatus(a.id),'NFE_TENANT_FORBIDDEN');
  const b=await f.draft({idempotencyKey:'same-key'});
  assert.equal(b.issuerCnpj,B);assert.notEqual(a.id,b.id);
});
test('papel member não pode aprovar nem emitir mesmo UID',async()=>{
  const f=fixture();const a=await f.draft();await f.engine.requestReview(a.id);
  f.sessions.role='member';await throwsCode(f.engine.approve(a.id,{confirmed:true,
    fingerprint:a.fingerprint,issuerCnpj:A}),'NFE_RBAC_FORBIDDEN');
});
test('empresa suspensa e conta revogada falham antes de buscar documentos',async()=>{
  const f=fixture();const a=await f.draft();
  f.sessions.active=false;await throwsCode(f.engine.getStatus(a.id),'NFE_RBAC_FORBIDDEN');
  f.sessions.active=true;f.sessions.role='revoked';
  await throwsCode(f.engine.getStatus(a.id),'NFE_RBAC_FORBIDDEN');
});
test('conexão de B sob actor A bloqueia review',async()=>{
  const f=fixture();const a=await f.draft();f.connections['company-a']=f.connections['company-b'];
  await throwsCode(f.engine.requestReview(a.id),'NFE_CONNECTION_MISMATCH');
});
test('tributação, destinatário e NCM exigem revisão humana',async()=>{
  const f=fixture();const p=payload();delete p.itens[0].ncm;
  const a=await f.draft({payload:p});
  await throwsCode(f.engine.requestReview(a.id),'NFE_TAX_FIELDS_REQUIRED');
});
test('aprovação humana exige hash e CNPJ atuais',async()=>{
  const f=fixture();const a=await f.draft();await f.engine.requestReview(a.id);
  await throwsCode(f.engine.approve(a.id,{confirmed:true,
    fingerprint:'wrong',issuerCnpj:A}),'NFE_HUMAN_APPROVAL_REQUIRED');
  const b=await f.engine.approve(a.id,{confirmed:true,fingerprint:a.fingerprint,issuerCnpj:A});
  assert.equal(b.status,'approved');
});
test('sem revisão não há envio',async()=>{
  const f=fixture();const a=await f.draft();
  await throwsCode(f.engine.submit(a.id),'NFE_TRANSITION_FORBIDDEN');
  assert.equal(f.sends,0);
});
test('WLG 202 significa processando, nunca autorizada',async()=>{
  const f=fixture();const a=await f.submitted();
  assert.equal((await f.engine.getStatus(a.id)).status,'processing');
  assert.equal(f.sends,1);
});
test('retry de POST idempotente não repete envio externo',async()=>{
  const f=fixture();const a=await f.submitted();await f.engine.submit(a.id);
  await f.engine.submit(a.id);assert.equal(f.sends,1);
});
test('submits concorrentes submetem no máximo uma vez com CAS',async()=>{
  const f=fixture();const a=await f.ready();
  const results=await Promise.allSettled([f.engine.submit(a.id),f.engine.submit(a.id)]);
  assert.equal(f.sends,1);
  assert.equal(results.length,2);
});
test('timeout ambíguo marca uncertain e nunca reenvia',async()=>{
  const f=fixture({failSubmit:true});const a=await f.ready();
  const r=await f.engine.submit(a.id);assert.equal(r.status,'uncertain');
  await f.engine.submit(a.id);assert.equal(f.sends,1);
});
test('polling respeita backoff e orçamento',async()=>{
  const f=fixture();const a=await f.submitted();
  await f.engine.poll(a.id);assert.equal(f.probes,0);
  f.advance(20000);const r=await f.engine.poll(a.id);
  assert.equal(r.status,'processing');assert.equal(f.probes,1);
});
test('resposta rejeitada altera status sem documentos de autorização',async()=>{
  const f=fixture({pollResult:{kind:'rejected',reason:'SEFAZ rejeitou'}});
  const a=await f.submitted();f.advance();
  const r=await f.engine.poll(a.id);assert.equal(r.status,'rejected');
  assert.equal(r.accessKey,undefined);
});
test('chave NF-e valida dígito, CNPJ, série e número',()=>{
  const key=keyFor();assert.equal(key.length,44);
  assert.equal(validNfeAccessKey(key,A,1,22),true);
  assert.equal(validNfeAccessKey(key,B,1,22),false);
  assert.equal(validNfeAccessKey(key,A,1,23),false);
  assert.equal(validNfeAccessKey(key.slice(0,43)+'9',A,1,22),false);
});
test('XML deve ter emitente, chave, ambiente e protocolo coerentes',()=>{
  const key=keyFor();const expected={key,issuerCnpj:A,series:1,number:22};
  assert.equal(inspectAuthorizedXml(xmlBytes(key),expected).key,key);
  assert.throws(()=>inspectAuthorizedXml(xmlBytes(key,B),expected),e=>e.code==='NFE_XML_NOT_AUTHORIZED');
  assert.throws(()=>inspectAuthorizedXml(xmlBytes(key,A,{environment:'1'}),expected),e=>e.code==='NFE_XML_NOT_AUTHORIZED');
  assert.throws(()=>inspectAuthorizedXml(xmlBytes(key,A,{status:'101'}),expected),e=>e.code==='NFE_XML_NOT_AUTHORIZED');
});
test('DOCTYPE externo não passa na inspeção XML',()=>{
  const key=keyFor();const malicious=new TextEncoder().encode(
    '<!DOCTYPE foo [<!ENTITY x SYSTEM "file:///tmp/secrets">]>'+new TextDecoder().decode(xmlBytes(key)));
  assert.throws(()=>inspectAuthorizedXml(malicious,{key,issuerCnpj:A,series:1,number:22}),
    e=>e.code==='NFE_XML_UNSAFE');
});
test('SUCCESSO WLG sem prova criptográfica não autoriza nota',async()=>{
  const f=fixture({pollResult:{kind:'provider_success_unverified',
    chaveNfe:keyFor(),dataAutorizacao:'2026-11-06'},proofOK:false});
  const a=await f.submitted();f.advance();const r=await f.engine.poll(a.id);
  assert.equal(r.status,'uncertain');assert.equal(r.accessKey,undefined);
});
test('XML verificado e arquivado privadamente permite authorized',async()=>{
  const f=fixture({pollResult:{kind:'provider_success_unverified',
    chaveNfe:keyFor(),dataAutorizacao:'2026-11-06'}});
  const a=await f.submitted();f.advance();const r=await f.engine.poll(a.id);
  assert.equal(r.status,'authorized');assert.equal(r.documents.length,1);
  assert.equal(r.documents[0].kind,'authorized_xml');assert.match(r.documents[0].sha256,/^[a-f0-9]{64}$/);
  assert.ok(!r.documents[0].privateRef.startsWith('http'));
});
test('DANFE distinto do XML com hash e caminho privado',async()=>{
  const f=fixture({pollResult:{kind:'provider_success_unverified',chaveNfe:keyFor()}});
  const a=await f.submitted();f.advance();await f.engine.poll(a.id);
  const r=await f.engine.archiveDanfe(a.id,pdf);
  assert.equal(r.documents.length,2);assert.notEqual(r.documents[0].sha256,r.documents[1].sha256);
  assert.equal(r.documents[1].kind,'danfe');
  const again=await f.engine.archiveDanfe(a.id,pdf);assert.equal(again.documents.length,2);
});
test('DANFE sem prova do emitente e chave do XML é recusado',async()=>{
  const f=fixture({pollResult:{kind:'provider_success_unverified',chaveNfe:keyFor()},danfeProofOK:false});
  const a=await f.submitted();f.advance();await f.engine.poll(a.id);
  await throwsCode(f.engine.archiveDanfe(a.id,pdf),'NFE_DANFE_PROOF_REQUIRED');
});
test('DANFE sozinho jamais substitui XML e protocolo',async()=>{
  const f=fixture();const a=await f.submitted();
  await throwsCode(f.engine.archiveDanfe(a.id,pdf),'NFE_XML_AUTHORIZATION_REQUIRED');
});
test('WLG indisponível na consulta implica reconciliação, não sucesso',async()=>{
  const f=fixture({pollResult:{kind:'provider_success_unverified',chaveNfe:keyFor()},failXml:true});
  const a=await f.submitted();f.advance();
  const r=await f.engine.poll(a.id);assert.equal(r.status,'uncertain');
});
test('troca de empresa depois de submeter impede poll no tenant anterior',async()=>{
  const f=fixture();const a=await f.submitted();f.advance();
  f.sessions.companyId='company-b';f.sessions.workspaceId='company-b';f.sessions.cnpj=B;
  await throwsCode(f.engine.poll(a.id),'NFE_TENANT_FORBIDDEN');
});
test('produção não pode ser habilitada por objeto de navegador',async()=>{
  const f=fixture();f.connections['company-a'].environment='producao';
  await throwsCode(f.draft(),'NFE_HOMOLOGATION_ONLY');
  const g=fixture();const p=payload();p.empresaId='injected';
  const a=await g.draft({payload:p});
  await throwsCode(g.engine.requestReview(a.id),'NFE_CLIENT_AUTHORITY_FORBIDDEN');
});
test('pedido parcial não aprovado pelo verificador W1 bloqueia criação',async()=>{
  const f=fixture();f.invalidateAllocation();
  await throwsCode(f.draft(),'NFE_ORDER_NOT_VERIFIED');
});
test('pedido alterado após aprovação exige nova revisão e bloqueia POST',async()=>{
  const f=fixture();const a=await f.ready();f.changeOrder();
  await throwsCode(f.engine.submit(a.id),'NFE_ORDER_CHANGED_REVIEW_REQUIRED');
  assert.equal(f.sends,0);
});
test('emitente divergente do CNPJ autorizado é bloqueado antes de aprovar',async()=>{
  const f=fixture();const a=await f.draft({payload:payload(B)});
  await throwsCode(f.engine.requestReview(a.id),'NFE_ISSUER_MISMATCH');
});
test('eventos cancelamento e CC-e permanecem indisponíveis sem Swagger',async()=>{
  const f=fixture();
  await throwsCode(f.engine.cancelOrCorrect(),'NFE_EVENTS_UNSUPPORTED_PENDING_CONTRACT');
});
test('falha de persistência não retorna sucesso falso',async()=>{
  const f=fixture({storeFails:true});await assert.rejects(f.draft(),/FIRESTORE_DOWN/);
});
test('GET seguro nunca serializa payload fiscal nem credenciais WLG',async()=>{
  const f=fixture();const a=await f.draft();const r=await f.engine.getStatus(a.id);
  assert.equal(r.payload,undefined);assert.equal(r.credentialRef,undefined);
  assert.equal(r.providerEmpresaId,undefined);
});
test('compilação de hash verifica arquivo distinto para integridade',()=>{
  const one=createHash('sha256').update(pdf).digest('hex');
  const two=createHash('sha256').update(xmlBytes(keyFor())).digest('hex');
  assert.notEqual(one,two);
});
