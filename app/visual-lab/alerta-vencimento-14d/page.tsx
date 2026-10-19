import { notFound } from 'next/navigation';
import { WarehouseLocationInspectionLocalPreview } from '../../../features/warehouse/components/WarehouseLocationInspectionLocalPreview';

export default function WarehouseExpiry14DayLab() {
  // Demonstração sem autenticação, Firestore ou escrita, apenas no localhost.
  if (process.env.NODE_ENV !== 'development') notFound();
  return (
    <main className="mx-auto min-h-screen max-w-7xl space-y-5 bg-slate-50 px-4 py-8">
      <header className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#00288e]">
          EMPROVEX · Meus Depósitos · Laboratório local
        </p>
        <h1 className="mt-2 text-2xl font-black text-slate-900">
          Alerta discreto de validade em até 14 dias
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          A estante possui um lote fictício vencendo em 7 dias; a geladeira,
          um lote vencendo em 14 dias. Ambos recebem realce amarelo suave.
          Clique nos locais para consultar itens, lotes e relatório PDF.
          O palete não tem validade próxima e permanece sem esse destaque.
        </p>
      </header>
      <WarehouseLocationInspectionLocalPreview showExpiryWarnings />
    </main>
  );
}
