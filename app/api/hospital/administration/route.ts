import { NextRequest, NextResponse } from 'next/server';
import { HospitalQAStore } from '@/lib/server/hospital/core/qa-store.mjs';
import { createHospitalAdministrationHandler } from '@/lib/server/hospital/administration/handler.mjs';
import { createHospitalFirestoreAdministrationHandler } from '@/lib/server/hospital/administration/firestore-handler.mjs';
import {getHospitalW10Store} from '@/lib/server/hospital/firebase/qa-store.mjs';
import {hospitalQaUserExists} from '@/lib/server/hospital/firebase/auth-emulator-account.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Explicitly disabled in production until a separate clinical datastore is approved. */
async function dispatch(request: NextRequest, method: 'GET'|'POST') {
  if (process.env.NODE_ENV === 'production' || (process.env.HOSPITAL_FIRESTORE_QA_ENABLED!=='1' && (process.env.HOSPITAL_QA_ADMIN_ENABLED !== '1' || !process.env.HOSPITAL_QA_DB_PATH))) {
    return NextResponse.json({ok:false,error:{code:'UNAVAILABLE',message:'Administração hospitalar indisponível até homologação do storage clínico'}},{status:503});
  }
  let store: HospitalQAStore | undefined;
  try {
    const useFirestore=process.env.HOSPITAL_FIRESTORE_QA_ENABLED==='1';
    if(!useFirestore)store = new HospitalQAStore({ filename: process.env.HOSPITAL_QA_DB_PATH, qa: true });
    const payload = method === 'POST' ? await request.json() : {};
    const operation = method === 'POST' ? payload?.operation : request.nextUrl.searchParams.get('view');
    const handler = useFirestore?createHospitalFirestoreAdministrationHandler({
      store:getHospitalW10Store(),
      userExists:hospitalQaUserExists
    }):createHospitalAdministrationHandler({
      store:store!,
      userExists: async (uid: string) => {
        // Runtime-only QA integration. No Firebase Admin dependency is bundled into production.
        const authModuleName = ['firebase-admin','auth'].join('/');
        const {getAuth} = await import(/* webpackIgnore: true */ authModuleName);
        try { await getAuth().getUser(uid); return true; }
        catch { return false; }
      }
    });
    const result = await handler({
      authorization: request.headers.get('authorization') ?? '',
      organizationId: request.headers.get('x-hospital-organization') ?? '',
      operation: operation ?? '',
      payload: method === 'POST' ? payload?.payload ?? {} : {},
      method,
    });
    return NextResponse.json(result.body,{status:result.status,headers:{'Cache-Control':'no-store'}});
  } catch {
    return NextResponse.json({ok:false,error:{code:'INVALID',message:'Requisição inválida ou serviço QA indisponível'}},{status:400});
  } finally { store?.close(); }
}
export const GET = (request: NextRequest) => dispatch(request,'GET');
export const POST = (request: NextRequest) => dispatch(request,'POST');
