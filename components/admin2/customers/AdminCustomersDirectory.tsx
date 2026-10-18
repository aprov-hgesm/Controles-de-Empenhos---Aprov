'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FileSearch,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, type User } from 'firebase/auth';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

import { auth, googleProvider } from '../../../lib/firebase';
import { HGESM_SECTOR_EMAIL } from '../../../lib/hgesmWorkspace';
import {
  ADMIN2_CUSTOMER_PAGE_SIZE,
  formatCustomerDate,
  type CustomerSearchField,
  type CustomerWorkspaceRecord,
} from '../../../lib/admin2/customers/customerWorkspaceContract';
import {
  readCustomerWorkspacePage,
  type CustomerWorkspaceQuery,
} from '../../../lib/admin2/customers/customerWorkspaceDirectory';
import styles from '../shell/AdminCommandPreview.module.css';
import { AdminCustomerDetailV2 } from './AdminCustomerDetailV2';
import { AdminCommercialCustomers } from './AdminCommercialCustomers';
import type { CommercialCustomer } from '../../../lib/admin2/customers/commercialCustomerContract';

type AuthState = 'checking' | 'signed-out' | 'denied' | 'authorized';

const FIELD_OPTIONS: Array<{ id: CustomerSearchField; label: string }> = [
  { id: 'name', label: 'Nome (prefixo)' },
  { id: 'ug', label: 'UG (6 dígitos)' },
  { id: 'workspaceId', label: 'ID do workspace' },
];

function displayLookupError(error: unknown): string {
  const code = (typeof error === 'object' && error && 'code' in error)
    ? String((error as { code?: unknown }).code || '')
    : '';
  if (code.includes('permission-denied')) {
    return 'Consulta negada pelo Firestore. Confirme que você está autenticado como administrador e que as Rules estão publicadas.';
  }
  if (code.includes('failed-precondition')) {
    return 'A consulta exige um índice Firestore ainda não disponível. Informe o erro ao desenvolvedor; nenhuma configuração será alterada automaticamente.';
  }
  if (code.includes('unauthorized-domain')) {
    return 'Este domínio localhost não está autorizado para login Google no Firebase. Verifique os domínios autorizados antes de continuar.';
  }
  if (code.includes('popup-closed-by-user')) {
    return 'Login cancelado. Clique em Entrar com Google para tentar novamente.';
  }
  return error instanceof Error && error.message ? error.message : 'Não foi possível concluir a consulta administrativa.';
}

function statusLabel(value: CustomerWorkspaceRecord['workspaceStatus']): string {
  return value === 'active' ? 'Ativo' : 'Desativado';
}

export function AdminCustomersDirectory() {
  const [user, setUser] = useState<User | null>(null);
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [authError, setAuthError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [fieldInput, setFieldInput] = useState<CustomerSearchField>('name');
  const [search, setSearch] = useState<CustomerWorkspaceQuery>({ field: 'name', term: '' });
  const [pageIndex, setPageIndex] = useState(0);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const cursors = useRef<Array<QueryDocumentSnapshot<DocumentData> | null>>([null]);
  const [rows, setRows] = useState<CustomerWorkspaceRecord[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState<CustomerWorkspaceRecord | null>(null);
  const [commercialMode, setCommercialMode] = useState(false);
  // Apenas memória React. Nunca copia contatos comerciais para Firestore real,
  // localStorage ou cookies durante a prévia; remonta após refresh.
  const [commercialDrafts, setCommercialDrafts] = useState<CommercialCustomer[]>([]);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, (candidate) => {
      if (!active) return;
      setAuthState('checking');
      setUser(null);
      if (!candidate) {
        setAuthState('signed-out');
        return;
      }
      candidate.getIdTokenResult().then((token) => {
        if (!active) return;
        const firebaseClaim = token.claims.firebase as { sign_in_provider?: string } | undefined;
        const valid = candidate.email?.trim().toLowerCase() === HGESM_SECTOR_EMAIL
          && candidate.emailVerified === true
          && firebaseClaim?.sign_in_provider === 'google.com';
        setUser(valid ? candidate : null);
        setAuthState(valid ? 'authorized' : 'denied');
      }).catch(() => {
        if (active) {
          setAuthError('Não foi possível verificar o provedor e a identidade da sessão Firebase.');
          setAuthState('denied');
        }
      });
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  const openGoogleLogin = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged verificará a conta e o provedor antes de qualquer leitura.
    } catch (error) {
      setAuthError(displayLookupError(error));
    }
  };

  useEffect(() => {
    if (authState !== 'authorized' || !user) {
      setRows([]);
      setHasMore(false);
      return;
    }
    let active = true;
    setLoading(true);
    setLoadError('');
    const cursor = cursors.current[pageIndex] || null;
    readCustomerWorkspacePage(search, cursor).then((result) => {
      if (!active) return;
      setRows(result.rows);
      setHasMore(result.hasMore);
      // O cursor só avança até o último documento que foi realmente exibido.
      cursors.current[pageIndex + 1] = result.lastVisible;
      setLoading(false);
    }).catch((error) => {
      if (!active) return;
      setRows([]);
      setHasMore(false);
      setLoadError(displayLookupError(error));
      setLoading(false);
    });
    return () => { active = false; };
  }, [authState, user, search, pageIndex, refreshVersion]);

  const applySearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = searchInput.trim();
    if (term.length > 100) {
      setLoadError('A pesquisa aceita no máximo 100 caracteres.');
      return;
    }
    if (term && fieldInput === 'ug' && !/^\d{6}$/.test(term)) {
      setLoadError('Informe seis dígitos para pesquisar por UG.');
      return;
    }
    setSelected(null);
    cursors.current = [null];
    setPageIndex(0);
    setSearch({ field: fieldInput, term });
  };

  const refresh = useCallback(() => {
    setSelected(null);
    cursors.current = [null];
    setPageIndex(0);
    setRefreshVersion((version) => version + 1);
  }, []);

  if (authState !== 'authorized') {
    return (
      <section className={styles.sectionCard + ' p-6 sm:p-8'} data-testid="admin2-customers-auth">
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-blue-200 bg-blue-50 text-blue-700">
            {authState === 'checking' ? <Loader2 className="h-7 w-7 animate-spin" /> : <KeyRound className="h-7 w-7" />}
          </div>
          <h2 className="mt-4 text-lg font-extrabold text-[#18345a]">
            {authState === 'checking' ? 'Validando sessão administrativa...' : authState === 'denied' ? 'Acesso administrativo não autorizado' : 'Acesse o diretório real de clientes'}
          </h2>
          <p className="mt-3 text-[12px] leading-6 text-[#617894]">
            {authState === 'denied'
              ? 'Somente a conta fundadora autenticada com Google pode consultar os metadados administrativos de todos os workspaces. A conta atual não possui esse perfil.'
              : 'Para substituir os cadastros fictícios por dados reais, autentique-se com a conta Google fundadora. As regras de segurança do Firestore continuam em vigor.'}
          </p>
          {authError && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">{authError}</p>}
          {authState !== 'checking' && (
            <button type="button" onClick={openGoogleLogin}
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#164893] px-5 py-3 text-xs font-bold text-white shadow-md transition hover:bg-[#2764b6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
              <Mail className="h-4 w-4" aria-hidden="true" /> {authState === 'denied' ? 'Trocar conta Google' : 'Entrar com Google'}
            </button>
          )}
          <p className="mt-4 text-[11px] text-[#8291a5]">Nenhum dado é consultado até a autenticação administrativa ser validada. Não ocorre qualquer alteração de cadastro.</p>
        </div>
      </section>
    );
  }

  if (selected) return <AdminCustomerDetailV2 key={selected.workspaceId} customer={selected} onBack={() => setSelected(null)} />;
  if (commercialMode) return (
    <div className="space-y-4">
      <button type="button" onClick={() => setCommercialMode(false)} data-testid="admin2-existing-workspaces-tab"
        className="inline-flex min-h-10 items-center rounded-xl border border-[#ccdbeb] bg-white px-4 text-[11px] font-extrabold text-[#285b9d] hover:bg-[#edf5ff]">
        Voltar aos workspaces existentes
      </button>
      <AdminCommercialCustomers drafts={commercialDrafts} onChangeDrafts={setCommercialDrafts} />
    </div>
  );

  return (
    <div className="space-y-4" data-testid="admin2-real-customers">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-xl bg-[#174995] px-4 py-2.5 text-[11px] font-bold text-white">Workspaces existentes</span>
        <button type="button" onClick={() => setCommercialMode(true)} data-testid="admin2-commercial-tab"
          className="rounded-xl border border-[#c8d9ee] bg-white px-4 py-2.5 text-[11px] font-bold text-[#275996] transition-colors hover:bg-[#edf5ff]">
          Cadastro de clientes comerciais
        </button>
      </div>
      <section className={styles.sectionCard + ' p-5 sm:p-6'}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className={styles.sectionEyebrow + ' font-mono uppercase'}>CLIENTES 360° · DADOS REAIS</p>
            <h2 className="mt-2 text-[17px] font-extrabold text-[#173558]">Diretório administrativo de workspaces</h2>
            <p className="mt-2 text-[11px] leading-5 text-[#667c98]">Os registros abaixo vêm do Firestore por consultas limitadas a {ADMIN2_CUSTOMER_PAGE_SIZE + 1} documentos por página. Não são criados nem modificados nesta tela.</p>
          </div>
          <button type="button" onClick={refresh} disabled={loading} title="Atualizar página"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#cddded] bg-[#f6faff] px-3 text-[11px] font-bold text-[#245597] hover:bg-[#e9f2ff] disabled:opacity-50">
            <RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} /> Atualizar
          </button>
        </div>
        <form onSubmit={applySearch} className="mt-5 flex flex-col gap-3 lg:flex-row" role="search">
          <select value={fieldInput} onChange={(event) => setFieldInput(event.target.value as CustomerSearchField)}
            aria-label="Campo da pesquisa" className={styles.demoInput + ' h-11 px-3 text-xs lg:w-[190px]'}>
            {FIELD_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#748aa5]" aria-hidden="true" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              maxLength={100}
              placeholder={fieldInput === 'name' ? 'Início do nome do workspace...' : fieldInput === 'ug' ? 'Digite 6 dígitos...' : 'Ex.: hgesm-aprov'}
              aria-label="Pesquisar no diretório administrativo"
              className={styles.demoInput + ' h-11 w-full pl-10 pr-3 text-xs'}
            />
          </div>
          <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#184c9b] px-5 text-xs font-bold text-white transition hover:bg-[#2366bd]">
            <Search className="h-4 w-4" aria-hidden="true" /> Pesquisar
          </button>
        </form>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#71849f]">
          <span>{search.term ? 'Filtro aplicado: ' + FIELD_OPTIONS.find((item) => item.id === search.field)?.label + ' — ' + search.term : 'Listagem geral ordenada por nome'}</span>
          <span>Fonte: workspaces · Leitura sob demanda · Página {pageIndex + 1}</span>
        </div>
        {loadError && <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"><CircleAlert className="h-4 w-4 shrink-0" /> {loadError}</div>}
        <div className={styles.tableWrap + ' mt-4'}>
          <table className="w-full min-w-[650px] border-collapse text-left text-xs">
            <thead className="bg-[#e9f1fc] text-[10px] uppercase tracking-wide text-[#526987]">
              <tr>
                <th scope="col" className="px-4 py-3">Workspace / Organização</th>
                <th scope="col" className="px-4 py-3">UG</th>
                <th scope="col" className="px-4 py-3">Situação</th>
                <th scope="col" className="px-4 py-3">Atualizado</th>
                <th scope="col" className="px-4 py-3 text-right">Ficha</th>
              </tr>
            </thead>
            <tbody>
              {!loading && rows.map((customer) => (
                <tr key={customer.workspaceId} className="border-t border-[#e4ebf4] text-[#526580] transition-colors hover:bg-[#f0f6ff]">
                  <td className="px-4 py-4">
                    <p className="font-bold text-[#1b365b]">{customer.name}</p>
                    <p className="mt-1 text-[11px] text-[#7c8ba0]">{customer.organizationName || customer.sectionName || 'Sem organização cadastrada'}</p>
                  </td>
                  <td className="px-4 py-4 font-mono">{customer.ug || '—'}</td>
                  <td className="px-4 py-4">
                    <span className={customer.workspaceStatus === 'active' ? 'rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700' : 'rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800'}>
                      {statusLabel(customer.workspaceStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-4">{formatCustomerDate(customer.updatedAt)}</td>
                  <td className="px-4 py-4 text-right">
                    <button type="button" onClick={() => setSelected(customer)}
                      aria-label={'Abrir ficha administrativa de ' + customer.name}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#c6d9f1] bg-white px-3 py-2 text-[11px] font-bold text-[#245ca6] hover:bg-blue-50">
                      Ver ficha <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {loading && <tr><td colSpan={5} className="px-4 py-12 text-center text-[#66809e]"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Consultando página no Firestore...</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-[#66809e]"><FileSearch className="mx-auto mb-2 h-6 w-6" /> Nenhum workspace encontrado para esta consulta.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-[#7789a2]">{loading ? 'Carregando...' : rows.length + ' registro(s) nesta página'} · Sem listener em tempo real</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPageIndex((index) => Math.max(0, index - 1))}
              disabled={loading || pageIndex === 0}
              className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#cad9ec] bg-white px-3 text-xs font-bold text-[#315c90] disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" /> Anterior
            </button>
            <button type="button" onClick={() => { if (hasMore && !loading) setPageIndex((index) => index + 1); }}
              disabled={loading || !hasMore}
              className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#cad9ec] bg-white px-3 text-xs font-bold text-[#315c90] disabled:opacity-40">
              Próxima <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="mt-5 flex gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-[11px] leading-5 text-[#4c6d99]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>Este é um diretório baseado em <strong>workspaces existentes</strong>, não uma base de clientes comerciais independente. Os dados são protegidos pelas Rules de administração. A busca por nome é por prefixo, respeitando maiúsculas/minúsculas do Firestore. Nenhum registro é criado por esta consulta.</p>
        </div>
      </section>
    </div>
  );
}
