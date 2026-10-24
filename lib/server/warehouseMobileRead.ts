/**
 * Adaptador de leituras por IAM do Operador Movel.
 * Caminhos e consultas enumerados; workspace/UG nunca sao escolhidos pelo caller.
 * Os contratos canônicos são validados no lado do cliente pelos leitores atuais,
 * e no servidor conferimos o isolamento de cada documento.
 */
import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { WarehouseStoreError, warehouseAdminBatchRead,
  warehouseAdminReadScopedQuery, type WarehouseAdminDocument } from './warehouseFirestoreTransaction';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';

const DOMAINS = new Set([
  'materials','barcodes','depots','locations','locationBalances',
  'balances','lots','inventories','items','destinations',
]);
const ID_PATTERN = /^[A-Za-z0-9_-]{1,130}$/;
const FILTERS: Record<string, readonly string[]> = {
  materials: [], barcodes: ['materialId'], depots: ['code'],
  locations: ['code'], locationBalances: ['materialId','position.kind',
    'position.locationId','position.subpositionId'],
  balances: [], lots: ['materialId','position.kind',
    'position.locationId','position.subpositionId'],
  inventories: [],items:[],destinations:[],
};
type Filter = {field:string;op:string;value:unknown};
type Input = {kind:'DOCUMENT'|'QUERY';domain:string;id?:string;filters?:Filter[];
  maxResults?:number;inventoryId?:string;newestFirst?:boolean};

function invalid():never {
  throw new WarehouseStoreError('WAREHOUSE_MOBILE_READ_INVALID',400);
}

function verifyItem(row:WarehouseAdminDocument,access:VerifiedWarehouseRequest):void {
  if (row.data.workspaceId !== access.workspaceId || row.data.ug !== access.ug) {
    throw new WarehouseStoreError('WAREHOUSE_MOBILE_READ_SCOPE_INTEGRITY',409);
  }
}

export async function warehouseMobileReadServer(
  access:VerifiedWarehouseRequest,input:unknown
):Promise<{documents:{id:string;data:Record<string,unknown>}[]}> {
  if(!input||typeof input!=='object'||Array.isArray(input))return invalid();
  const r=input as Input;
  if(!DOMAINS.has(r.domain)
    || (r.kind!=='DOCUMENT'&&r.kind!=='QUERY')
    || (r.domain==='items')!==Boolean(r.inventoryId)
    || (r.inventoryId!==undefined&&(!/^inv_[a-f0-9]{32}$/.test(r.inventoryId))))
    return invalid();
  const token=process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
    ? 'emulator' : await getGoogleAccessToken();
  const parent='warehouse/'+access.workspaceId
    +(r.inventoryId?'/inventories/'+r.inventoryId:'');
  let rows:WarehouseAdminDocument[]=[];
  if(r.kind==='DOCUMENT') {
    if(typeof r.id!=='string'||!ID_PATTERN.test(r.id)||r.filters!==undefined
      ||r.maxResults!==undefined||r.newestFirst!==undefined
      ||(r.domain==='items'&&!/^invit_[a-f0-9]{64}$/.test(r.id)))return invalid();
    const path=parent+'/'+r.domain+'/'+r.id;
    const item=(await warehouseAdminBatchRead(token,[path])).get(path);
    if(item)rows=[item];
  } else {
    if(r.id!==undefined||!Number.isInteger(r.maxResults)
      ||(r.maxResults as number)<1||(r.maxResults as number)>500
      ||!Array.isArray(r.filters)||r.filters.length>3
      ||(r.newestFirst===true&&r.domain!=='inventories'))return invalid();
    const filters=r.filters;
    const unique=new Set<string>();
    for(const f of filters) {
      if(!f||!FILTERS[r.domain]?.includes(f.field)||f.op!=='=='
        ||typeof f.value!=='string'||f.value.length>128||!f.value
        ||unique.has(f.field))return invalid();
      unique.add(f.field);
    }
    rows=await warehouseAdminReadScopedQuery(token,access.workspaceId,
      r.domain,filters.map(f=>({field:f.field,value:f.value as string})),
      r.maxResults as number,r.inventoryId??null,r.newestFirst===true);
  }
  for(const row of rows)verifyItem(row,access);
  return {documents:rows.map(row=>({id:row.path.split('/').at(-1)!,data:row.data}))};
}
