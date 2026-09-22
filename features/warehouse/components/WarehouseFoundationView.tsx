import { Boxes, PackageCheck, ShieldCheck } from 'lucide-react';

import {
  WAREHOUSE_DOMAIN_COLLECTIONS,
  WAREHOUSE_NAMESPACE_ROOT,
} from '../../../lib/warehouse/namespace';
import {
  WAREHOUSE_MATERIAL_SCHEMA_VERSION,
  WAREHOUSE_MATERIAL_UNIT_CODES,
} from '../../../lib/warehouse/material';

export function WarehouseFoundationView() {
  return (
    <main className="min-h-screen bg-[#020817] px-4 py-10 text-slate-100 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-3xl border border-blue-300/10 bg-white/[0.035] p-6 shadow-2xl shadow-blue-950/30 backdrop-blur-xl sm:p-8">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-blue-300/15 bg-blue-400/[0.08]">
              <Boxes className="h-6 w-6 text-blue-200" aria-hidden="true" />
            </div>
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-blue-300/65">
                EMPROVEX // FASE 1
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
                ADM Depósito
              </h1>
            </div>
          </div>

          <div className="mt-7 flex items-start gap-3 rounded-2xl border border-emerald-300/10 bg-emerald-400/[0.05] p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" />
            <div>
              <p className="text-sm font-extrabold text-emerald-100">
                Piloto fundador protegido
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                O isolamento da FASE 0 permanece ativo. A FASE 1 adiciona somente
                a fundação canônica de materiais, sem movimentações ou saldo de estoque.
              </p>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-6 sm:p-8">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Namespace reservado
            </p>
            <p className="mt-3 text-sm text-slate-300">
              <code className="rounded bg-black/30 px-2 py-1 text-blue-200">
                {WAREHOUSE_NAMESPACE_ROOT}/&#123;workspaceId&#125;/...
              </code>
            </p>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              Domínios reservados: {Object.values(WAREHOUSE_DOMAIN_COLLECTIONS).join(', ')}.
            </p>
          </div>

          <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-6 sm:p-8">
            <div className="flex items-center gap-2">
              <PackageCheck className="h-4 w-4 text-blue-200" aria-hidden="true" />
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                Fundação do material
              </p>
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-200">
              {WAREHOUSE_MATERIAL_SCHEMA_VERSION}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Unidades suportadas: {WAREHOUSE_MATERIAL_UNIT_CODES.join(', ')}.
              Operações de estoque permanecem fora do escopo desta fase.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
