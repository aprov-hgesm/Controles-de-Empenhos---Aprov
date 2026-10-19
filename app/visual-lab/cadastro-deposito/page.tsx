import { notFound } from 'next/navigation';
import { WarehouseDepotRegistrationPreviewLocal } from '../../../features/warehouse/components/WarehouseDepotRegistrationPreviewLocal';

export default function LocalDepotRegistrationPreviewPage() {
  // Never expose a public, unauthenticated warehouse entry point in production.
  if (process.env.NODE_ENV !== 'development') notFound();

  return <main className="mx-auto min-h-screen max-w-6xl space-y-5 bg-[#f8f9ff] px-4 py-8">
    <header className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#00288e]">
        EMPROVEX / Central de Depósitos / Prévia local
      </p>
      <h1 className="mt-2 text-xl font-black text-slate-900">Novo Cadastramento de Depósito</h1>
      <p className="mt-2 text-sm text-slate-600">
        Página disponível somente em desenvolvimento. Utilize os campos para avaliar o
        formulário e as dimensões variáveis sem utilizar uma conta real.
        Nenhum botão desta prévia escreve no Firestore.
      </p>
    </header>
    <WarehouseDepotRegistrationPreviewLocal/>
  </main>;
}
