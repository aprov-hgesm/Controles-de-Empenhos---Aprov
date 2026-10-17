import { notFound } from 'next/navigation';
import { WarehouseGlobalMaterialSearchLocalPreview } from '../../../features/warehouse/components/WarehouseGlobalMaterialSearchLocalPreview';

export default function WarehouseGlobalSearchLab() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return (
    <main className="mx-auto min-h-screen max-w-7xl space-y-5 bg-slate-50 px-4 py-8">
      <header className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#00288e]">
          EMPROVEX · Meus Depósitos · Laboratório local
        </p>
        <h1 className="mt-2 text-2xl font-black text-slate-900">
          Pesquisa de materiais em todos os depósitos
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Teste um item que existe simultaneamente em dois depósitos,
          escolha a localização e veja a navegação do croqui 3D.
          Os dados são fictícios e nenhuma gravação é realizada.
        </p>
      </header>
      <WarehouseGlobalMaterialSearchLocalPreview />
    </main>
  );
}
