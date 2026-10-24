import { NextResponse } from 'next/server';
import { FounderAuthError } from '../../../../lib/server/firebaseFounderAuth';
import { verifyPlatformPrincipal, PlatformAuthorizationError } from '../../../../lib/server/platformAuthorization';
import { evaluateServerAuthorization } from '../../../../lib/server/authorizationPolicy';
import { listServerSupplierContacts, saveServerSupplierContact, SupplierServerError } from '../../../../lib/server/serverSupplierContacts';

export const runtime='nodejs';
export const dynamic='force-dynamic';

function reply(payload:unknown,status=200){
  return NextResponse.json(payload,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
}
async function principal(request:Request,capability:'core.suppliers.read'|'core.suppliers.write'){
  const actor=await verifyPlatformPrincipal(request.headers.get('authorization'));
  const decision=evaluateServerAuthorization(actor,{capability});
  if(!decision.allowed)throw new SupplierServerError('SUPPLIER_FORBIDDEN',403);
  return actor;
}
function failed(error:unknown){
  if(error instanceof FounderAuthError||error instanceof PlatformAuthorizationError)
    return reply({ok:false,error:'SUPPLIER_UNAUTHORIZED'},error.status);
  if(error instanceof SupplierServerError)return reply({ok:false,error:error.code},error.status);
  console.error('[core/suppliers] unavailable:',error instanceof Error?error.name:'unknown');
  return reply({ok:false,error:'SUPPLIER_SERVER_UNAVAILABLE'},503);
}
export async function GET(request:Request){
  try {
    const actor=await principal(request,'core.suppliers.read');
    return reply({ok:true,items:await listServerSupplierContacts(actor)});
  } catch(error){return failed(error);}
}
export async function POST(request:Request){
  try {
    const actor=await principal(request,'core.suppliers.write');
    const raw=await request.text();
    if(Buffer.byteLength(raw,'utf8')>8192)return reply({ok:false,error:'SUPPLIER_TOO_LARGE'},413);
    let body:unknown;
    try{body=JSON.parse(raw);}catch{return reply({ok:false,error:'SUPPLIER_INVALID_JSON'},400);}
    if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==1||
      !('supplier' in body))return reply({ok:false,error:'SUPPLIER_INVALID_JSON'},400);
    const saved=await saveServerSupplierContact(actor,(body as {supplier:unknown}).supplier);
    return reply({ok:true,item:saved});
  } catch(error){return failed(error);}
}
