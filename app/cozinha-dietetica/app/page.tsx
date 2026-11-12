import type {Metadata} from 'next';
import {HospitalShell} from '@/features/hospital/integration/HospitalShell';
import {isHospitalQaUiReady} from '@/lib/server/hospital/firebase/qa-ui-gate.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const revalidate=0;
export const metadata:Metadata={
 title:'Operação hospitalar | EMPROVEX',
 robots:{index:false,follow:false},
};
/** Private hospital QA remains closed unless GCP identity + explicit QA flags match. */
export default function HospitalWorkspacePage(){
 const enabled=isHospitalQaUiReady(process.env,{workspace:true});
 if(!enabled)return <main className="min-h-screen bg-slate-950 p-8 text-white"><h1 className="text-2xl font-bold">Cozinha Dietética</h1><p role="alert" className="mt-4">Ambiente hospitalar indisponível. É necessária habilitação institucional e técnica.</p><a className="mt-4 inline-block underline" href="/cozinha-dietetica">Voltar</a></main>;
 return <HospitalShell/>;
}
