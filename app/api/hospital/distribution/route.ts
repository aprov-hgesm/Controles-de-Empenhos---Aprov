import {NextResponse} from 'next/server';
import {HospitalQAStore} from '@/lib/server/hospital/core/qa-store.mjs';
import {createDistributionHandler} from '@/lib/server/hospital/distribution/handler.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';

let qaHandler: ReturnType<typeof createDistributionHandler> | undefined;
function handler(){
  // Explicit QA-only switch. Never open an operational or clinical production database.
  if(process.env.NODE_ENV==='production'||process.env.HOSPITAL_QA_DISTRIBUTION_ENABLED!=='1'||!process.env.HOSPITAL_QA_DB_PATH)
    return null;
  if(!qaHandler){
    const store=new HospitalQAStore({filename:process.env.HOSPITAL_QA_DB_PATH,qa:true});
    qaHandler=createDistributionHandler({store});
  }
  return qaHandler;
}

export async function POST(request:Request){
  const h=handler();
  if(!h)return NextResponse.json({ok:false,error:{code:'UNAVAILABLE',message:'Distribuição indisponível fora de QA autorizado'}},{status:503,headers:{'cache-control':'no-store'}});
  const origin=request.headers.get('origin');
  if(origin){
    let isSameOrigin=false;
    try{isSameOrigin=new URL(origin).origin===new URL(request.url).origin}catch{}
    if(!isSameOrigin)return NextResponse.json({ok:false,error:{code:'FORBIDDEN',message:'Origem não autorizada'}},{status:403});
  }
  let parsed:{operation?:string;payload?:Record<string,unknown>};
  try{
    const source=await request.text();
    if(source.length>65536)throw Error('Payload excede o limite');
    parsed=JSON.parse(source);
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Payload inválido');
  }catch{
    return NextResponse.json({ok:false,error:{code:'INVALID',message:'JSON inválido ou excessivo'}},{status:400,headers:{'cache-control':'no-store'}});
  }
  const result=await h({
    authorization:request.headers.get('authorization')||'',
    organizationId:request.headers.get('x-hospital-organization-id')||'',
    operation:parsed.operation||'',
    payload:parsed.payload||{}
  });
  if(result.html!==undefined)return new Response(result.html,{status:result.status,headers:result.headers});
  return NextResponse.json(result.body,{status:result.status,headers:result.headers});
}
