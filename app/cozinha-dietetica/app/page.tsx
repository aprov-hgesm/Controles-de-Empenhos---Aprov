import type {Metadata} from 'next';
import {HospitalShell} from '@/features/hospital/integration/HospitalShell';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const revalidate=0;
export const metadata:Metadata={
 title:'Operação hospitalar | EMPROVEX',
 robots:{index:false,follow:false},
};
/** Aplicação clínica permanece FECHADA em produção. Somente QA local explicitamente habilitado. */
export default function HospitalWorkspacePage(){
 const enabled=process.env.NODE_ENV!=='production'
  &&process.env.HOSPITAL_QA_APP_READY==='1'
  &&Boolean(process.env.HOSPITAL_QA_ORGANIZATION_ID)
  &&Boolean(process.env.HOSPITAL_QA_SQLITE_PATH)
  &&Boolean(process.env.NEXT_PUBLIC_HOSPITAL_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_HOSPITAL_FIREBASE_APP_ID);
 if(!enabled)return <main className="min-h-screen bg-slate-950 p-8 text-white"><h1 className="text-2xl font-bold">Cozinha Dietética</h1><p role="alert" className="mt-4">Ambiente hospitalar indisponível. É necessária habilitação institucional e técnica.</p><a className="mt-4 inline-block underline" href="/cozinha-dietetica">Voltar</a></main>;
 return <HospitalShell/>;
}
