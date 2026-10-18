'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  BriefcaseBusiness, Check, ChevronLeft, ChevronRight, CircleAlert,
  FilePenLine, Loader2, Plus, RefreshCw, Search, ShieldCheck,
  UserRound, Users, X,
} from 'lucide-react';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import {
  ADMIN2_COMMERCIAL_PAGE_SIZE, COMMERCIAL_STATUSES,
  buildCommercialCustomer, normalizeCommercialCustomerInput,
  validateCommercialCustomerInput,
  type CommercialCustomer, type CommercialCustomerInput,
} from '../../../lib/admin2/customers/commercialCustomerContract';
import {
  commercialEmulatorWritesEnabled, listCommercialCustomers, saveCommercialCustomer,
} from '../../../lib/admin2/customers/commercialCustomerRepository';
import { readCustomerWorkspacePage } from '../../../lib/admin2/customers/customerWorkspaceDirectory';
import styles from '../shell/AdminCommandPreview.module.css';

const EMPTY: CommercialCustomerInput = {
  displayName: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  relationshipStatus: 'prospect',
  relationshipNotes: '',
  workspaceId: '',
};

interface Props {
  drafts: CommercialCustomer[];
  onChangeDrafts: (next: CommercialCustomer[]) => void;
}

export function AdminCommercialCustomers({ drafts, onChangeDrafts }: Props) {
  const [records, setRecords] = useState<CommercialCustomer[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CommercialCustomer | null>(null);
  const [form, setForm] = useState<CommercialCustomerInput>(EMPTY);
  const [search, setSearch] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [checkingLink, setCheckingLink] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const cursors = useRef<Array<QueryDocumentSnapshot<DocumentData> | null>>([null]);

  const loadPage = useCallback(async (index: number) => {
    if (!commercialEmulatorWritesEnabled) return;
    setWorking(true);
    setError('');
    try {
      const result = await listCommercialCustomers(cursors.current[index] || null);
      setRecords(result.rows);
      setHasMore(result.hasMore);
      cursors.current[index + 1] = result.cursor;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao consultar clientes comerciais.');
    } finally {
      setWorking(false);
    }
  }, []);

  useEffect(() => { if (commercialEmulatorWritesEnabled) void loadPage(page); }, [loadPage, page]);
  const visible = commercialEmulatorWritesEnabled ? records : drafts;
  const filtered = visible.filter(customer =>
    customer.displayName.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')) ||
    customer.contactName.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))
  );
  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY });
    setLinkInput('');
    setFormOpen(true);
    setError('');
    setNotice('');
  };
  const openEdit = (customer: CommercialCustomer) => {
    setEditing(customer);
    setForm({
      displayName: customer.displayName,
      contactName: customer.contactName,
      contactEmail: customer.contactEmail,
      contactPhone: customer.contactPhone,
      relationshipStatus: customer.relationshipStatus,
      relationshipNotes: customer.relationshipNotes,
      workspaceId: customer.workspaceId,
    });
    setFormOpen(true);
    setLinkInput('');
    setError('');
  };

  const attachWorkspace = async () => {
    if (editing) { setError('O workspace de um cliente existente não pode ser alterado.'); return; }
    const id = linkInput.trim().toLowerCase();
    if (!id) return;
    setCheckingLink(true);
    setError('');
    try {
      const found = await readCustomerWorkspacePage({ field: 'workspaceId', term: id }, null);
      if (!found.rows.some(row => row.workspaceId === id)) throw new Error('Workspace inexistente ou sem acesso.');
      const other = visible.find(c => c.workspaceId === id);
      if (other) throw new Error('Este workspace já possui cadastro comercial; abra o cadastro existente.');
      setForm(current => ({ ...current, workspaceId: id }));
      setLinkInput('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível validar o workspace.');
    } finally {
      setCheckingLink(false);
    }
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');
    const input = normalizeCommercialCustomerInput(form);
    const issues = validateCommercialCustomerInput(input);
    if (issues.length) { setError(issues.join(' ')); return; }
    if (!commercialEmulatorWritesEnabled) {
      const conflict = drafts.find(c =>
        c.workspaceId === input.workspaceId && c.id !== editing?.id
      );
      if (conflict) { setError('Um workspace já pertence a outro rascunho desta sessão.'); return; }
    }
    setWorking(true);
    try {
      if (commercialEmulatorWritesEnabled) {
        await saveCommercialCustomer(input, editing);
        await loadPage(page);
        setNotice('Cadastro salvo no Firestore Emulator. Nenhuma escrita em produção.');
      } else {
        const result = buildCommercialCustomer(
          input.workspaceId,
          input, 'preview-local', new Date().toISOString(), editing || undefined
        );
        onChangeDrafts(editing
          ? drafts.map(customer => customer.id === editing.id ? result : customer)
          : [...drafts, result]);
        setNotice('Rascunho salvo apenas na memória desta página. Não foi enviado ao Firestore.');
      }
      setFormOpen(false);
      setEditing(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao salvar.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="admin2-commercial-customers">
      <section className={styles.sectionCard + ' p-5 sm:p-6'}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className={styles.sectionEyebrow + ' font-mono uppercase'}>CARTEIRA COMERCIAL / CLIENTES</p>
            <h2 className="mt-2 text-[19px] font-black text-[#173558]">Cadastro independente de clientes</h2>
            <p className="mt-2 max-w-2xl text-[12px] leading-6 text-[#627994]">
              Contatos, situação do relacionamento e um cadastro comercial individual por workspace existente.
              Não cria OM, não altera UG nem substitui os controles de assinatura.
            </p>
          </div>
          <button type="button" onClick={openNew} data-testid="admin2-new-commercial"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#184c9b] px-5 text-xs font-bold text-white shadow-[0_8px_22px_rgba(35,94,176,.18)] hover:bg-[#2364b3]">
            <Plus className="h-4 w-4" /> Novo cliente
          </button>
        </div>
        <div className={'mt-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-[11px] leading-6 ' + (commercialEmulatorWritesEnabled
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-amber-200 bg-[#fffbf0] text-amber-800')} role="note">
          <ShieldCheck className="mt-1 h-4 w-4 shrink-0" />
          {commercialEmulatorWritesEnabled
            ? 'Modo homologação: registros persistem exclusivamente no Firebase Emulator local com as Rules da branch.'
            : 'Modo prévia segura: os cadastros são rascunhos temporários em memória. Ao recarregar ou fechar a página serão perdidos. NÃO use informações pessoais verdadeiras neste teste. Produção não será alterada.'}
        </div>
        {notice && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">{notice}</p>}
        {!formOpen && (
          <>
            <div className="relative mt-5">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#7387a0]" />
              <input className={styles.demoInput + ' h-11 w-full pl-10 pr-3 text-xs'} value={search} onChange={e => setSearch(e.target.value)}
                aria-label="Pesquisar clientes comerciais desta página" placeholder="Buscar nome comercial ou responsável nesta página..." />
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {filtered.map(customer => (
                <article key={customer.id} className="rounded-[18px] border border-[#d9e5f3] bg-[#faffff] p-5 shadow-[0_8px_22px_rgba(24,62,112,.04)]">
                  <div className="flex justify-between gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e7f1ff] text-[#2261ad]"><BriefcaseBusiness className="h-5 w-5"/></div>
                    <span className="h-fit rounded-full bg-[#eaf3ff] px-3 py-1 text-[10px] font-extrabold text-[#2d609b]">
                      {COMMERCIAL_STATUSES.find(s => s.value === customer.relationshipStatus)?.label}
                    </span>
                  </div>
                  <h3 className="mt-4 text-[15px] font-extrabold text-[#17365f]">{customer.displayName}</h3>
                  <p className="mt-2 text-[11px] text-[#72859e]">{customer.contactName || 'Responsável não cadastrado'} · {customer.contactEmail || 'Sem e-mail comercial'}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="rounded-lg border border-[#d6e4f4] bg-[#edf5ff] px-2 py-1 font-mono text-[10px] text-[#37608e]">{customer.workspaceId}</span>
                  </div>
                  <button type="button" onClick={() => openEdit(customer)} className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#cbdcf0] bg-white px-3 text-[11px] font-bold text-[#2c5d9e] hover:bg-[#edf5ff]">
                    <FilePenLine className="h-4 w-4" /> Editar cadastro
                  </button>
                </article>
              ))}
            </div>
            {filtered.length === 0 && !working && <p className="mt-5 rounded-xl border border-dashed border-[#c7d9ed] bg-[#f8fbff] px-4 py-10 text-center text-xs text-[#7185a1]">Nenhum cliente comercial {search ? 'corresponde à pesquisa' : 'cadastrado nesta prévia'}.</p>}
            {working && <p className="mt-4 flex items-center gap-2 text-xs text-[#647b99]"><Loader2 className="h-4 w-4 animate-spin" /> Consultando dados de homologação...</p>}
            {commercialEmulatorWritesEnabled && <div className="mt-5 flex items-center justify-between">
              <span className="text-[11px] text-[#7185a1]">{ADMIN2_COMMERCIAL_PAGE_SIZE} por página no Emulator</span>
              <div className="flex gap-2">
                <button type="button" disabled={working || page === 0} onClick={() => setPage(p => p - 1)} className="rounded-lg border border-[#cfdff0] px-3 py-2 text-xs disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                <button type="button" disabled={working || !hasMore} onClick={() => setPage(p => p + 1)} className="rounded-lg border border-[#cfdff0] px-3 py-2 text-xs disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                <button type="button" disabled={working} onClick={() => { cursors.current = [null]; setPage(0); void loadPage(0); }} className="rounded-lg border border-[#cfdff0] px-3 py-2 text-xs"><RefreshCw className="h-4 w-4" /></button>
              </div>
            </div>}
          </>
        )}
        {formOpen && (
          <form onSubmit={save} className="mt-5 space-y-5" data-testid="admin2-commercial-form">
            <div className="flex items-center justify-between border-b border-[#e5edf7] pb-3">
              <h3 className="text-base font-extrabold text-[#1d3b63]">{editing ? 'Editar cadastro comercial' : 'Novo cliente comercial'}</h3>
              <button type="button" onClick={() => setFormOpen(false)} aria-label="Fechar formulário" className="rounded-lg p-2 text-[#6982a1] hover:bg-[#ecf4ff]"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {([
                ['displayName', 'Nome comercial *', 120],
                ['contactName', 'Pessoa de contato', 100],
                ['contactEmail', 'E-mail de contato', 160],
                ['contactPhone', 'Telefone', 30],
              ] as const).map(([key, label, maxlength]) => (
                <label key={key} className="space-y-1.5 text-xs font-bold text-[#345476]">
                  <span>{label}</span>
                  <input required={key === 'displayName'} type={key === 'contactEmail' ? 'email' : 'text'}
                    maxLength={maxlength} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className={styles.demoInput + ' h-11 w-full px-3 text-xs'} />
                </label>
              ))}
              <label className="space-y-1.5 text-xs font-bold text-[#345476]">
                <span>Situação do relacionamento</span>
                <select className={styles.demoInput + ' h-11 w-full px-3 text-xs'} value={form.relationshipStatus}
                  onChange={e => setForm(f => ({ ...f, relationshipStatus: e.target.value as CommercialCustomerInput['relationshipStatus'] }))}>
                  {COMMERCIAL_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
            </div>
            <label className="block space-y-1.5 text-xs font-bold text-[#345476]">
              <span>Observações de relacionamento (não inclua informações sigilosas)</span>
              <textarea rows={3} maxLength={1000} className={styles.demoInput + ' w-full resize-y px-3 py-3 text-xs'} value={form.relationshipNotes}
                onChange={e => setForm(f => ({ ...f, relationshipNotes: e.target.value }))}/>
            </label>
            <div className="space-y-3 rounded-[16px] border border-[#dae7f6] bg-[#f3f8ff] p-4">
              <h4 className="flex items-center gap-2 text-xs font-extrabold text-[#28558d]"><Users className="h-4 w-4" /> Workspace do cliente (obrigatório e único)</h4>
              <p className="text-[11px] text-[#6982a0]">Cada workspace constitui um cliente comercial independente, com sua própria assinatura. O responsável de contato não recebe permissões operacionais.</p>
              {form.workspaceId ? (
                <div className="flex items-center gap-2">
                  <span className="rounded-lg border border-[#cddff4] bg-white px-3 py-2 font-mono text-[11px] text-[#2d629d]">{form.workspaceId}</span>
                  {!editing && <button type="button" onClick={() => setForm(c => ({ ...c, workspaceId: '' }))} className="rounded-lg border border-[#cddff4] bg-white px-3 py-2 text-[11px] text-[#2864ac]">Alterar seleção</button>}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <input className={styles.demoInput + ' h-10 min-w-0 flex-1 px-3 text-xs'} value={linkInput} onChange={e => setLinkInput(e.target.value)}
                    placeholder="ID do workspace existente" aria-label="ID do workspace do cliente" />
                  <button type="button" disabled={checkingLink || working} onClick={attachWorkspace} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#bdd4ef] bg-white px-3 text-[11px] font-bold text-[#2864ac] disabled:opacity-50">
                    {checkingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Selecionar workspace
                  </button>
                </div>
              )}
              <p className="text-[10px] leading-5 text-[#7487a1]">O ID é verificado no diretório administrativo antes da seleção. Após salvar, ele permanece imutável. Nenhum registro operacional do workspace é modificado.</p>
            </div>
            {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] text-red-700"><CircleAlert className="h-4 w-4 shrink-0" />{error}</p>}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={() => setFormOpen(false)} className="min-h-11 rounded-xl border border-[#ccdbeb] bg-white px-5 text-xs font-bold text-[#617995]">Cancelar</button>
              <button type="submit" disabled={working} data-testid="admin2-commercial-save" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#19509e] px-5 text-xs font-bold text-white hover:bg-[#2564b3] disabled:opacity-50">
                {working ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4"/>}
                {commercialEmulatorWritesEnabled ? 'Salvar no Emulator' : 'Salvar rascunho local'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
