import {NextRequest, NextResponse} from 'next/server';
import {HospitalQAStore} from '@/lib/server/hospital/core/qa-store.mjs';
import {createHospitalPatientsHandler} from '@/lib/server/hospital/patients/handler.mjs';
import {createHospitalFirestorePatientsHandler} from '@/lib/server/hospital/patients/firestore-handler.mjs';
import {getHospitalW10Store} from '@/lib/server/hospital/firebase/qa-store.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';

// Hard fail-closed unless an explicitly configured QA environment is used.
let qaStore: HospitalQAStore | null=null;
function store() {
  if(process.env.NODE_ENV==='production' || process.env.HOSPITAL_PATIENTS_QA_ENABLED!=='1' || !process.env.HOSPITAL_PATIENTS_QA_DB_PATH) return null;
  if(!qaStore) qaStore=new HospitalQAStore({filename:process.env.HOSPITAL_PATIENTS_QA_DB_PATH,qa:true});
  return qaStore;
}
function reply(status:number,body:unknown) {
  return NextResponse.json(body,{status,headers:{'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
}
async function dispatch(req:NextRequest,operation:string,payload:Record<string,unknown>) {
  try {
    const useFirestore=process.env.HOSPITAL_FIRESTORE_QA_ENABLED==='1';
    const database=useFirestore?getHospitalW10Store():store();
    if(!database) return reply(503,{ok:false,error:{code:'UNAVAILABLE',message:'Pacientes indisponível fora do ambiente QA autorizado'}});
    const handle=useFirestore
      ?createHospitalFirestorePatientsHandler({store:database})
      :createHospitalPatientsHandler({store:database as HospitalQAStore});
    const result=await handle({
      authorization:req.headers.get('authorization')??'',
      organizationId:req.headers.get('x-hospital-organization-id')??'',
      operation,payload
    });
    return reply(result.status,result.body);
  }catch{
    return reply(503,{ok:false,error:{code:'UNAVAILABLE',message:'Serviço hospitalar indisponível'}});
  }
}
export async function POST(req:NextRequest) {
  try {
    const text=await req.text();
    if(text.length>16000) return reply(413,{ok:false,error:{code:'INVALID',message:'Solicitação muito extensa'}});
    const body=JSON.parse(text);
    if(!body || typeof body!=='object' || Array.isArray(body) || typeof body.operation!=='string' || !body.payload || typeof body.payload!=='object' || Array.isArray(body.payload))
      return reply(400,{ok:false,error:{code:'INVALID',message:'Comando inválido'}});
    return dispatch(req,body.operation,body.payload);
  }catch{
    return reply(400,{ok:false,error:{code:'INVALID',message:'JSON inválido'}});
  }
}
export async function GET(req:NextRequest) {
  const url=req.nextUrl;
  const operation=url.searchParams.get('operation')??'patient.search';
  if(!['patient.search','patient.get','admission.get','admission.history','admission.notices','bed.list'].includes(operation))
    return reply(405,{ok:false,error:{code:'INVALID',message:'Leitura desconhecida'}});
  const payload:Record<string,unknown>={};
  for(const key of ['unitId','q','status','patientId','admissionId']) {
    const value=url.searchParams.get(key); if(value!==null) payload[key]=value;
  }
  for(const key of ['limit','offset']) {
    const value=url.searchParams.get(key);if(value!==null)payload[key]=Number(value);
  }
  return dispatch(req,operation,payload);
}
