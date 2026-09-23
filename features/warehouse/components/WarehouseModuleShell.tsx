import type { LucideIcon } from 'lucide-react';
import { ArrowLeftRight, Boxes, ClipboardCheck, LayoutDashboard, Map, MapPin, PackageSearch, Settings2, SlidersHorizontal, Truck } from 'lucide-react';
import Link from 'next/link';

import { getWarehouseSection, WAREHOUSE_SECTIONS, type WarehouseSectionId } from '../navigation';
import { WarehouseSectionContent } from './WarehouseSectionContent';

const SECTION_ICONS: Record<WarehouseSectionId, LucideIcon> = {
  overview: LayoutDashboard,
  stock: PackageSearch,
  movements: ArrowLeftRight,
  locations: MapPin,
  warehouseView: Map,
  inventory: ClipboardCheck,
  siscofis: SlidersHorizontal,
  deliveries: Truck,
  settings: Settings2,
};

export function WarehouseModuleShell({ section, workspaceId }: { section: WarehouseSectionId; workspaceId: string }) {
  const activeSection = getWarehouseSection(section);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#020817] px-4 py-5 text-slate-100 sm:px-6 sm:py-7 lg:px-8" data-testid="warehouse-module-shell" data-warehouse-section={section}>
      <div className="mx-auto max-w-[1480px]">
        <header className="rounded-3xl border border-blue-300/10 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_34%),rgba(255,255,255,0.028)] p-5 shadow-2xl shadow-blue-950/25 backdrop-blur-xl sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-blue-300/15 bg-blue-400/[0.08]">
                <Boxes className="h-6 w-6 text-blue-200" aria-hidden="true" />
              </div>
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-blue-300/65">EMPROVEX // FASE 7</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-white">ADM Depósito</h1>
                <p className="mt-1 text-xs leading-5 text-slate-500">Estoque operável · lotes · validade · localização · FEFO</p>
              </div>
            </div>
            <Link href="/" className="inline-flex w-fit items-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/[0.08]">
              Voltar ao EMPROVEX
            </Link>
          </div>
        </header>

        <div className="mt-5 grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-5 lg:self-start">
            <nav aria-label="Navegação do ADM Depósito" className="grid grid-cols-2 gap-2 rounded-3xl border border-white/[0.07] bg-white/[0.022] p-2 sm:grid-cols-3 lg:grid-cols-1">
              {WAREHOUSE_SECTIONS.map((item) => {
                const Icon = SECTION_ICONS[item.id];
                const active = item.id === section;
                const itemClassName = active
                  ? 'group flex min-w-0 items-center gap-3 rounded-2xl border border-blue-300/20 bg-blue-400/[0.09] px-3 py-3 text-left text-blue-100 transition sm:px-4'
                  : 'group flex min-w-0 items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-left text-slate-400 transition hover:border-white/[0.07] hover:bg-white/[0.035] hover:text-slate-200 sm:px-4';

                return (
                  <Link key={item.id} href={item.href} data-testid={'warehouse-nav-' + item.id} aria-current={active ? 'page' : undefined} className={itemClassName}>
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 text-xs font-bold leading-4">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>

          <section className="min-w-0 rounded-3xl border border-white/[0.07] bg-white/[0.022] p-5 sm:p-7 lg:p-8" data-testid="warehouse-surface">
            <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{activeSection.eyebrow}</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">{activeSection.label}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{activeSection.description}</p>
              </div>
              {activeSection.futurePhase && (
                <span className="inline-flex w-fit shrink-0 rounded-full border border-amber-300/15 bg-amber-400/[0.06] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-amber-200/80">
                  aprofundamento · {activeSection.futurePhase}
                </span>
              )}
            </div>
            <WarehouseSectionContent section={section} workspaceId={workspaceId} />
          </section>
        </div>

        <footer className="px-2 pb-2 pt-5 text-center text-[11px] leading-5 text-slate-600">
          FASE 7 preserva o piloto founder-only, o ledger, o Marco Zero SISCOFIS, a integração NF → estoque e a distribuição física. FEFO recomenda; nenhuma saída é executada automaticamente.
        </footer>
      </div>
    </main>
  );
}
