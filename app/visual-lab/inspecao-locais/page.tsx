import { notFound } from 'next/navigation';

import { WarehouseLocationInspectionLocalPreview } from '../../../features/warehouse/components/WarehouseLocationInspectionLocalPreview';

export default function WarehouseLocationInspectionLabPage() {
  // Página disponível apenas em desenvolvimento; nenhum dado de usuário é lido.
  if (process.env.NODE_ENV !== 'development') notFound();

  return (
    <main className="mx-auto min-h-screen max-w-7xl space-y-5 bg-slate-50 px-4 py-8">
      <header className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#00288e]">
          EMPROVEX · Central de Depósitos · Laboratório local
        </p>
        <h1 className="mt-2 text-2xl font-black text-slate-900">
          Consultar itens diretamente no depósito 3D
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Visualize o destaque ao passar o cursor, os materiais agrupados por prateleira
          e a janela de detalhes com relatório PDF. Tudo utiliza dados fictícios,
          sem login, sem Firestore e sem alterações de estoque.
        </p>
      </header>
      <WarehouseLocationInspectionLocalPreview />
    </main>
  );
}
