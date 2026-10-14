'use client';

import React from 'react';
import { CalendarDays, CheckCircle2, FileText, Info, Loader2, Mail, RefreshCw, Search } from 'lucide-react';
import type { CronogramaEmpenho, Empenho, Invoice } from '../../../lib/types';
import { loadInvoicesForEmpenho } from '../../../lib/historicalInvoiceQueries';
import { dateOnly, listSentCronogramas, matchInvoicesForRemessaWeek, remessaWeekRange } from '../domain/cronogramaDeliveryTracking';

interface Props {
  cronogramas: CronogramaEmpenho[];
  empenhos: Empenho[];
}
type HistoricalResult = { status: 'loading' | 'ready' | 'error' | 'truncated'; invoices: Invoice[] };
const PAGE_SIZE = 6;

function formatDay(value: string | undefined): string {
  const date = dateOnly(value);
  return date ? date.split('-').reverse().join('/') : 'Data não informada';
}
function formatSentAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Data indisponível'
    : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function CronogramaEnviosView({ cronogramas, empenhos }: Props) {
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(0);
  const [history, setHistory] = React.useState<Record<string, HistoricalResult>>({});
  const cached = React.useRef<Record<string, HistoricalResult>>({});
  const generation = React.useRef(0);
  const mounted = React.useRef(true);
  const [refresh, setRefresh] = React.useState(0);

  React.useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; generation.current += 1; };
  }, []);

  const byEmpenho = React.useMemo(() => new Map(empenhos.map((emp) => [emp.id, emp])), [empenhos]);
  const all = React.useMemo(() => listSentCronogramas(cronogramas), [cronogramas]);
  const filtered = React.useMemo(() => {
    const value = search.trim().toLocaleLowerCase('pt-BR');
    return value
      ? all.filter((row) => [
          row.empenhoId,
          row.envio.fornecedor || byEmpenho.get(row.empenhoId)?.supplier || '',
          row.envio.destinatario,
          row.envio.assunto,
        ].some((field) => field.toLocaleLowerCase('pt-BR').includes(value)))
      : all;
  }, [all, search, byEmpenho]);
  const maxPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const selectedPage = Math.min(page, maxPage - 1);
  const visible = filtered.slice(selectedPage * PAGE_SIZE, (selectedPage + 1) * PAGE_SIZE);
  const ids = Array.from(new Set(visible.filter((row) => row.envio.remessas?.length).map((row) => row.empenhoId)));
  const idsKey = ids.join('|');

  // Somente NFs dos empenhos na página: evita depender do cache operacional incompleto.
  React.useEffect(() => {
    const version = generation.current;
    const missing = ids.filter((id) => !cached.current[id]);
    if (missing.length === 0) return;
    const next = { ...cached.current };
    for (const id of missing) next[id] = { status: 'loading', invoices: [] };
    cached.current = next;
    setHistory(next);

    let index = 0;
    const worker = async () => {
      while (index < missing.length) {
        const empenhoId = missing[index++];
        let result: HistoricalResult;
        try {
          const response = await loadInvoicesForEmpenho(empenhoId);
          result = { status: response.truncated ? 'truncated' : 'ready', invoices: response.invoices };
        } catch (error) {
          console.warn('Falha ao consultar histórico de NF:', empenhoId, error);
          result = { status: 'error', invoices: [] };
        }
        if (!mounted.current || generation.current !== version) return;
        setHistory((current) => {
          const updated = { ...current, [empenhoId]: result };
          cached.current = updated;
          return updated;
        });
      }
    };
    void Promise.all(Array.from({ length: Math.min(3, missing.length) }, () => worker()));
    // A chave varia apenas quando a página de empenhos é alterada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, refresh]);

  const update = () => {
    generation.current += 1;
    cached.current = {};
    setHistory({});
    setRefresh((value) => value + 1);
  };
  const suppliers = new Set(all.map((row) => row.envio.fornecedor || byEmpenho.get(row.empenhoId)?.supplier || row.empenhoId));

  return (
    <section className="space-y-5" data-testid="cronograma-envios-view">
      <header className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-lg font-black text-[#00288e]">
          <Mail className="h-5 w-5" /> Acompanhamento de cronogramas enviados
        </h3>
        <p className="mt-2 text-xs text-slate-600">
          Remessas solicitadas por e-mail e NFs vinculadas ao empenho com data de emissão na semana prevista, de segunda a domingo.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-blue-50 p-3">
            <p className="text-[10px] font-bold text-blue-700">Envios</p>
            <p className="text-xl font-black text-[#00288e]">{all.length}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[10px] font-bold text-slate-600">Fornecedores</p>
            <p className="text-xl font-black text-slate-900">{suppliers.size}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3">
            <p className="text-[10px] font-bold text-emerald-700">Remessas</p>
            <p className="text-xl font-black text-emerald-900">
              {all.reduce((sum, row) => sum + (row.envio.remessas?.length || 0), 0)}
            </p>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Pesquisar envios</span>
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }}
            placeholder="Buscar por fornecedor, empenho ou destinatário"
            className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm outline-none focus:border-blue-400" />
        </label>
        <button type="button" onClick={update} className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 px-4 py-3 text-xs font-bold text-[#00288e]">
          <RefreshCw className="h-4 w-4" /> Atualizar NFs
        </button>
      </div>

      <p className="flex items-start gap-2 text-xs text-slate-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        Uma NF emitida na semana não comprova chegada do material nem atendimento integral das quantidades. A análise é documental e usa a data da NF, não a data do cadastro.
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
          {all.length ? 'Nenhum envio corresponde à pesquisa.' : 'Ainda não há envios de cronogramas registrados.'}
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map(({ key, empenhoId, envio }) => {
            const empenho = byEmpenho.get(empenhoId);
            const materialNames = new Map(empenho?.items.map((item) => [item.id, item.name]) || []);
            for (const remessa of envio.remessas || []) {
              for (const material of remessa.materiais) materialNames.set(material.itemId, material.nome);
            }
            const result = history[empenhoId];
            return (
              <article key={key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="space-y-2 border-b border-slate-100 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-black text-[#00288e]">NE {empenhoId}</span>
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                      <CalendarDays className="h-4 w-4" /> {formatSentAt(envio.enviadoEm)}
                    </span>
                  </div>
                  <h4 className="text-base font-black text-slate-900">{envio.fornecedor || empenho?.supplier || 'Fornecedor não identificado'}</h4>
                  <p className="break-all text-xs text-slate-600">Para: <strong>{envio.destinatario}</strong></p>
                  <p className="break-all text-[11px] text-slate-500">De: {envio.remetente}</p>
                </div>

                {!envio.remessas ? (
                  <div className="p-5 text-xs leading-relaxed text-amber-800">
                    Este envio é anterior ao histórico detalhado. Os materiais e datas solicitados naquele e-mail não foram preservados, portanto não é possível reconstruí-los com segurança.
                  </div>
                ) : (
                  <div className="space-y-4 p-5">
                    {envio.remessas.map((remessa) => {
                      const range = remessaWeekRange(remessa.dataPrevista);
                      const available = result?.status === 'ready' || result?.status === 'truncated';
                      const matches = available
                        ? matchInvoicesForRemessaWeek(empenhoId, remessa.dataPrevista, result.invoices)
                        : [];
                      const label = !range ? 'Data da remessa inválida'
                        : !result || result.status === 'loading' ? 'Consultando NFs...'
                        : result.status === 'error' ? 'Consulta indisponível'
                        : result.status === 'truncated' ? 'Histórico parcial — inconclusivo'
                        : matches.length ? String(matches.length) + ' NF(s) emitida(s) na semana'
                        : 'Nenhuma NF emitida na semana';
                      return (
                        <section key={remessa.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <h5 className="text-sm font-extrabold text-slate-900">{remessa.titulo}</h5>
                              <p className="mt-1 text-xs text-slate-600">
                                Prevista: <strong>{formatDay(remessa.dataPrevista)}</strong>
                                {range ? ' · Semana: ' + formatDay(range.start) + ' a ' + formatDay(range.end) : ''}
                              </p>
                            </div>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-extrabold text-slate-700">
                              {available && result.status === 'ready' && matches.length ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                : !result || result.status === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <Info className="h-3.5 w-3.5 text-amber-600" />}
                              {label}
                            </span>
                          </div>
                          <div className="mt-4">
                            <p className="text-[10px] font-black uppercase text-slate-500">Materiais solicitados</p>
                            {remessa.materiais.length === 0 ? (
                              <p className="mt-2 text-xs text-slate-500">Sem quantidades programadas.</p>
                            ) : (
                              <ul className="mt-2 space-y-1.5">
                                {remessa.materiais.map((item) => (
                                  <li key={item.itemId} className="flex justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs">
                                    <span className="break-words">{item.nome}</span>
                                    <strong className="shrink-0">{item.quantidade.toLocaleString('pt-BR')} {item.unidade}</strong>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          {matches.length > 0 && (
                            <div className="mt-4 space-y-2">
                              <p className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-800">
                                <FileText className="h-3.5 w-3.5" /> NF(s) vinculada(s) ao empenho nessa semana
                              </p>
                              {matches.map((invoice) => (
                                <div key={invoice.recordKey || invoice.empenhoId + ':' + invoice.id} className="rounded-lg border border-emerald-100 bg-white p-3">
                                  <div className="flex flex-wrap justify-between gap-2 text-xs">
                                    <strong>NF {invoice.id}</strong>
                                    <span>Emissão: {formatDay(invoice.issueDate)}</span>
                                  </div>
                                  <p className="mt-2 text-[11px] text-slate-600">
                                    Itens da NF: {invoice.items.map((item) =>
                                      (materialNames.get(item.itemId) || 'Item ' + item.itemId) + ' (' + item.quantity + ')'
                                    ).join('; ') || 'Não informados'}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>
                      );
                    })}
                    {envio.remessas.length === 0 && <p className="text-xs text-slate-500">Nenhuma remessa programada neste envio.</p>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {maxPage > 1 && (
        <nav aria-label="Paginação dos envios" className="flex items-center justify-center gap-3 text-xs">
          <button disabled={selectedPage === 0} onClick={() => setPage(selectedPage - 1)}
            className="rounded-lg border border-slate-200 px-4 py-2 font-bold disabled:opacity-40">Anterior</button>
          <span>Página {selectedPage + 1} de {maxPage}</span>
          <button disabled={selectedPage >= maxPage - 1} onClick={() => setPage(selectedPage + 1)}
            className="rounded-lg border border-slate-200 px-4 py-2 font-bold disabled:opacity-40">Próxima</button>
        </nav>
      )}
    </section>
  );
}
