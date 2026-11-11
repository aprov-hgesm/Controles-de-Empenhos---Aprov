import { NextRequest, NextResponse } from 'next/server';
import { HospitalQAStore } from '@/lib/server/hospital/core/qa-store.mjs';
import { createNutritionAuditHandler } from '@/lib/server/hospital/nutrition-audit/handler.mjs';
import { createFirestoreNutritionAuditHandler } from '@/lib/server/hospital/nutrition-audit/firestore-handler.mjs';
import {getHospitalW10Store} from '@/lib/server/hospital/firebase/qa-store.mjs';
import {isHospitalGcpQaRuntime} from '@/lib/server/hospital/firebase/gcp-qa-runtime.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const jsonHeaders={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'};
async function respond(req:NextRequest,method:'GET'|'POST') {
  if((process.env.NODE_ENV==='production'&&!isHospitalGcpQaRuntime())||(process.env.HOSPITAL_FIRESTORE_QA_ENABLED!=='1'&&!process.env.HOSPITAL_QA_SQLITE_PATH)) return NextResponse.json({ok:false,error:{code:'UNAVAILABLE',message:'Rota apenas para QA autorizado'}},{status:503,headers:jsonHeaders});
  let payload:Record<string,unknown>,operation:string,organizationId:string;
  try {
    if(method==='GET') {
      const q=req.nextUrl.searchParams;
      operation=q.get('operation')??'';organizationId=q.get('organizationId')??'';
      payload=Object.fromEntries([...q.entries()].filter(([k])=>!['operation','organizationId'].includes(k)));
    } else {
      const body=await req.json() as {operation?:string;organizationId?:string;payload?:Record<string,unknown>};
      operation=body.operation??'';organizationId=body.organizationId??'';payload=body.payload??{};
    }
  }catch {return NextResponse.json({ok:false,error:{code:'INVALID',message:'Requisição inválida'}},{status:400,headers:jsonHeaders});}
  let db:HospitalQAStore|undefined;
  try {
    const useFirestore=process.env.HOSPITAL_FIRESTORE_QA_ENABLED==='1';
    if(!useFirestore)db=new HospitalQAStore({filename:process.env.HOSPITAL_QA_SQLITE_PATH!,qa:true});
    const handle=useFirestore
      ?createFirestoreNutritionAuditHandler({store:getHospitalW10Store()})
      :createNutritionAuditHandler({store:db!});
    const result=await handle({method,authorization:req.headers.get('authorization')??'',organizationId,operation,payload});
    if(result.status===200 && operation==='report.csv' && result.body.ok && typeof result.body.data==='string') return new NextResponse(result.body.data,{status:200,headers:{...jsonHeaders,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="auditoria-nutricional.csv"'}});
    return NextResponse.json(result.body,{status:result.status,headers:jsonHeaders});
  }catch {return NextResponse.json({ok:false,error:{code:'UNAVAILABLE',message:'Serviço hospitalar QA indisponível'}},{status:503,headers:jsonHeaders});}
  finally {db?.close();}
}
export const GET=(req:NextRequest)=>respond(req,'GET');
export const POST=(req:NextRequest)=>respond(req,'POST');
