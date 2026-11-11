import {NextRequest,NextResponse} from 'next/server';
import {createHospitalW3Handler,getW3QAStore} from '@/lib/server/hospital/maps/handler.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'};
export async function POST(request:NextRequest){
 try{
  const size=Number(request.headers.get('content-length')??0);
  if(!Number.isFinite(size)||size>65536)return NextResponse.json({ok:false,error:{code:'INVALID',message:'Requisição excede o limite permitido'}},{status:413,headers});
  const raw=await request.text();
  if(raw.length>65536)return NextResponse.json({ok:false,error:{code:'INVALID',message:'Requisição excede o limite permitido'}},{status:413,headers});
  let body:unknown;
  try{body=JSON.parse(raw)}catch{return NextResponse.json({ok:false,error:{code:'INVALID',message:'JSON inválido'}},{status:400,headers})}
  if(!body||typeof body!=='object'||Array.isArray(body))return NextResponse.json({ok:false,error:{code:'INVALID',message:'Corpo inválido'}},{status:400,headers});
  const input=body as {operation?:unknown;payload?:unknown};
  const handler=createHospitalW3Handler({store:getW3QAStore()});
  const result=await handler({
    area:'maps',authorization:request.headers.get('authorization')??'',
    organizationId:request.headers.get('x-hospital-organization-id')??'',
    operation:typeof input.operation==='string'?input.operation:'',
    payload:input.payload&&typeof input.payload==='object'&&!Array.isArray(input.payload)?input.payload:{},
  });
  return NextResponse.json(result.body,{status:result.status,headers});
 }catch{
  return NextResponse.json({ok:false,error:{code:'UNAVAILABLE',message:'Serviço hospitalar não habilitado para este ambiente'}},{status:503,headers});
 }
}
