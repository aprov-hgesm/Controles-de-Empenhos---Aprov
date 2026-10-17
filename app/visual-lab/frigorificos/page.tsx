import { notFound } from 'next/navigation';

import { WarehouseColdStorageLocalPreview } from '../../../features/warehouse/components/WarehouseColdStorageLocalPreview';

export default function ColdStorageLocalPreviewPage() {
  // The laboratory must not become a public, unauthenticated route in production.
  if (process.env.NODE_ENV !== 'development') notFound();

  return (
    <main className="mx-auto min-h-screen max-w-7xl space-y-5 bg-slate-50 px-4 py-8">
      <header className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#00288e]">
          EMPROVEX · Visual 3D · Laboratório local
        </p>
        <h1 className="mt-2 text-2xl font-black text-slate-900">
          Geladeira industrial e freezer horizontal
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Experimente Frente, Direita, Trás e Esquerda na própria cena isométrica
          do EMPROVEX. Esta página funciona apenas em localhost no modo de desenvolvimento,
          sem login, sem Firestore e sem salvar qualquer alteração.
        </p>
      </header>
      <WarehouseColdStorageLocalPreview />
    </main>
  );
}
