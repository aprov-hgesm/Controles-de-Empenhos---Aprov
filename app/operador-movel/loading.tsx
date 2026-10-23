export default function WarehouseMobileRouteLoading() {
  return (
    <section
      role="status"
      aria-live="polite"
      data-testid="warehouse-mobile-route-loading"
      className="mx-auto w-full max-w-xl px-4 py-8"
    >
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-7 shadow-sm">
        <span className="inline-flex items-center gap-3 text-sm font-bold text-[#00288e]">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#00288e]" aria-hidden="true" />
          Abrindo operação...
        </span>
        <p className="mt-2 text-xs text-slate-500">
          O EMPROVEX está preparando a tela selecionada.
        </p>
      </div>
    </section>
  );
}
