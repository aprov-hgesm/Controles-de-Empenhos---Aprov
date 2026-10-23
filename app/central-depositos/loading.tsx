export default function WarehouseRouteLoading() {
  return (
    <section
      role="status"
      aria-live="polite"
      data-testid="warehouse-route-loading"
      className="mx-auto w-full max-w-7xl px-4 py-8"
    >
      <div className="rounded-2xl border border-slate-200 bg-white/95 px-6 py-8 shadow-sm">
        <span className="inline-flex items-center gap-3 text-sm font-bold text-[#00288e]">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#00288e]" aria-hidden="true" />
          Abrindo seção da Central de Depósitos...
        </span>
        <p className="mt-2 text-xs text-slate-500">
          A navegação continuará automaticamente quando a seção estiver pronta.
        </p>
      </div>
    </section>
  );
}
