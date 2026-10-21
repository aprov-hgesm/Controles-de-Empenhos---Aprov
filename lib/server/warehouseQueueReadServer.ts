/**
 * Warehouse Read R1. Reuses the original intake parsing/quantity derivation
 * contract; only its I/O moves to authenticated, scoped server REST requests.
 * No stock movement or canonical NF mutation happens on this GET.
 */
import { createHash } from 'node:crypto';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { WarehouseStoreError } from './warehouseFirestoreTransaction';
import { warehouseQueueIndexServer } from './warehouseQueueIndexWrite';
import { queueReadDocument, queueReadIds, queueReadUpTo,
  type QueueDocument } from './warehouseQueueReadStore';
import type { Empenho, Invoice } from '../types';
import type { WarehouseInvoiceIntakeQueueContext,WarehouseInvoiceIntakeQueueRow }
  from '../warehouse/intakeStateRepository';
import { createWarehouseItemIntakeId,validateWarehouseItemIntake,
  WAREHOUSE_ITEM_INTAKE_SCHEMA_VERSION,type WarehouseItemIntake } from '../warehouse/intake';
import { validateWarehouseItemIntakeState,
  WAREHOUSE_ITEM_INTAKE_STATE_SCHEMA_VERSION,
  calculateWarehouseItemIntakePendingQuantity,deriveWarehouseItemIntakeStatus,
  type WarehouseItemIntakeState } from '../warehouse/intakeState';
import { createWarehouseMovementId } from '../warehouse/movement';
import { normalizeWarehouseMaterialId } from '../warehouse/material';
import { WAREHOUSE_INTAKE_QUEUE_INDEX_SCHEMA_VERSION,
  WAREHOUSE_INTAKE_QUEUE_CANDIDATE_SCHEMA_VERSION,
  WAREHOUSE_INTAKE_QUEUE_EXCLUSION_SCHEMA_VERSION } from '../warehouse/queueReadContracts';
type PersistedIntake =
  | {kind:'V1';intake:WarehouseItemIntake;createdAt:string|null;updatedAt:string|null}
  | {kind:'V2';state:WarehouseItemIntakeState};

function timestampToIso(value: unknown): string | null {
  if (
    value
    && typeof value === 'object'
    && 'toDate' in value
    && typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return value;
  return null;
}

function recordKey(invoice: Invoice): string {
  return (invoice.recordKey || invoice.id || '').trim();
}

function itemKey(invoiceRecordKey: string, itemId: string): string {
  return invoiceRecordKey + '|' + itemId;
}


function parsePersistedIntake(
  workspaceId: string,
  id: string,
  data: Record<string, unknown>
): PersistedIntake | null {
  if (data.schemaVersion === WAREHOUSE_ITEM_INTAKE_SCHEMA_VERSION) {
    const result = validateWarehouseItemIntake(
      { ...data, id },
      { expectedWorkspaceId: workspaceId }
    );
    if (!result.ok) {
      throw new Error(
        'WAREHOUSE_INVALID_LEGACY_ITEM_INTAKE: '
        + result.issues.map((issue) => issue.path + ': ' + issue.message).join('; ')
      );
    }
    return {
      kind: 'V1',
      intake: result.data,
      createdAt: timestampToIso(data.createdAt),
      updatedAt: timestampToIso(data.updatedAt),
    };
  }

  if (data.schemaVersion === WAREHOUSE_ITEM_INTAKE_STATE_SCHEMA_VERSION) {
    const result = validateWarehouseItemIntakeState(
      {
        ...data,
        id,
        createdAt: timestampToIso(data.createdAt),
        updatedAt: timestampToIso(data.updatedAt),
      },
      { expectedWorkspaceId: workspaceId }
    );
    if (!result.ok) {
      throw new Error(
        'WAREHOUSE_INVALID_ITEM_INTAKE_STATE: '
        + result.issues.map((issue) => issue.path + ': ' + issue.message).join('; ')
      );
    }
    return { kind: 'V2', state: result.data };
  }

  return null;
}


function orphanRowFromPersisted(
  persisted: PersistedIntake
): WarehouseInvoiceIntakeQueueRow {
  if (persisted.kind === 'V2') {
    return {
      key: itemKey(persisted.state.invoiceRecordKey, persisted.state.itemId),
      stateId: persisted.state.id,
      invoiceRecordKey: persisted.state.invoiceRecordKey,
      invoiceId: persisted.state.invoiceId,
      issueDate: null,
      registeredAt: null,
      supplier: persisted.state.supplier,
      empenhoId: persisted.state.empenhoId,
      pregao: null,
      itemId: persisted.state.itemId,
      itemName: persisted.state.description,
      unitLabel: persisted.state.unitLabel,
      materialId: persisted.state.materialId,
      receivedQuantity: persisted.state.receivedQuantity,
      allocatedQuantity: persisted.state.allocatedQuantity,
      immediateConsumptionQuantity:
        persisted.state.immediateConsumptionQuantity,
      pendingQuantity: persisted.state.pendingQuantity,
      status: 'RECONCILIATION_REQUIRED',
      persisted: true,
      source: 'STATE_V2',
      reconciliationReason: 'CANONICAL_SOURCE_MISSING',
      canonicalPresent: false,
    };
  }

  const allocatedQuantity =
    persisted.intake.mode === 'ALLOCATED' ? persisted.intake.quantity : 0;
  const immediateConsumptionQuantity =
    persisted.intake.mode === 'IMMEDIATE_CONSUMPTION'
      ? persisted.intake.quantity
      : 0;

  return {
    key: itemKey(persisted.intake.invoiceRecordKey, persisted.intake.itemId),
    stateId: persisted.intake.id,
    invoiceRecordKey: persisted.intake.invoiceRecordKey,
    invoiceId: persisted.intake.invoiceId,
    issueDate: null,
    registeredAt: null,
    supplier: 'Fornecedor indisponível na fonte canônica',
    empenhoId: persisted.intake.empenhoId,
    pregao: null,
    itemId: persisted.intake.itemId,
    itemName: persisted.intake.description,
    unitLabel: persisted.intake.unitLabel,
    materialId: persisted.intake.materialId,
    receivedQuantity: persisted.intake.quantity,
    allocatedQuantity,
    immediateConsumptionQuantity,
    pendingQuantity: Math.max(
      0,
      calculateWarehouseItemIntakePendingQuantity(
        persisted.intake.quantity,
        allocatedQuantity,
        immediateConsumptionQuantity
      )
    ),
    status: 'RECONCILIATION_REQUIRED',
    persisted: true,
    source: 'LEGACY_INTAKE_V1',
    reconciliationReason: 'CANONICAL_SOURCE_MISSING',
    canonicalPresent: false,
  };
}

function persistedKey(record: PersistedIntake): string {
  return record.kind === 'V2'
    ? itemKey(record.state.invoiceRecordKey, record.state.itemId)
    : itemKey(record.intake.invoiceRecordKey, record.intake.itemId);
}

function persistedStateId(record: PersistedIntake): string {
  return record.kind === 'V2' ? record.state.id : record.intake.id;
}

function materialFrom(
  invoiceMaterialId: string | undefined,
  empenhoMaterialId: string | undefined,
  persisted: PersistedIntake | undefined
): string | null {
  const persistedMaterialId = persisted?.kind === 'V2'
    ? persisted.state.materialId
    : persisted?.kind === 'V1'
      ? persisted.intake.materialId
      : null;

  return (
    normalizeWarehouseMaterialId(empenhoMaterialId)
    || normalizeWarehouseMaterialId(invoiceMaterialId)
    || normalizeWarehouseMaterialId(persistedMaterialId)
    || null
  );
}

function quantitiesFromPersisted(
  receivedQuantity: number,
  persisted: PersistedIntake | undefined
): {
  allocatedQuantity: number;
  immediateConsumptionQuantity: number;
  pendingQuantity: number;
  storedReceivedQuantity: number | null;
} {
  if (!persisted) {
    return {
      allocatedQuantity: 0,
      immediateConsumptionQuantity: 0,
      pendingQuantity: receivedQuantity,
      storedReceivedQuantity: null,
    };
  }

  if (persisted.kind === 'V2') {
    const allocatedQuantity = persisted.state.allocatedQuantity;
    const immediateConsumptionQuantity = persisted.state.immediateConsumptionQuantity;
    return {
      allocatedQuantity,
      immediateConsumptionQuantity,
      pendingQuantity: Math.max(
        0,
        calculateWarehouseItemIntakePendingQuantity(
          receivedQuantity,
          allocatedQuantity,
          immediateConsumptionQuantity
        )
      ),
      storedReceivedQuantity: persisted.state.receivedQuantity,
    };
  }

  const allocatedQuantity =
    persisted.intake.mode === 'ALLOCATED' ? persisted.intake.quantity : 0;
  const immediateConsumptionQuantity =
    persisted.intake.mode === 'IMMEDIATE_CONSUMPTION'
      ? persisted.intake.quantity
      : 0;

  return {
    allocatedQuantity,
    immediateConsumptionQuantity,
    pendingQuantity: Math.max(
      0,
      calculateWarehouseItemIntakePendingQuantity(
        receivedQuantity,
        allocatedQuantity,
        immediateConsumptionQuantity
      )
    ),
    storedReceivedQuantity: persisted.intake.quantity,
  };
}



function qexId(ws:string,key:string):string {
  return 'qex_' + createHash('sha256')
    .update([ws.trim().toLowerCase(),'INTAKE_QUEUE_EXCLUSION',key.trim()].join('\n'))
    .digest('hex');
}
function isActiveIntake(raw:Record<string,unknown>|undefined):boolean {
  if(!raw)return true;
  if(raw.schemaVersion===WAREHOUSE_ITEM_INTAKE_SCHEMA_VERSION)return false;
  if(raw.schemaVersion!==WAREHOUSE_ITEM_INTAKE_STATE_SCHEMA_VERSION)return true;
  if(raw.status==='PROCESSED')return false;
  return typeof raw.pendingQuantity!=='number' || raw.pendingQuantity>0.000001;
}
function parseIndexCandidate(access:VerifiedWarehouseRequest,doc:QueueDocument) {
  const data=doc.data;
  if(data.schemaVersion!==WAREHOUSE_INTAKE_QUEUE_CANDIDATE_SCHEMA_VERSION
    || data.workspaceId!==access.workspaceId || data.ug!==access.ug
    || data.active!==true || typeof data.invoiceRecordKey!=='string'
    || typeof data.itemId!=='string' || typeof data.invoiceId!=='string'
    || typeof data.empenhoId!=='string') {
    throw new WarehouseStoreError('WAREHOUSE_READ_INVALID_CANDIDATE',409);
  }
  return {
    id:doc.id,invoiceRecordKey:data.invoiceRecordKey,
    invoiceId:data.invoiceId,itemId:data.itemId,empenhoId:data.empenhoId,
  };
}
function parseInvoice(row:QueueDocument):Invoice {
  return {...row.data,recordKey:row.data.recordKey || row.id} as Invoice;
}
function parseEmpenho(row:QueueDocument):Empenho {
  return {...row.data,id:row.data.id || row.id} as Empenho;
}
function checkCoverage(result:{truncated:boolean},code:string):void {
  if(result.truncated)throw new WarehouseStoreError(code,409);
}
async function loadPersisted(token:string,access:VerifiedWarehouseRequest,ids:string[]) {
  const records=await queueReadIds(token,'warehouse',access.workspaceId,'intakes',ids);
  const parsed=new Map<string,PersistedIntake>();
  for(const [id,doc] of records) {
    const item=parsePersistedIntake(access.workspaceId,id,doc.data);
    if(item)parsed.set(id,item);
  }
  return parsed;
}
async function excludedKeys(token:string,access:VerifiedWarehouseRequest,keys:string[]):Promise<Set<string>> {
  const ws=access.workspaceId;
  const ids=[...new Set(keys.filter(Boolean))].map(key=>({key,id:qexId(ws,key)}));
  const records=await queueReadIds(token,'warehouse',ws,'queueExclusions',ids.map(entry=>entry.id));
  const excluded=new Set<string>();
  for(const entry of ids) {
    const raw=records.get(entry.id)?.data;
    if(raw?.schemaVersion===WAREHOUSE_INTAKE_QUEUE_EXCLUSION_SCHEMA_VERSION
      && raw.workspaceId===ws && raw.ug===access.ug && raw.invoiceRecordKey===entry.key) {
      excluded.add(entry.key);
    }
  }
  return excluded;
}
interface Discovery {
  invoices:number;intakes:number;written:number;bootstrap:boolean;
}
async function synchronizeIndex(token:string,access:VerifiedWarehouseRequest,
  cutoffAt:string|null):Promise<Discovery> {
  const ws=access.workspaceId;
  const stateDoc=await queueReadDocument(token,'warehouse',ws,'intakeQueueIndex','state');
  const state=stateDoc?.data;
  const valid=Boolean(state && state.schemaVersion===WAREHOUSE_INTAKE_QUEUE_INDEX_SCHEMA_VERSION &&
    state.workspaceId===ws && state.ug===access.ug && state.bootstrapComplete===true);
  const bootstrap=!valid || (state?.cutoffAt || null)!==cutoffAt;
  const watermark=bootstrap?null:typeof state?.watermarkRegisteredAt==='string'
    ? state.watermarkRegisteredAt:null;
  // Existing PERF-D index is authoritative between updates. Bootstrap can
  // scan historical NFs once; steady state scans the bounded incremental window.
  const invoicesResult=await queueReadUpTo(token,'core',ws,'invoices',12000,
    cutoffAt && bootstrap ? {field:'registeredAt',op:'GREATER_THAN_OR_EQUAL',value:cutoffAt} :
    watermark ? {field:'registeredAt',op:'GREATER_THAN_OR_EQUAL',value:watermark} : undefined);
  checkCoverage(invoicesResult,'WAREHOUSE_READ_DISCOVERY_SATURATED');
  let written=0,intakes=0,maxRegisteredAt:string|null=null;
  for(let i=0;i<invoicesResult.docs.length;i+=100) {
    const invoices=invoicesResult.docs.slice(i,i+100).map(parseInvoice)
      .filter(invoice=>!cutoffAt || (Number.isFinite(Date.parse(invoice.registeredAt || ''))
        && Date.parse(invoice.registeredAt || '')>=Date.parse(cutoffAt)));
    const prepared=(await Promise.all(invoices.flatMap(invoice=>invoice.items.map(async item=>({
      invoice,item,
      id:await createWarehouseItemIntakeId(ws,recordKey(invoice),item.itemId),
    }))))).flat();
    const [stateDocs,exclusions]=await Promise.all([
      queueReadIds(token,'warehouse',ws,'intakes',prepared.map(entry=>entry.id)),
      excludedKeys(token,access,invoices.map(recordKey)),
    ]);
    intakes+=stateDocs.size;
    const candidates=prepared.filter(entry=>
      !exclusions.has(recordKey(entry.invoice))
      && isActiveIntake(stateDocs.get(entry.id)?.data)
    ).map(entry=>({
      id:entry.id,invoiceRecordKey:recordKey(entry.invoice),
      invoiceId:entry.invoice.id,empenhoId:entry.invoice.empenhoId,
      itemId:entry.item.itemId,registeredAt:timestampToIso(entry.invoice.registeredAt),
    }));
    for(let j=0;j<candidates.length;j+=40) {
      written+=Number(await warehouseQueueIndexServer(access,'UPSERT',candidates.slice(j,j+40)));
    }
  }
  for(const doc of invoicesResult.docs) {
    const date=timestampToIso(doc.data.registeredAt);
    if(date && (!maxRegisteredAt || date>maxRegisteredAt))maxRegisteredAt=date;
  }
  if(bootstrap || invoicesResult.docs.length>0) {
    const newStamp=maxRegisteredAt || watermark || cutoffAt || new Date().toISOString();
    const rewind=new Date(Date.parse(newStamp)-5*60_000).toISOString();
    await warehouseQueueIndexServer(access,'STATE',{cutoffAt,watermarkRegisteredAt:rewind});
  }
  return {invoices:invoicesResult.docs.length,intakes,written,bootstrap};
}
async function legacyMovementEvidence(
  token:string,access:VerifiedWarehouseRequest,keys:string[]
):Promise<{byKey:Map<string,Array<{id:string;itemIds:string[]}>>;limited:Set<string>}> {
  const unique=[...new Set(keys.filter(Boolean))];
  const byKey=new Map<string,Array<{id:string;itemIds:string[]}>>();
  const limited=new Set<string>();
  // Up to eight concurrent queries. Never scan unrelated ledger entries.
  for(let i=0;i<unique.length;i+=8) {
    await Promise.all(unique.slice(i,i+8).map(async key=>{
      const result=await queueReadUpTo(token,'warehouse',access.workspaceId,'movements',51,{
        field:'source.invoiceRecordKey',op:'EQUAL',value:key,
      });
      if(result.docs.length>=51 || result.truncated)limited.add(key);
      const filtered=result.docs.filter(doc=>{
        const source=doc.data.source as Record<string,unknown>|undefined;
        return source?.kind==='INVOICE' && source?.invoiceRecordKey===key
          && Array.isArray(source.itemIds);
      }).map(doc=>({
        id:doc.id,itemIds:(doc.data.source as {itemIds:string[]}).itemIds
          .filter(value=>typeof value==='string'),
      }));
      byKey.set(key,filtered);
    }));
  }
  return {byKey,limited};
}
export async function readWarehouseInvoiceQueueServer(
  access:VerifiedWarehouseRequest
):Promise<WarehouseInvoiceIntakeQueueContext> {
  const ws=access.workspaceId;
  const token=process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR==='1'
    ? 'emulator':await getGoogleAccessToken();
  const started=Date.now();
  const settings=await queueReadDocument(token,'warehouse',ws,'settings' as
    'intakeQueueIndex','invoice-integration');
  const cutoffAt=typeof settings?.data.cutoffAt==='string' &&
    Number.isFinite(Date.parse(settings.data.cutoffAt)) ? settings.data.cutoffAt : null;
  const discovery=await synchronizeIndex(token,access,cutoffAt);
  const indexResult=await queueReadUpTo(token,'warehouse',ws,'intakeQueueIndex',5000,{
    field:'active',op:'EQUAL',value:true,
  });
  checkCoverage(indexResult,'WAREHOUSE_READ_INDEX_SATURATED');
  const candidates=indexResult.docs.map(doc=>parseIndexCandidate(access,doc));
  const invoiceKeys=[...new Set(candidates.map(item=>item.invoiceRecordKey))];
  const [canonical,persisted,excluded] = await Promise.all([
    queueReadIds(token,'core',ws,'invoices',invoiceKeys),
    loadPersisted(token,access,candidates.map(item=>item.id)),
    excludedKeys(token,access,invoiceKeys),
  ]);
  const invoices=[...canonical.values()].map(parseInvoice);
  const eligibleInvoices=invoices.filter(invoice=>!cutoffAt ||
    (Number.isFinite(Date.parse(invoice.registeredAt || '')) &&
      Date.parse(invoice.registeredAt || '')>=Date.parse(cutoffAt)));
  const eligibleKeys=new Set(eligibleInvoices.map(recordKey));
  const virtualKeys=candidates.filter(c=>!persisted.has(c.id)&&eligibleKeys.has(c.invoiceRecordKey)
    && !excluded.has(c.invoiceRecordKey)).map(c=>c.invoiceRecordKey);
  const [movementEvidence,empenhoDocs]=await Promise.all([
    legacyMovementEvidence(token,access,virtualKeys),
    queueReadIds(token,'core',ws,'empenhos',eligibleInvoices.map(invoice=>invoice.empenhoId)),
  ]);
  const empenhoById=new Map([...empenhoDocs.values()].map(parseEmpenho).map(item=>[item.id,item]));
  const invoiceByKey=new Map(invoices.map(invoice=>[recordKey(invoice),invoice]));
  const rows:WarehouseInvoiceIntakeQueueRow[]=[];
  const deactivate:string[]=[];
  for(const c of candidates) {
    if(excluded.has(c.invoiceRecordKey)||!eligibleKeys.has(c.invoiceRecordKey)) {
      deactivate.push(c.id);continue;
    }
    const state=persisted.get(c.id);
    const invoice=invoiceByKey.get(c.invoiceRecordKey);
    if(!invoice) {
      if(state)rows.push(orphanRowFromPersisted(state));
      else deactivate.push(c.id);
      continue;
    }
    const item=invoice.items.find(value=>value.itemId===c.itemId);
    if(!item) {
      if(state)rows.push(orphanRowFromPersisted(state));
      else deactivate.push(c.id);
      continue;
    }
    const empenho=empenhoById.get(invoice.empenhoId) || null;
    const empenhoItem=empenho?.items.find(value=>value.id===item.itemId)||null;
    const quantities=quantitiesFromPersisted(item.quantity,state);
    const changed=quantities.storedReceivedQuantity!==null &&
      Math.abs(quantities.storedReceivedQuantity-item.quantity)>0.000001;
    const expected=state?null:await createWarehouseMovementId(ws,
      ['adm-intake-v2',c.id,'invoice-entry'].join(':').slice(0,240));
    const projections=movementEvidence.byKey.get(c.invoiceRecordKey)||[];
    const legacy=!state && (movementEvidence.limited.has(c.invoiceRecordKey)
      || projections.some(move=>move.id!==expected&&move.itemIds.includes(c.itemId)));
    const reason=changed?'CANONICAL_QUANTITY_CHANGED'
      :legacy?'LEGACY_INVOICE_PROJECTION':null;
    const status=deriveWarehouseItemIntakeStatus(item.quantity,
      quantities.allocatedQuantity,quantities.immediateConsumptionQuantity);
    if(status==='PROCESSED'&&!reason) {
      deactivate.push(c.id);continue;
    }
    rows.push({
      key:itemKey(c.invoiceRecordKey,c.itemId),stateId:c.id,
      invoiceRecordKey:c.invoiceRecordKey,invoiceId:invoice.id,
      issueDate:invoice.issueDate || null,registeredAt:invoice.registeredAt || null,
      supplier:invoice.supplier||empenho?.supplier||'Fornecedor não informado',
      empenhoId:invoice.empenhoId,pregao:empenho?.pregao||null,
      itemId:c.itemId,itemName:empenhoItem?.name ||
        (state?.kind==='V2'?state.state.description
          :state?.kind==='V1'?state.intake.description:'Item '+c.itemId),
      unitLabel:empenhoItem?.unit ||
        (state?.kind==='V2'?state.state.unitLabel
          :state?.kind==='V1'?state.intake.unitLabel:''),
      materialId:materialFrom(item.warehouseMaterialId,empenhoItem?.warehouseMaterialId,state),
      receivedQuantity:item.quantity,allocatedQuantity:quantities.allocatedQuantity,
      immediateConsumptionQuantity:quantities.immediateConsumptionQuantity,
      pendingQuantity:quantities.pendingQuantity,
      status:reason?'RECONCILIATION_REQUIRED':status,persisted:Boolean(state),
      source:state?.kind==='V2'?'STATE_V2':state?.kind==='V1'?'LEGACY_INTAKE_V1'
        :legacy?'LEGACY_INVOICE_PROJECTION':'VIRTUAL_PENDING',
      reconciliationReason:reason,canonicalPresent:true,
    });
  }
  for(let i=0;i<deactivate.length;i+=100)
    await warehouseQueueIndexServer(access,'DEACTIVATE',deactivate.slice(i,i+100));
  rows.sort((a,b)=>(b.registeredAt||b.issueDate||'').localeCompare(a.registeredAt||a.issueDate||''));
  const limited=movementEvidence.limited.size>0;
  // Do not disclose document data or bearer token in telemetry.
  console.info('[warehouse-read-r1]',JSON.stringify({
    durationMs:Date.now()-started,discovered:discovery.invoices,
    intakeReads:discovery.intakes,indexWrites:discovery.written,
    candidates:candidates.length,results:rows.length,bootstrap:discovery.bootstrap,
  }));
  return {rows,cutoffAt,truncated:limited,
    reconciliationCoverageLimited:limited,pregaoCoverageLimited:false};
}
