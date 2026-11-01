#!/usr/bin/env node
/** Firebase Emulator only: dados fictícios W9 sob workspace almox QA. */
const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
if (project !== 'demo-emprovex-security'
  || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080'
  || !['127.0.0.1:9099', 'localhost:9099'].includes(process.env.FIREBASE_AUTH_EMULATOR_HOST || '')) {
  throw new Error('W9_BROWSER_SEED_REQUIRES_DEMO_AUTH_AND_FIRESTORE_EMULATORS');
}
const base = 'http://127.0.0.1:8080/v1/projects/demo-emprovex-security/databases/(default)/documents';
function encode(value) {
  if (value === null) return { nullValue: 'NULL_VALUE' };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (value && typeof value === 'object') {
    return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encode(v)])) } };
  }
  throw new Error('UNSUPPORTED_QA_SEED_VALUE');
}
async function set(path, obj) {
  const response = await fetch(base + '/' + path, {
    method:'PATCH', headers:{ authorization:'Bearer owner', 'content-type':'application/json' },
    body:JSON.stringify({fields:Object.fromEntries(Object.entries(obj).map(([k,v])=>[k,encode(v)]))}),
  });
  if (!response.ok) throw new Error('QA_WRITE_FAILED:'+path+':'+response.status+':'+await response.text());
}
const workspaceId = 'qa-almox-w1', empenhoId = '2026NE009', ug = '160416';
const item = {id:'00001',name:'Papel A4 (material fictício)',unit:'un',quantity:50,unitPrice:1.5,received:12};
await set('workspaces/'+workspaceId+'/empenhos/prova', {
  id:'prova',supplier:'Fornecedor Exemplo 2',description:'Documento sintético de isolamento',
  date:'2026-10-30',status:'Ativo',classification:'FUNADOM',items:[],revision:1,
});
await set('workspaces/'+workspaceId+'/empenhos/'+empenhoId,{
  id:empenhoId,supplier:'Fornecedor Fictício QA',description:'Material de expediente sintético',
  date:'2026-10-31',status:'Ativo',classification:'FUNADOM',pregao:'Sem Pregão',
  items:[item],revision:1,
});
await set('workspaces/'+workspaceId+'/invoices/QA-NF-009', {
  id:'QA-NF-009',empenhoId,issueDate:'2026-10-31',items:[
    {itemId:item.id,quantity:12,unitPrice:1.5,subtotal:18}
  ],totalValue:18,supplier:'Fornecedor Fictício QA',
  recordKey:'QA-NF-009',registeredAt:'2026-10-31T12:00:00.000Z',
});
await set('workspaces/'+workspaceId+'/cronogramas/'+empenhoId,{
  id:empenhoId,empenhoId,dataCriacao:'2026-10-31T12:00:00.000Z',
  localEntrega:'Almoxarifado QA',observacoes:'Remessa fictícia sem operações físicas',
  colunasEntregas:[{id:'remessa_1',titulo:'1ª Remessa',dataPrevista:'2026-11-15'}],
  distribuicao:{'00001':{'remessa_1':38}},
});
console.log('W9 BROWSER FIXTURE: dados financeiros fictícios; nenhuma operação física.');
