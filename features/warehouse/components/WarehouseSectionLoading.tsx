export function WarehouseSectionLoading() {
  return (
    <section
      role="status"
      aria-live="polite"
      data-testid="warehouse-tab-loading"
      className="rounded-2xl border border-slate-200 bg-white/90 px-6 py-8 shadow-sm"
    >
      <div className="flex items-center gap-3 text-sm font-bold text-[#00288e]">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#00288e]" aria-hidden="true" />
        Abrindo seção...
      </div>
      <p className="mt-2 text-xs text-slate-500">Preparando apenas a área selecionada.</p>
    </section>
  );
}
