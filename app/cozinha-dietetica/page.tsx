import type { Metadata } from 'next';
import { ChefHat, LockKeyhole, ShieldCheck } from 'lucide-react';
import { HospitalEntry } from '@/features/hospital/entry/HospitalEntry';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Cozinha Dietética | EMPROVEX',
  description: 'Entrada hospitalar com acesso por identidade, vínculo e unidade autorizados.',
  robots: { index: false, follow: false },
};

export default function HospitalEntryPage() {
  // No clinic/production database or institutional approval has been supplied.
  // Even if an environment variable is accidentally set in production, fail closed.
  const qaEnabled = process.env.NODE_ENV !== 'production'
    && Boolean(process.env.HOSPITAL_QA_ORGANIZATION_ID && (
      (process.env.HOSPITAL_FIRESTORE_QA_ENABLED==='1' && process.env.FIRESTORE_EMULATOR_HOST) || process.env.HOSPITAL_QA_SQLITE_PATH
    ))
    && Boolean(process.env.NEXT_PUBLIC_HOSPITAL_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_HOSPITAL_FIREBASE_APP_ID);
  return (
    <main className="min-h-screen bg-[#061324] px-5 py-10 text-white sm:py-16">
      <div className="mx-auto max-w-3xl">
        <a href="/" className="inline-flex rounded-lg px-1 py-2 text-sm text-sky-200 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-200">
          Voltar ao portal
        </a>
        <div className="mt-8 rounded-3xl border border-white/15 bg-white/[0.05] p-6 sm:p-10">
          <ChefHat size={38} aria-hidden="true" className="mb-5 text-sky-300" />
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-300">Ambiente hospitalar</p>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Cozinha Dietética</h1>
          <p className="mt-4 leading-7 text-slate-300">O acesso é individual e depende de autorização no servidor, vínculo à organização hospitalar e unidades permitidas. A Nutrição atua como auditora; a prescrição permanece no fluxo médico institucional.</p>
          {qaEnabled ? (
            <div className="mt-8">
              <HospitalEntry />
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-amber-300/30 bg-amber-200/10 p-5" role="status">
              <div className="flex items-center gap-3 font-bold text-amber-100">
                <LockKeyhole size={21} aria-hidden="true" />
                Acesso hospitalar não habilitado
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-200">A entrada clínica permanece fechada até a integração, o ambiente segregado e a autorização institucional. Nenhum login hospitalar ou prontuário é disponibilizado nesta instalação.</p>
            </div>
          )}
          <div className="mt-8 flex items-center gap-2 text-sm text-slate-400">
            <ShieldCheck size={18} aria-hidden="true" /> Sem acesso clínico para contas administrativas comerciais.
          </div>
        </div>
      </div>
    </main>
  );
}
