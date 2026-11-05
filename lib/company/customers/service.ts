import { createHash, randomUUID } from 'node:crypto';
import type { CompanyAuthorizedContext } from '../../server/companyAuthz';
import { W1Store } from './store';
import {
  W1Error, allocate, asDecimal, ensureOwned, millis, owned, parseCommitment, parseCustomer,
  parseOrder, validId, validIdempotency,
  type Commitment, type CustomerOrder, type PublicCustomer,
} from './model';

export type Domain = 'publicCustomers' | 'commitments' | 'customerOrders';
export type Operation = 'read' | 'create' | 'update';

const hash = (v:unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const conflict = () => { throw new W1Error('CONFLICT', 409); };
const notFound = () => { throw new W1Error('NOT_FOUND', 404); };
const object = (v:unknown): v is Record<string,unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
function expected(v:unknown):number {
  if (!object(v) || typeof v.expectedRevision !== 'number' ||
      !Number.isSafeInteger(v.expectedRevision) || v.expectedRevision < 1) {
    throw new W1Error('INVALID_INPUT', 400);
  }
  return v.expectedRevision;
}
function commandKey(key:unknown) { return validIdempotency(key); }
function bump<T extends object>(v:T):T & {revision:number;updatedAt:string} {
  const revision=(v as {revision?:unknown}).revision;
  if (typeof revision!=='number' || !Number.isSafeInteger(revision)) throw new W1Error('CONFLICT',409);
  return {...v,revision:revision+1,updatedAt:new Date().toISOString()};
}
function limitedHistory(old:unknown, event:Record<string,unknown>) {
  const items=Array.isArray(old) ? old : [];
  return [...items.slice(-49),event];
}

export async function listRecords(ctx:CompanyAuthorizedContext,domain:Domain,limit:number,cursor?:string) {
  return (await W1Store.connect(ctx)).list(domain,limit,cursor);
}
export async function getRecord(ctx:CompanyAuthorizedContext,domain:Domain,id:string) {
  const existing=await (await W1Store.connect(ctx)).get(domain,validId(id));
  if (!existing) return notFound();
  return existing.data;
}
async function save(store:W1Store, action:string, key:string, payload:unknown,
  result:Record<string,unknown>, entityId:string,
  writes:Array<{path:string;data:Record<string,unknown>;updateTime?:string}>) {
  const fingerprint=hash(payload);
  const old=await store.replay(action,key,fingerprint);
  if (old) return old;
  try {
    await store.commit(action,key,fingerprint,result,entityId,writes,randomUUID());
    return result;
  } catch (error) {
    if (error instanceof W1Error && [409,503].includes(error.status)) {
      const replay=await store.replay(action,key,fingerprint);
      if (replay) return replay;
    }
    throw error;
  }
}
export async function createRecord(ctx:CompanyAuthorizedContext,domain:Domain,
  body:unknown,key:unknown):Promise<Record<string,unknown>> {
  const idempotency=commandKey(key), store=await W1Store.connect(ctx);
  if (domain==='publicCustomers') {
    const data=parseCustomer(body);
    const replay=await store.replay('publicCustomers:create',idempotency,hash(data));
    if (replay) return replay;
    const record=owned(ctx.companyId,ctx.uid,data);
    return save(store,'publicCustomers:create',idempotency,data,record,record.id,
      [{path:store.documentPath(domain,record.id),data:record}]);
  }
  if (domain==='commitments') {
    const data=parseCommitment(body);
    const replay=await store.replay('commitments:create',idempotency,hash(data));
    if (replay) return replay;
    const customer=await store.get('publicCustomers',data.publicCustomerId);
    if (!customer || customer.data.status!=='active') return conflict();
    const now=new Date().toISOString();
    const record=owned(ctx.companyId,ctx.uid,{
      ...data, reviewedByUid:ctx.uid,reviewedAt:now,
      lines:data.lines.map(l=>({...l,orderedQuantity:{value:'0',unit:l.quantity.unit}})),
      reviewHistory:[{revision:1,byUid:ctx.uid,at:now,source:data.extractionSource}],
    });
    return save(store,'commitments:create',idempotency,data,record,record.id,
      [{path:store.documentPath(domain,record.id),data:record}]);
  }
  const data=parseOrder(body);
  const replay=await store.replay('customerOrders:create',idempotency,hash(data));
  if (replay) return replay;
  const commitment=await store.get('commitments',data.commitmentId);
  if (!commitment) return notFound();
  const ownedCommitment=commitment.data as unknown as Commitment;
  const assigned=allocate(ownedCommitment,data);
  const record=owned(ctx.companyId,ctx.uid,{
    commitmentId:data.commitmentId,publicCustomerId:data.publicCustomerId,
    reference:data.reference,lines:assigned.orderLines,
    requestedDelivery:data.requestedDelivery,negotiationNote:data.negotiationNote,
    fulfillmentState:'pending',
    negotiationHistory:[{revision:1,byUid:ctx.uid,at:new Date().toISOString(),
      note:data.negotiationNote || '',lines:data.lines}],
  });
  const next=bump({...ownedCommitment,lines:assigned.commitmentLines});
  return save(store,'customerOrders:create',idempotency,data,record,record.id,[
    {path:store.documentPath('customerOrders',record.id),data:record},
    {path:store.documentPath('commitments',next.id),data:next,updateTime:commitment.updateTime},
  ]);
}
export async function updateRecord(ctx:CompanyAuthorizedContext,domain:Domain,
  id:string,body:unknown,key:unknown):Promise<Record<string,unknown>> {
  const idempotency=commandKey(key), docId=validId(id), store=await W1Store.connect(ctx);
  const revision=expected(body);
  if (!object(body)) throw new W1Error('INVALID_INPUT',400);
  const cancelling=domain==='customerOrders' && body.cancel===true;
  const normalized = cancelling ? {cancel:true,revision}
    : {data:domain==='publicCustomers' ? parseCustomer(body)
      : domain==='commitments' ? parseCommitment(body) : parseOrder(body),revision};
  const action=domain+':'+(cancelling?'cancel':'update')+':'+docId;
  const replay=await store.replay(action,idempotency,hash(normalized));
  if (replay) return replay;
  const previous=await store.get(domain,docId);
  if (!previous) return notFound();
  const before=previous.data;
  if (revision!==before.revision || before.status !== 'active') return conflict();

  if (domain==='publicCustomers') {
    const data=parseCustomer(body);
    const updated=bump({...before,...data});
    return save(store,'publicCustomers:update:'+docId,idempotency,{data,revision:before.revision},updated,docId,
      [{path:store.documentPath(domain,docId),data:updated,updateTime:previous.updateTime}]);
  }
  if (domain==='commitments') {
    const data=parseCommitment(body);
    const prior=before as unknown as Commitment;
    if (data.publicCustomerId!==prior.publicCustomerId || data.neNumber!==prior.neNumber
        || data.fiscalYear!==prior.fiscalYear || data.lines.length!==prior.lines.length) return conflict();
    const oldLines=new Map(prior.lines.map(l=>[l.id,l]));
    const lines=data.lines.map(l=>{
      const old=oldLines.get(l.id);
      if (!old || old.quantity.unit!==l.quantity.unit || millis(l.quantity.value)<millis(old.orderedQuantity.value)) {
        return conflict() as never;
      }
      return {...l,orderedQuantity:old.orderedQuantity};
    });
    const at=new Date().toISOString();
    const updated=bump({...before,...data,lines,reviewedByUid:ctx.uid,reviewedAt:at,
      reviewHistory:limitedHistory(before.reviewHistory,{revision:before.revision+1,
        byUid:ctx.uid,at,source:data.extractionSource,previousHash:hash(prior.lines),newHash:hash(lines)})});
    return save(store,'commitments:update:'+docId,idempotency,{data,revision:before.revision},updated,docId,
      [{path:store.documentPath(domain,docId),data:updated,updateTime:previous.updateTime}]);
  }
  const prior=before as unknown as CustomerOrder;
  if (cancelling) {
    if (prior.lines.some(l=>millis(l.fulfilledQuantity.value)>BigInt(0))) return conflict();
    const commitment=await store.get('commitments',prior.commitmentId);
    if (!commitment) return conflict();
    const c=commitment.data as unknown as Commitment;
    const emptyOrder={commitmentId:prior.commitmentId,publicCustomerId:prior.publicCustomerId,
      reference:prior.reference,lines:[],requestedDelivery:prior.requestedDelivery};
    // Deallocate this order without creating an artificial negative commitment.
    const map=new Map(c.lines.map(l=>[l.id,l]));
    const lines=c.lines.map(l=>{
      const release=prior.lines.find(o=>o.commitmentLineId===l.id);
      const remain=millis(l.orderedQuantity.value) - (release ? millis(release.quantity.value) : BigInt(0));
      if (remain<BigInt(0)) return conflict() as never;
      return {...l,orderedQuantity:{value:asDecimal(remain),unit:l.quantity.unit}};
    });
    void emptyOrder; void map;
    const at=new Date().toISOString();
    const updated=bump({...before,status:'cancelled',negotiationHistory:limitedHistory(before.negotiationHistory,
      {revision:before.revision+1,byUid:ctx.uid,at,reason:'cancelled'})});
    const next=bump({...c,lines});
    return save(store,'customerOrders:cancel:'+docId,idempotency,{cancel:true,revision:before.revision},updated,docId,[
      {path:store.documentPath(domain,docId),data:updated,updateTime:previous.updateTime},
      {path:store.documentPath('commitments',c.id),data:next,updateTime:commitment.updateTime},
    ]);
  }
  const data=parseOrder(body);
  if (data.commitmentId!==prior.commitmentId || data.publicCustomerId!==prior.publicCustomerId) return conflict();
  const commitment=await store.get('commitments',prior.commitmentId);
  if (!commitment) return conflict();
  const c=commitment.data as unknown as Commitment;
  const assigned=allocate(c,data,prior.lines);
  for (const line of assigned.orderLines) {
    const old=prior.lines.find(l=>l.id===line.id);
    if (old && millis(old.fulfilledQuantity.value)>millis(line.quantity.value)) return conflict();
    if (old) line.fulfilledQuantity=old.fulfilledQuantity;
  }
  const at=new Date().toISOString();
  const updated=bump({...before,reference:data.reference,lines:assigned.orderLines,
    requestedDelivery:data.requestedDelivery,negotiationNote:data.negotiationNote,
    negotiationHistory:limitedHistory(before.negotiationHistory,{
      revision:before.revision+1,byUid:ctx.uid,at,
      oldHash:hash(prior.lines),newHash:hash(assigned.orderLines),note:data.negotiationNote || '',
    })});
  const next=bump({...c,lines:assigned.commitmentLines});
  return save(store,'customerOrders:update:'+docId,idempotency,{data,revision:before.revision},updated,docId,[
    {path:store.documentPath(domain,docId),data:updated,updateTime:previous.updateTime},
    {path:store.documentPath('commitments',c.id),data:next,updateTime:commitment.updateTime},
  ]);
}
