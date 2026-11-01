'use client';

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { User } from 'firebase/auth';
import type { Empenho } from '../../../lib/types';
import { FornecedoresView } from '../../fornecedores/components/FornecedoresView';
import { loadAlmoxCatalog } from './catalogLoader';
import type { AlmoxCatalogProjection, AlmoxItemRow } from './catalogModel';

export type AlmoxCatalogSection = 'fornecedores' | 'consulta-itens' | 'materiais';
interface Props {
  /** Obtidos de WarehouseAccessBoundary no W9; nunca de querystring. */
  user: User;
  workspaceId: string;
  ug: string;
  section: AlmoxCatalogSection;
}
const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const quantity = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
const classes = {
  input: 'w-full rounded-xl border border-slate-600 bg-[#101e3b] p-3 text-sm text-white outline-none focus:border-cyan-400',
  card: 'rounded-xl border border-slate-700 bg-[#0d1c38] p-4',
};
function LinkNotice({ item }: { item: AlmoxItemRow }) {
  const status: Record<AlmoxItemRow['linkStatus'], string> = {
    CONFIRMED: 'Vínculo logístico confirmado',
    NO_LINK: 'Sem vínculo; descrição não autoriza associação',
    MISSING: 'Material vinculado não encontrado',
    INACTIVE: 'Material vinculado inativo',
    INCOMPATIBLE_UNIT: 'Unidade incompatível; revisar conversão',
  };
  return (
    <span className={item.linkStatus === 'CONFIRMED' ? 'text-emerald-300' : 'text-amber-300'}>
      {status[item.linkStatus]}
    </span>
  );
}
/**
 * Painel independente para montagem pelo W9 (sem editar navegação W5).
 * Reaproveita a tela original de edição de fornecedores sob a sessão já validada.
 */
export function AlmoxCatalogoView({ user, workspaceId, ug, section }: Props) {
  const [data, setData] = useState<AlmoxCatalogProjection | null>(null);
  const [empenhos, setEmpenhos]: [Empenho[], Dispatch<SetStateAction<Empenho[]>>] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [supplierEditor, setSupplierEditor] = useState(false);
  const [toast, setToast] = useState('');
  const [filter, setFilter] = useState<'todos' | 'com-saldo' | 'pendentes'>('todos');

  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    setLoading(true);
    setSupplierEditor(false);
    void loadAlmoxCatalog(user, workspaceId, ug)
      .then(({ projection, empenhos: loaded }) => {
        if (!active) return;
        setData(projection);
        setEmpenhos(loaded);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        console.error('ALMOX_W7_CATALOG_READ_FAILED', cause);
        setError('Não foi possível consultar os dados autorizados. Verifique seu acesso e tente novamente.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, workspaceId, ug]);

  const needle = search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
  const matches = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR').includes(needle);
  const suppliers = useMemo(() => data?.suppliers.filter((row) =>
    !needle || [row.name, row.cnpj, row.email, ...row.aliases, ...row.empenhoIds].some(matches)) || [],
    // A função matches é intencionalmente reavaliada a cada busca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, needle]);
  const items = useMemo(() => data?.items.filter((row) => {
    if (filter === 'com-saldo' && row.balance <= 0) return false;
    if (filter === 'pendentes' && row.linkStatus === 'CONFIRMED') return false;
    return !needle || [row.name, row.unit, row.empenhoId, row.supplierName, row.materialId || ''].some(matches);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }) || [], [data, needle, filter]);
  const materials = useMemo(() => data?.materials.filter((row) =>
    !needle || [row.description, row.materialId, row.unit, ...row.aliases,
      ...row.positions.map((p) => [p.depotName, p.locationCode, p.subpositionCode || ''].join(' '))]
      .some(matches)) || [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, needle]);

  const showToast = (message: string, type?: 'success' | 'error' | 'info') => {
    setToast((type === 'error' ? 'Erro: ' : '') + message);
  };
  if (loading) return <p role="status" className="text-sm text-slate-300">Carregando catálogo do Almoxarifado…</p>;
  if (error || !data) return <p role="alert" className="rounded-xl border border-rose-700 p-4 text-sm text-rose-200">{error || 'Acesso indisponível.'}</p>;

  return (
    <div className="mt-5 space-y-5" data-testid={'almox-w7-' + section}>
      <div className="rounded-xl border border-cyan-800/60 bg-cyan-950/30 p-3 text-xs text-cyan-100">
        Consulta auxiliar do workspace autorizado · UG {ug}.
        Empenhos e estoque físico são fontes independentes; esta tela não movimenta materiais e não registra no SISCOFIS.
        {!data.coverageComplete && (
          <strong className="mt-1 block text-amber-200">
            Cobertura física parcial: limite de leitura atingido. Quantidades e posições podem estar incompletas.
          </strong>
        )}
      </div>
      {toast && <div role="status" className="rounded-lg border border-blue-600/50 p-3 text-sm text-blue-100">{toast}</div>}
      {section === 'fornecedores' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-300">{data.suppliers.length} fornecedor(es) no workspace</p>
          <button type="button" onClick={() => setSupplierEditor((value) => !value)}
            className="rounded-lg border border-cyan-600 px-4 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-900/50">
            {supplierEditor ? 'Voltar à consulta' : 'Gerenciar contatos (módulo existente)'}
          </button>
        </div>
      )}
      {section === 'fornecedores' && supplierEditor ? (
        <div className="rounded-xl bg-white p-3 text-slate-900">
          <FornecedoresView user={user} empenhos={empenhos} setEmpenhos={setEmpenhos} showToast={showToast} />
        </div>
      ) : (
        <>
          <input value={search} onChange={(event) => setSearch(event.target.value)}
            aria-label="Pesquisar no catálogo do Almoxarifado"
            placeholder={section === 'fornecedores' ? 'Buscar fornecedor, CNPJ, empenho ou contato…'
              : section === 'consulta-itens' ? 'Buscar descrição, empenho, fornecedor ou material…'
                : 'Buscar material, depósito, estante ou prateleira…'}
            className={classes.input} />
          {section === 'fornecedores' && (
            <div className="grid gap-3">
              {suppliers.map((supplier) => {
                const supplied = data.items.filter((item) => item.supplierKey === supplier.key);
                return (
                  <article key={supplier.key} className={classes.card}>
                    <h3 className="text-base font-bold text-white">{supplier.name}</h3>
                    <p className="text-xs text-slate-400">CNPJ: {supplier.cnpj || 'não informado'}</p>
                    <p className="mt-2 break-all text-xs text-slate-200">
                      {supplier.email || 'Sem e-mail'} · {supplier.phone || 'Sem telefone'} · WhatsApp: {supplier.whatsapp || 'não informado'}
                    </p>
                    <p className="mt-2 text-sm text-cyan-200">
                      {supplier.activeEmpenhoIds.length} empenho(s) ativo(s) · {supplier.empenhoIds.length} total ·
                      saldo financeiro {money(supplier.financialBalance)}
                    </p>
                    {supplier.empenhoIds.length > 0 && (
                      <p className="mt-1 text-xs text-slate-300">Empenhos: {supplier.empenhoIds.join(', ')}</p>
                    )}
                    <details className="mt-3 text-sm">
                      <summary className="cursor-pointer text-cyan-200">Itens fornecidos ({supplied.length})</summary>
                      <ul className="mt-2 space-y-1 text-xs text-slate-200">
                        {supplied.map((item) => (
                          <li key={item.key}>{item.name} · {item.empenhoId} · saldo do empenho {quantity(item.balance)} {item.unit}</li>
                        ))}
                      </ul>
                    </details>
                  </article>
                );
              })}
              {suppliers.length === 0 && <p className="text-sm text-slate-400">Nenhum fornecedor encontrado.</p>}
            </div>
          )}
          {section === 'consulta-itens' && (
            <>
              <select aria-label="Filtrar itens" className={classes.input} value={filter}
                onChange={(event) => setFilter(event.target.value as typeof filter)}>
                <option value="todos">Todos os itens</option>
                <option value="com-saldo">Com saldo de empenho</option>
                <option value="pendentes">Vínculo logístico pendente</option>
              </select>
              <div className="grid gap-3">
                {items.map((item) => {
                  const linked = item.linkStatus === 'CONFIRMED'
                    ? data.materials.find((material) => material.materialId === item.materialId) : null;
                  return (
                    <article key={item.key} className={classes.card}>
                      <h3 className="font-bold text-white">{item.name}</h3>
                      <p className="mt-1 text-xs text-slate-300">
                        {item.empenhoId} · Fornecedor: {item.supplierName} · Situação: {item.empenhoStatus}
                      </p>
                      <p className="mt-2 text-sm text-slate-200">
                        Empenhado: {quantity(item.quantity)} {item.unit} · Recebido: {quantity(item.received)} {item.unit}
                      </p>
                      <p className="text-sm font-semibold text-cyan-200">
                        Saldo do empenho: {quantity(item.balance)} {item.unit} ({money(item.balanceValue)})
                      </p>
                      <p className="mt-1 text-xs"><LinkNotice item={item} /></p>
                      {linked && (
                        <p className="mt-1 text-xs text-slate-300">
                          Warehouse: {linked.description} · saldo físico localizado:
                          {' '}{quantity(linked.physicalQuantity)} {linked.unit}
                          {!data.coverageComplete && ' (parcial)'}
                          {' '}— independente do empenho
                        </p>
                      )}
                    </article>
                  );
                })}
                {items.length === 0 && <p className="text-sm text-slate-400">Nenhum item encontrado.</p>}
              </div>
            </>
          )}
          {section === 'materiais' && (
            <div className="grid gap-3">
              {materials.map((material) => (
                <article key={material.materialId} className={classes.card}>
                  <h3 className="font-bold text-white">{material.description}</h3>
                  <p className="text-xs text-slate-400">{material.materialId} · {material.status === 'active' ? 'Ativo' : 'Inativo'}</p>
                  <p className="mt-2 text-sm text-cyan-200">
                    Saldo físico localizado: {quantity(material.physicalQuantity)} {material.unit}
                    {!data.coverageComplete && ' (parcial)'}
                  </p>
                  <p className="text-xs text-slate-300">{material.financialItemKeys.length} item(ns) empenhado(s) com vínculo validado</p>
                  <details className="mt-2 text-xs text-slate-200">
                    <summary className="cursor-pointer text-cyan-100">Posições físicas ({material.positions.length})</summary>
                    <ul className="mt-2 space-y-1">
                      {material.positions.map((p, idx) => (
                        <li key={[p.depotId, p.locationId, p.subpositionId || '', idx].join(':')}>
                          {p.depotName} / {p.locationCode} {p.subpositionCode ? '/ ' + p.subpositionCode : ''}
                          {' '}— {quantity(p.quantity)} {p.unit}
                        </li>
                      ))}
                    </ul>
                    {material.positions.length === 0 && <p className="mt-2">Sem posição ativa com saldo localizado nesta consulta.</p>}
                  </details>
                </article>
              ))}
              {materials.length === 0 && <p className="text-sm text-slate-400">Nenhum material encontrado.</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
