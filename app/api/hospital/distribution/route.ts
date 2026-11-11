import {NextResponse} from 'next/server';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const runtime='nodejs';
export const dynamic='force-dynamic';

type DistributionResponse={
  status:number;
  headers:Record<string,string>;
  html?:string;
  body?:unknown;
};
type DistributionHandler=(args:{
  authorization:string;organizationId:string;operation:string;payload:Record<string,unknown>
})=>Promise<DistributionResponse>;
let qaHandler:DistributionHandler|undefined;

/** Source-only QA loader. This route is disabled in prod and does not bundle W0's
 * pending firebase-admin/auth dependency into the EMPROVEX production build.
 * Node resolves the checked-in modules from a fixed local path (never from HTTP).
 */
async function handler():Promise<DistributionHandler|null>{
  if(process.env.NODE_ENV==='production'||process.env.HOSPITAL_QA_DISTRIBUTION_ENABLED!=='1'||!process.env.HOSPITAL_QA_DB_PATH)
    return null;
  if(!qaHandler){
    const root=process.cwd();
    const coreUrl=pathToFileURL(resolve(root,'lib/server/hospital/core/qa-store.mjs')).href;
    const distributionUrl=pathToFileURL(resolve(root,'lib/server/hospital/distribution/handler.mjs')).href;
    // webpackIgnore intentionally leaves these QA-only dependencies for Node.js.
    const [{HospitalQAStore},{createDistributionHandler}]=await Promise.all([
      import(/* webpackIgnore: true */ coreUrl),
      import(/* webpackIgnore: true */ distributionUrl)
    ]);
    const store=new HospitalQAStore({filename:process.env.HOSPITAL_QA_DB_PATH,qa:true});
    qaHandler=createDistributionHandler({store});
  }
  return qaHandler||null;
}

export async function POST(request:Request){
  let h:DistributionHandler|null;
  try{h=await handler()}catch{
    return NextResponse.json({ok:false,error:{code:'UNAVAILABLE',message:'QA hospitalar não configurado'}},{status:503,headers:{'cache-control':'no-store'}});
  }
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
