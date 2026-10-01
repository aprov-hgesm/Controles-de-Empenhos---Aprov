'use client';

export function OperationalSurfaceLoading() {
  return (
    <section
      data-testid="operational-section-loading"
      className="flex min-h-[320px] items-center justify-center rounded-2xl border border-blue-100 bg-white/75 p-8 text-center shadow-sm backdrop-blur"
    >
      <div>
        <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-blue-100 border-t-[#00288e]" />
        <p className="mt-4 text-sm font-extrabold text-[#00288e]">
          Sincronizando dados desta seção
        </p>
        <p className="mt-1 text-xs font-medium text-gray-500">
          O EMPROVEX mantém em tempo real somente as coleções necessárias à tela atual.
        </p>
      </div>
    </section>
  );
}
