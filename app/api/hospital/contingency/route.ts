import {NextRequest,NextResponse} from 'next/server';
import {getHospitalW10Store} from '@/lib/server/hospital/firebase/qa-store.mjs';
import {createHospitalContingencyHandler} from '@/lib/server/hospital/contingency/firestore-handler.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'};
function response(status:number,body:unknown){return NextResponse.json(body,{status,headers});}
export async function POST(req:NextRequest) {
 try {
  if(process.env.HOSPITAL_FIRESTORE_QA_ENABLED!=='1')return response(503,{
   ok:false,error:{code:'UNAVAILABLE',message:'Contingência QA indisponível'}
  });
  const raw=await req.text();
  if(raw.length>10000)return response(413,{ok:false,error:{code:'INVALID',message:'Requisição excede limite'}});
  let input:unknown;
  try{input=JSON.parse(raw);}catch{return response(400,{ok:false,error:{code:'INVALID',message:'JSON inválido'}});}
  if(!input||typeof input!=='object'||Array.isArray(input))return response(400,{ok:false,error:{code:'INVALID',message:'Corpo inválido'}});
  const {operation,payload}=input as {operation?:unknown,payload?:unknown};
  if(!payload||typeof payload!=='object'||Array.isArray(payload))
   return response(400,{ok:false,error:{code:'INVALID',message:'Dados inválidos'}});
  const handler=createHospitalContingencyHandler({store:getHospitalW10Store()});
  const result=await handler({authorization:req.headers.get('authorization')??'',
   organizationId:req.headers.get('x-hospital-organization-id')??'',
   operation:typeof operation==='string'?operation:'',
   payload});
  return response(result.status,result.body);
 }catch{
  return response(503,{ok:false,error:{code:'UNAVAILABLE',message:'Serviço hospitalar indisponível'}});
 }
}
