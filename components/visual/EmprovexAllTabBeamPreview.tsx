'use client';

import { EmprovexBorderBeam } from './EmprovexBorderBeam';

const SURFACES = [
  { id: 'inicio', label: 'Início', slot: 'Barra institucional superior', theme: 'dark', variant: 'travel' },
  { id: 'painel', label: 'Painel', slot: 'Saldo Total Restante', theme: 'dark', variant: 'travel' },
  { id: 'empenhos', label: 'Empenhos', slot: 'Navegação interna', theme: 'light', variant: 'focus' },
  { id: 'fornecedores', label: 'Fornecedores', slot: 'Cabeçalho principal', theme: 'dark', variant: 'travel' },
  { id: 'itens', label: 'Itens', slot: 'Cabeçalho da consulta', theme: 'light', variant: 'travel' },
  { id: 'nova_nf', label: 'Notas Fiscais', slot: 'Abas de acompanhamento', theme: 'light', variant: 'focus' },
  { id: 'relatorios', label: 'Relatórios', slot: 'Navegação interna', theme: 'light', variant: 'focus' },
  { id: 'itens_empenho', label: 'Itens do Empenho', slot: 'Formulário de inclusão', theme: 'light', variant: 'focus' },
  { id: 'cronogramas', label: 'Cronogramas', slot: 'Cabeçalho do planejamento', theme: 'light', variant: 'travel' },
  { id: 'avisos', label: 'Avisos', slot: 'Cabeçalho de monitoramento', theme: 'light', variant: 'focus' },
] as const;

/** Only for the development lab: no data, no navigation or operational actions. */
export function EmprovexAllTabBeamPreview() {
  return (
    <section className="space-y-4" aria-label="Worker 4 — efeitos em todas as dez abas">
      <h2 className="text-xl font-semibold">Worker 4 · Um Border Beam por aba</h2>
      <p className="text-sm text-slate-600">
        Mapa visual das dez superfícies reais do EMPROVEX. Os cartões abaixo são amostras
        sem dados: o efeito foi colocado em apenas um elemento relevante de cada aba.
        Nas amostras de foco, use Tab sobre o botão para ver a iluminação discreta.
        No celular e com movimento reduzido, o percurso animado é desativado.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SURFACES.map(({ id, label, slot, theme, variant }) => (
          <div key={id} data-testid={`w4-all-tabs-${id}`} className="min-w-0 space-y-2">
            <EmprovexBorderBeam
              variant={variant}
              theme={theme}
              intensity="low"
              duration={24}
              borderRadius={16}
              testId={`w4-all-tabs-beam-${id}`}
            >
              <div className={
                'flex min-h-28 flex-col justify-center gap-2 rounded-2xl p-4 ' +
                (theme === 'dark'
                  ? 'bg-[#00288e] text-white'
                  : 'border border-slate-200 bg-white text-slate-900')
              }>
                <span className="text-xs font-black uppercase tracking-wide">{label}</span>
                {variant === 'focus' ? (
                  <button type="button"
                    className="w-fit rounded-lg border border-current/25 px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2">
                    Ver foco
                  </button>
                ) : (
                  <span className="text-xs opacity-75">Percurso suave · 24 segundos</span>
                )}
              </div>
            </EmprovexBorderBeam>
            <p className="px-1 text-xs text-slate-500">{slot}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
