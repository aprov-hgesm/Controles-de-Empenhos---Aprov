import assert from 'node:assert/strict';
import test from 'node:test';

test('Leitura IAM de material pagina sem depender das Rules de SDK, com escopo e teto seguro',async()=>{
  const prior={
    mode:process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR,
    e2e:process.env.EMPROVEX_E2E_SERVER_AUTH,
    project:process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID,
    port:process.env.EMPROVEX_E2E_WAREHOUSE_FIRESTORE_PORT,
  };
  const previousFetch=globalThis.fetch;
  process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR='1';
  process.env.EMPROVEX_E2E_SERVER_AUTH='1';
  process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID='demo-emprovex-security';
  process.env.EMPROVEX_E2E_WAREHOUSE_FIRESTORE_PORT='8081';
  const path='projects/demo-emprovex-security/databases/emprovex-warehouse/documents/warehouse/ws_demo/materials/';
  const doc=(suffix:string)=>({name:path+'mat_'+suffix.repeat(32),
    updateTime:'2026-10-28T12:00:00Z',fields:{description:{stringValue:'Feijão '+suffix}}});
  const requested:string[]=[];
  try{
    globalThis.fetch=(async(input:RequestInfo|URL)=>{
      const url=String(input);
      requested.push(url);
      assert.ok(url.startsWith('http://127.0.0.1:8081/v1/projects/demo-emprovex-security/'));
      assert.ok(url.includes('/warehouse/ws_demo/materials'));
      const token=new URL(url).searchParams.get('pageToken');
      return Response.json(token==='second'
        ? {documents:[doc('2')]}
        : {documents:[doc('1')],nextPageToken:'second'});
    }) as typeof fetch;
    const {warehouseAdminListFullStockCatalog}=await import('../lib/server/warehouseFirestoreTransaction');
    const rows=await warehouseAdminListFullStockCatalog('emulator','ws_demo','materials',5);
    assert.equal(rows.length,2);
    assert.deepEqual(rows.map(row=>row.data.description),['Feijão 1','Feijão 2']);
    assert.equal(requested.length,2);
    await assert.rejects(()=>warehouseAdminListFullStockCatalog('emulator','../escape','materials',5));
    globalThis.fetch=(async()=>Response.json({documents:[doc('1'),doc('2')]})) as typeof fetch;
    await assert.rejects(()=>warehouseAdminListFullStockCatalog('emulator','ws_demo','materials',1),
      (error:unknown)=>error instanceof Error&&error.message==='WAREHOUSE_STOCK_CATALOG_TOO_LARGE');
  }finally{
    globalThis.fetch=previousFetch;
    for(const [key,value] of Object.entries({
      EMPROVEX_WAREHOUSE_ADMIN_EMULATOR:prior.mode,
      EMPROVEX_E2E_SERVER_AUTH:prior.e2e,
      NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID:prior.project,
      EMPROVEX_E2E_WAREHOUSE_FIRESTORE_PORT:prior.port,
    })){
      if(value===undefined)delete process.env[key];else process.env[key]=value;
    }
  }
});
