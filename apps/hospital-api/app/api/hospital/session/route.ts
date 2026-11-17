import {NextRequest,NextResponse} from 'next/server';
import {getHospitalW10Store} from '@/lib/server/hospital/firebase/qa-store.mjs';
import {resolveHospitalScope} from '@/lib/server/hospital/core/auth.mjs';
import {assertIdentifier,HospitalError} from '@/features/hospital/core/domain.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'};

/** A single hospital code is supplied by the user or the site's configuration.
 * Roles and unit IDs always come from server-verified Firebase membership.
 * There is no qa_* requirement: real authorized hospitals are supported.
 */
export async function POST(req:NextRequest){
 try{
  const authorization=req.headers.get('authorization')??'';
  if(!authorization.startsWith('Bearer ')||authorization.length<=27||/[\s]/.test(authorization.slice(7)))return NextResponse.json({status:401,message:'Autenticação necessária.'},{status:401,headers});
  const raw=await req.text();
  if(raw.length>2048)return NextResponse.json({status:400,message:'Solicitação inválida.'},{status:400,headers});
  let data:unknown;
  try{data=JSON.parse(raw)}catch{return NextResponse.json({status:400,message:'JSON inválido.'},{status:400,headers})}
  if(!data||typeof data!=='object'||Array.isArray(data))return NextResponse.json({status:400,message:'Corpo inválido.'},{status:400,headers});
  const body=data as {organizationId?:unknown};
  if(typeof body.organizationId!=='string')return NextResponse.json({status:400,message:'Organização inválida.'},{status:400,headers});
  const organizationId=body.organizationId;
  assertIdentifier(organizationId,'organizationId');
  if(req.headers.get('x-hospital-organization-id')!==organizationId)
    return NextResponse.json({status:403,message:'Organização divergente.'},{status:403,headers});
  const store=getHospitalW10Store();
  const scope=await resolveHospitalScope({authorization,organizationId,store});
  const roles=scope.roles.filter((role:string)=>['UNIT','KITCHEN','NUTRITION','HOSPITAL_ADMIN'].includes(role));
  return NextResponse.json({status:200,organizationId:scope.organizationId,roles,unitIds:scope.unitIds},{status:200,headers});
 }catch(error){
  const code=error instanceof HospitalError?error.code:'UNAVAILABLE';
  const status=code==='UNAUTHORIZED'?401:code==='FORBIDDEN'?403:code==='INVALID'?400:503;
  const message=status===401?'Sessão inválida ou expirada.':status===403?'Sem vínculo ativo no hospital.':status===400?'Dados inválidos.':'Serviço hospitalar indisponível.';
  return NextResponse.json({status,message},{status,headers});
 }
}
