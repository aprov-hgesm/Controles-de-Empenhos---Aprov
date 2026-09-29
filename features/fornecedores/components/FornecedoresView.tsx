'use client';

import {
  AlertCircle,
  BriefcaseBusiness,
  Building2,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react';

import type { Empenho, SupplierContact, SupplierDirectoryEntry } from '../../../lib/types';
import {
  getEmpenhos,
  getSupplierContacts,
  saveSupplierContact,
} from '../../../lib/firebaseSync';
import {
  ensureGlobalSupplierDirectorySeed,
  getGlobalSupplierDirectory,
} from '../../../lib/supplierDirectory';
import {
  formatSupplierCnpj,
  isValidSupplierCnpj,
  normalizeSupplierCnpj,
} from '../../../lib/invoiceIdentity';
import { normalizeSupplier } from '../../empenhos/domain/empenhoHelpers';

type SupplierFilter = 'todos' | 'ativos' | 'pendentes';

interface FornecedoresViewProps {
  user: User | null;
  empenhos: Empenho[];
  setEmpenhos: Dispatch<SetStateAction<Empenho[]>>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface SupplierAggregate {
  key: string;
  legalName: string;
  cnpj: string;
  email: string;
  phone: string;
  whatsapp: string;
  globalEmail: string;
  emailSource: 'local' | 'global' | 'none';
  contact: SupplierContact | null;
  activeEmpenhos: Empenho[];
}

interface SupplierFormState {
  legalName: string;
  cnpj: string;
  email: string;
  phone: string;
  whatsapp: string;
}

const EMPTY_FORM: SupplierFormState = {
  legalName: '',
  cnpj: '',
  email: '',
  phone: '',
  whatsapp: '',
};

function normalizeNameKey(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, ' ');
}

function isOperationallyActive(emp: Empenho): boolean {
  return emp.status === 'Ativo' || emp.status === 'Urgente';
}

function whatsappHref(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
    digits = '55' + digits;
  }
  return 'https://wa.me/' + digits;
}

function phoneHref(value: string): string {
  const compact = value.replace(/[^\d+]/g, '');
  return compact ? 'tel:' + compact : '';
}

export function FornecedoresView({
  user,
  empenhos,
  setEmpenhos,
  showToast,
}: FornecedoresViewProps) {
  const [contacts, setContacts] = useState<SupplierContact[]>([]);
  const [directory, setDirectory] = useState<SupplierDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<SupplierFilter>('todos');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SupplierFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [savedContacts, freshEmpenhos, loadedDirectory] = await Promise.all([
        getSupplierContacts(user.uid),
        getEmpenhos(user.uid),
        getGlobalSupplierDirectory(user.uid),
      ]);
      const globalDirectory = await ensureGlobalSupplierDirectorySeed(
        user.uid,
        loadedDirectory
      );
      setContacts(savedContacts);
      setDirectory(globalDirectory);
      setEmpenhos(
        freshEmpenhos.map((emp) => ({
          ...emp,
          supplier: normalizeSupplier(emp.supplier),
        }))
      );
    } catch (error) {
      console.error('Erro ao carregar fornecedores:', error);
      showToast('Não foi possível carregar a Central de Fornecedores.', 'error');
    } finally {
      setLoading(false);
    }
  }, [setEmpenhos, showToast, user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const suppliers = useMemo<SupplierAggregate[]>(() => {
    const aggregateMap = new Map<string, SupplierAggregate>();
    const contactKeyByName = new Map<string, string>();
    const directoryByCnpj = new Map(
      directory.map((entry) => [entry.cnpj, entry.email])
    );

    contacts.forEach((contact) => {
      const key = 'cnpj:' + contact.cnpj;
      const globalEmail = directoryByCnpj.get(contact.cnpj) || '';
      aggregateMap.set(key, {
        key,
        legalName: contact.legalName,
        cnpj: contact.cnpj,
        email: contact.email || globalEmail,
        phone: contact.phone,
        whatsapp: contact.whatsapp,
        globalEmail,
        emailSource: contact.email ? 'local' : globalEmail ? 'global' : 'none',
        contact,
        activeEmpenhos: [],
      });
      contactKeyByName.set(normalizeNameKey(contact.legalName), key);
    });

    empenhos.filter(isOperationallyActive).forEach((emp) => {
      const legalName = normalizeSupplier(emp.supplier).trim() || 'Fornecedor não identificado';
      const cnpj = normalizeSupplierCnpj(emp.supplierCnpj);
      const nameKey = normalizeNameKey(legalName);
      const key = cnpj
        ? 'cnpj:' + cnpj
        : contactKeyByName.get(nameKey) || 'name:' + nameKey;

      const current = aggregateMap.get(key);
      if (current) {
        current.activeEmpenhos.push(emp);
        if (!current.legalName) current.legalName = legalName;
        if (!current.cnpj && cnpj) current.cnpj = cnpj;
        return;
      }

      const globalEmail = cnpj ? directoryByCnpj.get(cnpj) || '' : '';
      aggregateMap.set(key, {
        key,
        legalName,
        cnpj,
        email: globalEmail,
        phone: '',
        whatsapp: '',
        globalEmail,
        emailSource: globalEmail ? 'global' : 'none',
        contact: null,
        activeEmpenhos: [emp],
      });
    });

    return Array.from(aggregateMap.values()).sort((a, b) => {
      const activeDiff =
        Number(b.activeEmpenhos.length > 0) - Number(a.activeEmpenhos.length > 0);
      if (activeDiff !== 0) return activeDiff;
      return a.legalName.localeCompare(b.legalName, 'pt-BR');
    });
  }, [contacts, directory, empenhos]);

  const filteredSuppliers = useMemo(() => {
    const query = search.trim().toUpperCase();

    return suppliers.filter((supplier) => {
      const pending = !supplier.email || !supplier.phone || !supplier.whatsapp;
      if (filter === 'ativos' && supplier.activeEmpenhos.length === 0) return false;
      if (filter === 'pendentes' && !pending) return false;

      if (!query) return true;

      const searchable = [
        supplier.legalName,
        supplier.cnpj,
        formatSupplierCnpj(supplier.cnpj),
        supplier.email,
        supplier.phone,
        supplier.whatsapp,
        ...supplier.activeEmpenhos.map((emp) => emp.id),
      ]
        .join(' ')
        .toUpperCase();

      return searchable.includes(query);
    });
  }, [filter, search, suppliers]);

  const activeSupplierCount = suppliers.filter(
    (supplier) => supplier.activeEmpenhos.length > 0
  ).length;
  const pendingSupplierCount = suppliers.filter(
    (supplier) => !supplier.email || !supplier.phone || !supplier.whatsapp
  ).length;
  const whatsappCount = suppliers.filter((supplier) => Boolean(supplier.whatsapp)).length;

  const openNewSupplier = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setEditorOpen(true);
  };

  const openSupplierEditor = (supplier: SupplierAggregate) => {
    setEditingId(supplier.contact?.id || null);
    setForm({
      legalName: supplier.legalName,
      cnpj: supplier.cnpj
        ? formatSupplierCnpj(supplier.cnpj) || supplier.cnpj
        : '',
      email: supplier.email,
      phone: supplier.phone,
      whatsapp: supplier.whatsapp,
    });
    setFormError('');
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
    setEditingId(null);
    setFormError('');
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || saving) return;

    const legalName = form.legalName.trim();
    const cnpj = normalizeSupplierCnpj(form.cnpj);
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();
    const whatsapp = form.whatsapp.trim();

    if (!legalName) {
      setFormError('Informe a razão social do fornecedor.');
      return;
    }
    if (!cnpj || !isValidSupplierCnpj(cnpj)) {
      setFormError('Informe um CNPJ válido.');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError('Informe um e-mail válido ou deixe o campo em branco.');
      return;
    }

    const existingById = editingId
      ? contacts.find((contact) => contact.id === editingId)
      : undefined;

    if (existingById && existingById.cnpj !== cnpj) {
      setFormError(
        'O CNPJ não pode ser alterado depois que o fornecedor foi cadastrado.'
      );
      return;
    }

    const existingByCnpj = contacts.find((contact) => contact.cnpj === cnpj);
    const existing = existingById || existingByCnpj;
    const now = new Date().toISOString();

    const supplier: SupplierContact = {
      id: existing?.id || 'supplier_' + cnpj,
      legalName,
      cnpj,
      email,
      phone,
      whatsapp,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      updatedBy: user.uid,
    };

    setSaving(true);
    setFormError('');
    try {
      await saveSupplierContact(user.uid, supplier);
      setContacts((current) => [
        ...current.filter((contact) => contact.id !== supplier.id),
        supplier,
      ]);
      setEditorOpen(false);
      setEditingId(null);
      showToast('Dados do fornecedor salvos com sucesso.', 'success');
    } catch (error) {
      console.error('Erro ao salvar fornecedor:', error);
      setFormError(
        'Não foi possível salvar o fornecedor. Verifique a conexão e tente novamente.'
      );
    } finally {
      setSaving(false);
    }
  };

  const filterButtonClass = (value: SupplierFilter) =>
    'rounded-full px-4 py-2 text-xs font-extrabold transition ' +
    (filter === value
      ? 'bg-[#00288e] text-white shadow-sm'
      : 'border border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-[#00288e]');

  return (
    <section className="w-full space-y-6 pb-24">
      <header className="overflow-hidden rounded-[28px] border border-blue-100 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <div className="bg-gradient-to-r from-[#001f6b] via-[#00288e] to-[#0f4cba] px-6 py-7 text-white md:px-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
                <Building2 className="h-7 w-7" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-200">
                  Relacionamento operacional
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
                  Central de Fornecedores
                </h1>
                <p className="mt-2 max-w-2xl text-sm font-medium text-blue-100">
                  Contatos centralizados e vínculo automático com fornecedores de empenhos ativos.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={openNewSupplier}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#00288e] shadow-lg transition hover:-translate-y-0.5"
            >
              <Plus className="h-4 w-4" />
              Novo fornecedor
            </button>
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 md:p-6">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                Fornecedores
              </span>
              <Building2 className="h-4 w-4 text-[#00288e]" />
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">{suppliers.length}</div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                Com empenho ativo
              </span>
              <BriefcaseBusiness className="h-4 w-4 text-[#00288e]" />
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">{activeSupplierCount}</div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                Contatos pendentes
              </span>
              <AlertCircle className="h-4 w-4 text-[#00288e]" />
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">{pendingSupplierCount}</div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                Com WhatsApp
              </span>
              <MessageCircle className="h-4 w-4 text-[#00288e]" />
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">{whatsappCount}</div>
          </div>
        </div>
      </header>

      <div className="rounded-3xl border border-white/70 bg-white/85 p-4 shadow-sm backdrop-blur md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por razão social, CNPJ, empenho, e-mail ou telefone..."
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter('todos')}
              className={filterButtonClass('todos')}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setFilter('ativos')}
              className={filterButtonClass('ativos')}
            >
              Empenhos ativos
            </button>
            <button
              type="button"
              onClick={() => setFilter('pendentes')}
              className={filterButtonClass('pendentes')}
            >
              Contato incompleto
            </button>
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="ml-1 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-[#00288e] disabled:opacity-50"
              title="Atualizar fornecedores"
              aria-label="Atualizar fornecedores"
            >
              <RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-3xl border border-blue-100 bg-white/80">
          <div className="text-center">
            <RefreshCw className="mx-auto h-7 w-7 animate-spin text-[#00288e]" />
            <p className="mt-3 text-sm font-extrabold text-[#00288e]">
              Carregando fornecedores
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Leitura sob demanda, sem listener permanente.
            </p>
          </div>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/75 px-6 py-14 text-center">
          <Building2 className="mx-auto h-9 w-9 text-slate-300" />
          <h2 className="mt-3 text-base font-black text-slate-700">
            Nenhum fornecedor encontrado
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Ajuste os filtros ou cadastre um novo fornecedor.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredSuppliers.map((supplier) => {
            const pending = !supplier.email || !supplier.phone || !supplier.whatsapp;
            const formattedCnpj = formatSupplierCnpj(supplier.cnpj);
            const waLink = whatsappHref(supplier.whatsapp);
            const callLink = phoneHref(supplier.phone);

            return (
              <article
                key={supplier.key}
                className="group rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_18px_45px_rgba(15,23,42,0.09)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {supplier.activeEmpenhos.length > 0 ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700">
                          {supplier.activeEmpenhos.length} empenho(s) ativo(s)
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
                          Cadastro manual
                        </span>
                      )}
                      {pending && (
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700">
                          Contato incompleto
                        </span>
                      )}
                      {supplier.emailSource === 'global' && (
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-blue-700">
                          E-mail pré-cadastrado
                        </span>
                      )}
                    </div>
                    <h2 className="mt-3 break-words text-lg font-black leading-snug text-slate-900">
                      {supplier.legalName}
                    </h2>
                    <p className="mt-1 font-mono text-xs font-bold text-slate-500">
                      {formattedCnpj || supplier.cnpj || 'CNPJ não informado'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => openSupplierEditor(supplier)}
                    className="shrink-0 rounded-xl border border-slate-200 p-2.5 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-[#00288e]"
                    title="Editar fornecedor"
                    aria-label={'Editar ' + supplier.legalName}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>

                {supplier.activeEmpenhos.length > 0 && (
                  <div className="mt-4 rounded-2xl bg-slate-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                      Empenhos vinculados
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {supplier.activeEmpenhos.map((emp) => (
                        <span
                          key={emp.id}
                          className="rounded-lg border border-blue-100 bg-white px-2.5 py-1.5 font-mono text-[11px] font-black text-[#00288e]"
                        >
                          {emp.id}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {supplier.email ? (
                    <a
                      href={'mailto:' + supplier.email}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-[#00288e]"
                    >
                      <Mail className="h-4 w-4" />
                      <span className="truncate">E-mail</span>
                    </a>
                  ) : (
                    <span className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-400">
                      <Mail className="h-4 w-4" />
                      Sem e-mail
                    </span>
                  )}

                  {callLink ? (
                    <a
                      href={callLink}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-[#00288e]"
                    >
                      <Phone className="h-4 w-4" />
                      Telefone
                    </a>
                  ) : (
                    <span className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-400">
                      <Phone className="h-4 w-4" />
                      Sem telefone
                    </span>
                  )}

                  {waLink ? (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 text-xs font-black text-emerald-700 transition hover:bg-emerald-100"
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </a>
                  ) : (
                    <span className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-400">
                      <MessageCircle className="h-4 w-4" />
                      Sem WhatsApp
                    </span>
                  )}
                </div>

                {(supplier.email || supplier.phone || supplier.whatsapp) && (
                  <div className="mt-3 space-y-1 text-[11px] font-medium text-slate-500">
                    {supplier.email && (
                      <p className="truncate">
                        E-mail: {supplier.email}
                        {supplier.emailSource === 'global' ? ' · pré-cadastro global' : ''}
                      </p>
                    )}
                    {supplier.phone && <p>Telefone: {supplier.phone}</p>}
                    {supplier.whatsapp && <p>WhatsApp: {supplier.whatsapp}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {editorOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/20 bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-[#00288e] px-6 py-5 text-white">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200">
                  Cadastro de contato
                </p>
                <h2 className="mt-1 text-xl font-black">
                  {editingId ? 'Editar fornecedor' : 'Cadastrar fornecedor'}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-xl border border-white/15 bg-white/10 p-2 transition hover:bg-white/20"
                aria-label="Fechar cadastro"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5 p-6">
              {formError && (
                <div className="flex gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {formError}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-500">
                  Razão social
                </label>
                <input
                  value={form.legalName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, legalName: event.target.value }))
                  }
                  className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-800 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                  placeholder="Razão social do fornecedor"
                  autoFocus
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-500">
                  CNPJ
                </label>
                <input
                  value={form.cnpj}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      cnpj: event.target.value.toUpperCase(),
                    }))
                  }
                  disabled={Boolean(editingId)}
                  className="h-12 w-full rounded-2xl border border-slate-200 px-4 font-mono text-sm font-bold uppercase text-slate-800 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100 disabled:text-slate-500"
                  placeholder="00.000.000/0000-00"
                />
                <p className="mt-1.5 text-[10px] font-medium text-slate-400">
                  O CNPJ é a chave principal para vincular contatos aos empenhos do mesmo fornecedor.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-500">
                    E-mail de contato
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, email: event.target.value }))
                    }
                    className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                    placeholder="contato@fornecedor.com.br"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-500">
                    Telefone de contato
                  </label>
                  <input
                    value={form.phone}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, phone: event.target.value }))
                    }
                    className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                    placeholder="(55) 3333-0000"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-500">
                  WhatsApp
                </label>
                <input
                  value={form.whatsapp}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, whatsapp: event.target.value }))
                  }
                  className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
                  placeholder="(55) 99999-0000"
                />
                <p className="mt-1.5 text-[10px] font-medium text-slate-400">
                  Quando preenchido, a ficha do fornecedor oferece acesso direto à conversa no WhatsApp.
                </p>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeEditor}
                  disabled={saving}
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#00288e] px-6 py-3 text-sm font-black text-white shadow-lg transition hover:bg-[#0038bd] disabled:cursor-wait disabled:opacity-60"
                >
                  {saving ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saving ? 'Salvando...' : 'Salvar fornecedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
