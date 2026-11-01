'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';

type LeadStatus = 'novo' | 'contatado' | 'em_teste' | 'concluido' | 'descartado';
type Lead = {
  id: string; nomeCompleto: string; patente: string; organizacaoMilitar: string;
  email: string; whatsapp: string; status: LeadStatus; createdAt: string;
  updatedAt: string; lastRequestedAt: string; lastContactAt: string;
  nextActionAt: string; adminNote: string; version: string;
};
type TrackingPatch = Partial<Pick<Lead, 'status' | 'lastContactAt' | 'nextActionAt' | 'adminNote'>>;
const statuses: Array<{ value: LeadStatus; label: string }> = [
  { value: 'novo', label: 'Novo' }, { value: 'contatado', label: 'Contatado' },
  { value: 'em_teste', label: 'Em teste' }, { value: 'concluido', label: 'Concluído' },
  { value: 'descartado', label: 'Descartado' },
];
function displayDate(value: string) {
  if (!value) return 'Não informado';
  const parsed = value.length === 10 ? new Date(value + 'T12:00:00') : new Date(value);
  return Number.isNaN(parsed.valueOf()) ? 'Não informado' : parsed.toLocaleDateString('pt-BR');
}
function todayLocal() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function hasNewContact(lead: Lead) {
  if (!lead.lastRequestedAt || lead.lastRequestedAt === lead.createdAt) return false;
  const lastAction = lead.lastContactAt
    ? new Date(lead.lastContactAt + 'T23:59:59.999Z').valueOf()
    : new Date(lead.updatedAt || lead.createdAt).valueOf();
  return new Date(lead.lastRequestedAt).valueOf() > lastAction;
}
function needsAttention(lead: Lead, today: string) {
  if (hasNewContact(lead)) return true;
  if (lead.nextActionAt && lead.nextActionAt <= today) return true;
  return lead.status === 'novo';
}
function TrackingEditor({ lead, busy, onSave }: {
  lead: Lead; busy: boolean; onSave: (patch: TrackingPatch) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(lead.adminNote || '');
  const [lastContact, setLastContact] = useState(lead.lastContactAt || '');
  const [nextAction, setNextAction] = useState(lead.nextActionAt || '');
  useEffect(() => {
    setNote(lead.adminNote || '');
    setLastContact(lead.lastContactAt || '');
    setNextAction(lead.nextActionAt || '');
  }, [lead.version, lead.adminNote, lead.lastContactAt, lead.nextActionAt]);
  return (
    <div className="mt-3 border-t border-[#d4e3f4] pt-3">
      <button type="button" onClick={() => setOpen(value => !value)}
        aria-expanded={open} className="text-sm font-semibold underline">
        {open ? 'Fechar acompanhamento' : 'Editar acompanhamento'}
      </button>
      {open && (
        <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={event => {
          event.preventDefault();
          void onSave({ adminNote: note, lastContactAt: lastContact, nextActionAt: nextAction });
        }}>
          <label className="block text-xs font-semibold">Último contato efetivo
            <input type="date" value={lastContact} disabled={busy} onChange={event => setLastContact(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-[#b4c9dc] p-2 text-sm" />
          </label>
          <label className="block text-xs font-semibold">Próxima ação (opcional)
            <input type="date" value={nextAction} disabled={busy} onChange={event => setNextAction(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-[#b4c9dc] p-2 text-sm" />
          </label>
          <label className="block text-xs font-semibold sm:col-span-2">Observação administrativa (máx. 280 caracteres)
            <textarea value={note} maxLength={280} rows={2} disabled={busy}
              onChange={event => setNote(event.target.value)} placeholder="Resumo objetivo da conversa e próxima providência."
              className="mt-1 block w-full rounded-lg border border-[#b4c9dc] p-2 text-sm" />
            <span className="mt-1 block text-[11px] font-normal text-[#597390]">
              Não inclua senhas, dados bancários, documentos ou informações sensíveis.
            </span>
          </label>
          <button type="submit" disabled={busy}
            className="w-fit rounded-lg bg-[#17375e] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? 'Salvando...' : 'Salvar acompanhamento'}
          </button>
        </form>
      )}
    </div>
  );
}

export function AdminAccessRequestsPanel({ adminUser }: { adminUser: User }) {
  const [records, setRecords] = useState<Lead[]>([]);
  const [pageTokens, setPageTokens] = useState<string[]>(['']);
  const [pageIndex, setPageIndex] = useState(0);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');
  const activeToken = pageTokens[pageIndex] || '';

  const reload = useCallback(async () => {
    setError(''); setLoading(true);
    try {
      const token = await adminUser.getIdToken();
      const suffix = activeToken ? '?pageToken=' + encodeURIComponent(activeToken) : '';
      const response = await fetch('/api/admin/access-requests' + suffix, {
        headers: { Authorization: 'Bearer ' + token }, cache: 'no-store',
      });
      const body = await response.json();
      if (!response.ok || body.ok !== true || !Array.isArray(body.records)) {
        throw new Error(body.error || 'Falha ao consultar interessados.');
      }
      setRecords(body.records);
      setNextPageToken(typeof body.nextPageToken === 'string' && body.nextPageToken ? body.nextPageToken : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao consultar interessados.');
      setNextPageToken(null);
    } finally { setLoading(false); }
  }, [adminUser, activeToken]);

  useEffect(() => { void reload(); }, [reload]);

  const visible = useMemo(() => records.filter(record =>
    [record.nomeCompleto, record.patente, record.organizacaoMilitar, record.email]
      .join(' ').toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))
  ), [records, query]);
  const today = todayLocal();
  const attentionCount = records.filter(record => needsAttention(record, today)).length;

  const update = async (lead: Lead, patch: TrackingPatch) => {
    setBusy(lead.id); setError('');
    try {
      const token = await adminUser.getIdToken();
      const response = await fetch('/api/admin/access-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ id: lead.id, version: lead.version, ...patch }),
      });
      const data = await response.json();
      if (!response.ok || data.ok !== true) {
        if (response.status === 409) await reload();
        throw new Error(data.error || 'Não foi possível atualizar o atendimento.');
      }
      await reload();
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar.'); }
    finally { setBusy(''); }
  };

  return (
    <section className="rounded-3xl border border-[#d4e3f4] bg-white p-5 text-[#17375e] sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="text-xl font-bold">Solicitações de acesso</h3>
          <p className="text-xs text-[#597390]">Interessados do site institucional. Acompanhamento humano, sem vincular automaticamente clientes ou trials.</p></div>
        <button type="button" onClick={() => void reload()} disabled={loading}
          className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Atualizar</button>
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <span className="rounded-lg border border-[#d4e3f4] px-3 py-2">Nesta página: <strong>{records.length}</strong></span>
        <span className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
          Precisam de atenção nesta página: <strong>{attentionCount}</strong>
        </span>
      </div>
      <label htmlFor="lead-query" className="mt-5 block text-xs font-semibold">Buscar nesta página</label>
      <input id="lead-query" value={query} onChange={event => setQuery(event.target.value)}
        placeholder="Nome, posto, OM ou e-mail (somente página carregada)"
        className="mt-1 w-full rounded-lg border border-[#b4c9dc] bg-white p-3 text-sm text-[#17375e]" />
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {loading ? <p className="mt-5 text-sm">Carregando...</p> : (
        <div className="mt-5 space-y-3">
          {visible.length === 0 && <p className="text-sm">Nenhum interessado encontrado nesta página.</p>}
          {visible.map(item => (
            <article key={item.id} className="rounded-xl border border-[#d4e3f4] bg-[#f5f9fd] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h4 className="font-bold">{item.nomeCompleto}</h4>
                  <p className="text-sm">{item.patente} · {item.organizacaoMilitar}</p>
                  <p className="mt-1 text-xs text-[#597390]">Solicitação: {displayDate(item.createdAt)}</p>
                  {needsAttention(item, today) && <p className="mt-1 text-xs font-semibold text-amber-800">Precisa de atenção</p>}
                  {hasNewContact(item) && <p className="mt-1 text-xs font-semibold text-blue-800">Novo pedido de contato registrado</p>}
                </div>
                <label className="text-xs font-semibold">Situação
                  <select aria-label={'Situação de ' + item.nomeCompleto} value={item.status}
                    onChange={event => void update(item, { status: event.target.value as LeadStatus })}
                    disabled={busy === item.id}
                    className="mt-1 block rounded-lg border border-[#b4c9dc] bg-white px-2 py-2 text-sm">
                    {statuses.map(status => <option value={status.value} key={status.value}>{status.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <a className="underline" href={'mailto:' + item.email}>{item.email}</a>
                <a className="underline" href={'https://wa.me/' + item.whatsapp.replace(/\D/g, '')}
                   target="_blank" rel="noopener noreferrer">WhatsApp: {item.whatsapp}</a>
              </div>
              <p className="mt-3 text-xs text-[#597390]">
                Último contato: {displayDate(item.lastContactAt)} · Próxima ação: {displayDate(item.nextActionAt)}
                {item.lastRequestedAt && item.lastRequestedAt !== item.createdAt
                  ? ' · Último pedido: ' + displayDate(item.lastRequestedAt) : ''}
              </p>
              {item.adminNote && <p className="mt-2 whitespace-pre-wrap text-sm">{item.adminNote}</p>}
              <TrackingEditor lead={item} busy={busy === item.id} onSave={patch => update(item, patch)} />
            </article>
          ))}
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#d4e3f4] pt-4">
        <p className="text-xs text-[#597390]">Página {pageIndex + 1}. Consulta limitada a 25 registros por página.</p>
        <div className="flex gap-2">
          <button type="button" disabled={loading || pageIndex === 0}
            onClick={() => setPageIndex(value => Math.max(0, value - 1))}
            className="rounded-lg border border-blue-300 px-3 py-2 text-sm disabled:opacity-50">Anterior</button>
          <button type="button" disabled={loading || !nextPageToken}
            onClick={() => {
              if (!nextPageToken) return;
              setPageTokens(current => [...current.slice(0, pageIndex + 1), nextPageToken]);
              setPageIndex(pageIndex + 1);
            }}
            className="rounded-lg border border-blue-300 px-3 py-2 text-sm disabled:opacity-50">Próxima</button>
        </div>
      </div>
      <p className="mt-2 text-xs text-[#597390]">“Em teste” é um status comercial, não a comprovação de um trial concedido.</p>
    </section>
  );
}
