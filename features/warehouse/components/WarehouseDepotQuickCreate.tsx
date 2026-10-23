'use client';

import { useState, type FormEvent } from 'react';
import { createWarehouseDepot, type WarehouseDepotListItem } from '../../../lib/warehouse/locationRepository';

/**
 * Entrada unica de deposito no Croqui 2D.
 * O servidor cadastra apenas o deposito; locais, portas e layout passam
 * exclusivamente pelo editor transacional, sem sequencias de writes parciais.
 */
export function WarehouseDepotQuickCreate({
  workspaceId, depots, onRegistered,
}: {
  workspaceId: string;
  depots: WarehouseDepotListItem[];
  onRegistered: (depotId: string) => Promise<void>;
}) {
  const [code, setCode] = useState(() => {
    const used = new Set(depots.map(row => row.depot.code));
    for (let i = 1; i <= 999; i++) {
      const next = 'DEP-' + String(i).padStart(3, '0');
      if (!used.has(next)) return next;
    }
    return '';
  });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visualType, setVisualType] = useState<'STANDARD' | 'CONTAINER' | 'COLD_CONTAINER'>('STANDARD');
  const [sizeProfile, setSizeProfile] = useState<'SMALL' | 'MEDIUM' | 'LARGE'>('MEDIUM');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const depot = await createWarehouseDepot(workspaceId, {
        code, name, description: description.trim() || null, visualType, sizeProfile,
      });
      await onRegistered(depot.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally { setBusy(false); }
  }
  return <form onSubmit={event => void submit(event)}
    data-testid="warehouse-depot-quick-create"
    className="space-y-4 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
    <div>
      <h3 className="text-base font-extrabold text-[#00288e]">Cadastrar depósito</h3>
      <p className="text-xs text-slate-600">Cadastre o ambiente uma vez. Depois configure dimensões, locais e subposições no Croqui 2D.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-bold text-slate-700">Código
        <input required maxLength={32} value={code} onChange={event => setCode(event.target.value.toUpperCase())}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
      </label>
      <label className="text-xs font-bold text-slate-700">Nome
        <input required minLength={2} maxLength={120} value={name}
          onChange={event => setName(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"/>
      </label>
      <label className="text-xs font-bold text-slate-700 sm:col-span-2">Descrição (opcional)
        <input maxLength={240} value={description} onChange={event => setDescription(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"/>
      </label>
      <label className="text-xs font-bold text-slate-700">Tipo
        <select value={visualType} onChange={event => setVisualType(event.target.value as typeof visualType)}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
          <option value="STANDARD">Depósito padrão</option>
          <option value="CONTAINER">Contêiner</option>
          <option value="COLD_CONTAINER">Contêiner frigorífico</option>
        </select>
      </label>
      <label className="text-xs font-bold text-slate-700">Porte
        <select value={sizeProfile} onChange={event => setSizeProfile(event.target.value as typeof sizeProfile)}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
          <option value="SMALL">Pequeno</option>
          <option value="MEDIUM">Médio</option>
          <option value="LARGE">Grande</option>
        </select>
      </label>
    </div>
    {error && <p role="alert" className="rounded-lg bg-amber-50 p-2 text-xs font-bold text-amber-800">{error}</p>}
    <button type="submit" disabled={busy} data-testid="warehouse-depot-quick-create-submit"
      className="rounded-xl bg-[#00288e] px-5 py-3 text-xs font-extrabold text-white disabled:opacity-50">
      {busy ? 'Cadastrando…' : 'Cadastrar e abrir Croqui 2D'}
    </button>
  </form>;
}
