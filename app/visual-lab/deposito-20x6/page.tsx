import { notFound } from 'next/navigation';
import { WarehouseDepot20x6Demo } from '../../../features/warehouse/components/WarehouseDepot20x6Demo';

/**
 * Laboratório estritamente local, sem acesso à área operacional.
 * Em qualquer build/Preview de produção a rota responde 404.
 */
export default function WarehouseDepot20x6DemoPage() {
  if (process.env.NODE_ENV !== 'development') notFound();

  return (
    <main className="min-h-screen bg-[#f1f5f9] px-3 py-6 text-slate-900 sm:px-5">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#00288e]">
            EMPROVEX · Laboratório independente
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
            Depósito simulado · 20 × 6 metros
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Avalie escalas, etiquetas, corredores, estantes, paletes e equipamentos frigorificados
            em uma planta grande. Alterne entre cenário simples e denso e compare o desenho 2D
            com as quatro perspectivas isométricas do renderizador oficial.
          </p>
        </header>
        <WarehouseDepot20x6Demo />
      </div>
    </main>
  );
}
