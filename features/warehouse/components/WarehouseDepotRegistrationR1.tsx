'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Ruler } from 'lucide-react';
import {
  createWarehouseDepot,
  createWarehouseLocation,
  listWarehouseDepots,
  listWarehouseLocations,
  type WarehouseDepotListItem,
  type WarehouseLocationListItem,
} from '../../../lib/warehouse/locationRepository';
import { createWarehouseDepotLayoutObject } from '../../../lib/warehouse/layout';
import { getActiveWarehouseDepotLayout, saveWarehouseDepotLayoutVersion } from '../../../lib/warehouse/layoutRepository';
import {
  DEPOT_KINDS,
  planDepotDraft,
  setDepotUnitCount,
  type DepotDraft,
  type DepotUnit,
  type DepotUnitKind,
  type ShelfStyle,
} from '../../../lib/warehouse/depotRegistration';

interface Props {
  workspaceId: string;
  depots: WarehouseDepotListItem[];
  onRegistered: (depotId: string) => Promise<void>;
}
const field = 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';
function suggestCode(rows: WarehouseDepotListItem[]): string {
  const occupied = new Set(rows.map((row) => row.depot.code));
  for (let n = 1; n <= 999; n++) {
    const code = 'DEP-' + String(n).padStart(3, '0');
    if (!occupied.has(code)) return code;
  }
  return '';
}
function emptyDraft(depots: WarehouseDepotListItem[]): DepotDraft {
  return { code: suggestCode(depots), name: '', description: '', lengthCm: 1000, widthCm: 620, units: [] };
}
export function WarehouseDepotRegistrationR1({ workspaceId, depots, onRegistered }: Props) {
  const [draft, setDraft] = useState<DepotDraft>(() => emptyDraft(depots));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState('');
  const counts = useMemo(() => Object.fromEntries(DEPOT_KINDS.map((model) =>
    [model.kind, draft.units.filter((unit) => unit.kind === model.kind).length]
  )) as Record<DepotUnitKind, number>, [draft.units]);
  const preview = useMemo(() => {
    try { return { units: planDepotDraft(draft), error: '' }; }
    catch (error) { return { units: [], error: error instanceof Error ? error.message : String(error) }; }
  }, [draft]);

  function updateUnit(kind: DepotUnitKind, index: number, patch: Partial<DepotUnit>) {
    setDraft((current) => {
      let sequence = -1;
      return { ...current, units: current.units.map((unit) => {
        if (unit.kind !== kind) return unit;
        sequence++;
        return sequence === index ? { ...unit, ...patch } : unit;
      }) };
    });
  }
  async function registerDepot() {
    if (busy) return;
    setStatus('');
    if (preview.error) { setStatus(preview.error); return; }
    setBusy(true);
    let confirmed = 0;
    try {
      // Preflight denies near-capacity lists so duplicate checks cannot silently miss entries.
      const [remoteDepots, remoteLocations] = await Promise.all([
        listWarehouseDepots(workspaceId, 250), listWarehouseLocations(workspaceId, 500),
      ]);
      if (remoteDepots.length >= 250 || remoteLocations.length + draft.units.length
        + draft.units.reduce((sum, unit) => sum + unit.shelfCount, 0) >= 500) {
        throw new Error('O catálogo aproxima-se do limite de consulta (250/500). Contate o administrador antes de cadastrar.');
      }
      const depotCode = draft.code.trim().toUpperCase();
      const matching = remoteDepots.filter((row) => row.depot.code === depotCode);
      if (matching.length > 1 || matching.some((row) =>
        row.depot.status !== 'active' || row.depot.name !== draft.name.trim())) {
        throw new Error('Código do depósito já utilizado com outra identidade. Informe um código não usado.');
      }
      const existingDepot = matching[0]?.depot;
      if (existingDepot && remoteLocations.some((row) =>
        row.location.depotId === existingDepot.id && row.location.status === 'active'
        && (row.location.kind === 'LOCAL'
          ? !preview.units.some((unit) => unit.code === row.location.code)
          : !preview.units.some((unit) => unit.kind === 'SHELF'
            && Array.from({ length: unit.shelfCount }, (_, i) => 'PRAT-' + String(i + 1).padStart(2, '0'))
              .includes(row.location.code))))) {
        throw new Error('O depósito possui estrutura fora deste formulário. Não é permitido sobrescrever locais antigos.');
      }
      if (existingDepot && await getActiveWarehouseDepotLayout(workspaceId, existingDepot.id)) {
        throw new Error('Depósito já possui croqui ativo. Abra Croquis para realizar alterações.');
      }
      setProgress('Etapa 1/3 · Identificando depósito');
      const depot = existingDepot || await createWarehouseDepot(workspaceId, {
        code: depotCode, name: draft.name, description: draft.description || null,
      });
      const prior = remoteLocations.filter((row) => row.location.depotId === depot.id);
      const layouts = [];
      for (const [index, unit] of preview.units.entries()) {
        setProgress('Etapa 2/3 · Local ' + (index + 1) + ' de ' + preview.units.length);
        const matches = prior.filter((row) =>
          row.location.kind === 'LOCAL' && row.location.code === unit.code);
        if (matches.length > 1 || matches.some((row) =>
          row.location.status !== 'active' || row.location.name !== unit.name
          || row.location.description !== unit.description)) {
          throw new Error('Conflito de identidade no Local ' + unit.code + '.');
        }
        const local = matches[0]?.location || await createWarehouseLocation(workspaceId, {
          kind: 'LOCAL', depotId: depot.id, code: unit.code, name: unit.name,
          description: unit.description,
        });
        confirmed++;
        if (unit.kind === 'SHELF') {
          for (let shelf = 1; shelf <= unit.shelfCount; shelf++) {
            const childCode = 'PRAT-' + String(shelf).padStart(2, '0');
            const childName = 'Prateleira ' + String(shelf).padStart(2, '0');
            const childMatches = prior.filter((row) =>
              row.location.kind === 'SUBPOSITION' && row.location.code === childCode
              && row.location.parentLocationId === local.id);
            if (childMatches.length > 1 || childMatches.some((row) =>
              row.location.status !== 'active' || row.location.name !== childName)) {
              throw new Error('Conflito no código da prateleira ' + unit.code + ' → ' + childCode + '.');
            }
            if (!childMatches.length) {
              await createWarehouseLocation(workspaceId, {
                kind: 'SUBPOSITION', depotId: depot.id, parentLocationId: local.id,
                code: childCode, name: childName, description: 'Prateleira de ' + unit.name,
              });
            }
          }
        }
        layouts.push(createWarehouseDepotLayoutObject({
          kind: unit.kind, label: unit.code + ' · ' + unit.name,
          x: unit.x, y: unit.y, width: unit.widthCm, height: unit.depthCm,
          rotation: 0, layer: index + 1, elevation: 1,
          visualVariant: 'solid', warehouseLocationId: local.id,
        }));
      }
      setProgress('Etapa 3/3 · Persistindo geometria em centímetros');
      if (await getActiveWarehouseDepotLayout(workspaceId, depot.id)) {
        throw new Error('Já existe croqui ativo para este depósito. A publicação do croqui não foi repetida.');
      }
      await saveWarehouseDepotLayoutVersion(workspaceId, {
        depotId: depot.id, name: 'Croqui principal',
        logicalWidth: draft.widthCm, logicalHeight: draft.lengthCm, objects: layouts,
        baseLayoutId: null, expectedVersion: null,
      });
      await onRegistered(depot.id);
      setDraft(emptyDraft(remoteDepots.concat([{ depot, createdAt: null, updatedAt: null }])));
      setProgress('');
      setStatus('Cadastro concluído. As medidas individuais foram preservadas; abra Croquis para ajustar a posição dos objetos.');
    } catch (error) {
      setProgress('');
      setStatus('Cadastro não concluído (' + confirmed + ' locais processados). Nenhuma estrutura será apagada. Para retomar sem duplicar, mantenha este formulário e reenvie. ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setBusy(false);
    }
  }
  const shelves = draft.units.reduce((n, unit) => n + unit.shelfCount, 0);
  return <section className="space-y-5 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm" data-testid="warehouse-depot-registration-r1">
    <header className="flex items-center gap-3">
      <div className="rounded-xl bg-blue-50 p-2 text-[#00288e]"><ClipboardList className="h-5 w-5"/></div>
      <div><h2 className="text-lg font-black text-[#00288e]">Cadastramento de Depósito</h2>
        <p className="text-xs text-slate-500">Formulário oficial: quantidades, medidas individuais em cm e croqui inicial.</p></div>
    </header>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-xs font-bold text-slate-600">Código do depósito
        <input aria-label="Código do depósito" className={field} value={draft.code}
          onChange={(e) => setDraft((v) => ({ ...v, code: e.target.value }))} placeholder="DEP-001"/></label>
      <label className="space-y-1 text-xs font-bold text-slate-600">Nome do depósito
        <input aria-label="Nome do depósito" className={field} value={draft.name}
          onChange={(e) => setDraft((v) => ({ ...v, name: e.target.value }))} placeholder="Depósito de gêneros secos"/></label>
      <label className="space-y-1 text-xs font-bold text-slate-600">Comprimento interno (cm)
        <input className={field} type="number" min={240} max={50000} step={1} value={draft.lengthCm}
          onChange={(e) => setDraft((v) => ({ ...v, lengthCm: Number(e.target.value) }))}/></label>
      <label className="space-y-1 text-xs font-bold text-slate-600">Largura interna (cm)
        <input className={field} type="number" min={240} max={50000} step={1} value={draft.widthCm}
          onChange={(e) => setDraft((v) => ({ ...v, widthCm: Number(e.target.value) }))}/></label>
      <label className="space-y-1 text-xs font-bold text-slate-600 sm:col-span-2">Descrição (opcional)
        <input className={field} maxLength={240} value={draft.description}
          onChange={(e) => setDraft((v) => ({ ...v, description: e.target.value }))}/></label>
    </div>
    {DEPOT_KINDS.map((model) => {
      const instances = draft.units.filter((unit) => unit.kind === model.kind);
      return <section key={model.kind} className="rounded-xl border border-blue-100 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-black text-[#00288e]">{model.label}</h3>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">Quantidade
            <input aria-label={'Quantidade de ' + model.label} className={field + ' !w-20'} type="number" min={0} max={120} step={1}
              value={counts[model.kind]} onChange={(event) => {
                const next = Math.min(120, Math.max(0, Number(event.target.value) || 0));
                setDraft((current) => ({ ...current, units: setDepotUnitCount(current.units, model.kind, next) }));
              }}/>
          </label>
        </div>
        {instances.map((unit, i) => <div key={model.kind + i} className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="self-center text-xs font-black text-slate-700">{model.prefix}-{String(i + 1).padStart(2, '0')}</div>
          {([
            ['widthCm', 'Largura (cm)'],
            ['depthCm', 'Profundidade (cm)'],
            ['heightCm', 'Altura (cm)'],
          ] as const).map(([key, title]) =>
            <label key={key} className="text-[11px] font-semibold text-slate-500">{title}
              <input className={field} type="number" min={12} max={50000} step={1}
                value={unit[key]} onChange={(e) => updateUnit(model.kind, i, { [key]: Number(e.target.value) })}/></label>)}
          {model.kind === 'SHELF' && <>
            <label className="text-[11px] font-semibold text-slate-500">Prateleiras desta estante
              <input className={field} type="number" min={0} max={30} step={1} value={unit.shelfCount}
                onChange={(e) => updateUnit(model.kind, i, { shelfCount: Number(e.target.value) })}/></label>
            <label className="text-[11px] font-semibold text-slate-500">Tipo da estante
              <select className={field} value={unit.shelfStyle}
                onChange={(e) => updateUnit(model.kind, i, { shelfStyle: e.target.value as ShelfStyle })}>
                <option value="METAL">Metálica</option>
                <option value="INOX">Inox</option>
                <option value="WOOD">Madeira</option>
              </select></label>
          </>}
        </div>)}
      </section>;
    })}
    <div className="rounded-xl bg-blue-50 p-3 text-xs font-semibold text-blue-900">
      <Ruler className="mr-2 inline h-4 w-4"/>Resumo: {draft.units.length} locais e {shelves} prateleiras, em {draft.widthCm} × {draft.lengthCm} cm.
      Cada unidade possui suas próprias medidas; dimensões sugeridas são editáveis.
    </div>
    {preview.error && <p className="text-xs font-semibold text-rose-700">{preview.error}</p>}
    {status && <p role="status" className="rounded-xl border border-slate-200 p-3 text-xs text-slate-700">{status}</p>}
    {progress && <p className="text-xs font-semibold text-blue-700">{progress}</p>}
    <button type="button" onClick={() => void registerDepot()} data-testid="warehouse-register-full-depot"
      disabled={busy || Boolean(preview.error)}
      className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#00288e] px-4 text-xs font-black text-white disabled:opacity-40">
      <CheckCircle2 className="h-4 w-4"/>{busy ? 'Cadastrando…' : 'Cadastrar depósito e preparar croqui'}
    </button>
    <p className="text-[11px] text-slate-500">A nova operação não altera quantidades de estoque. Em caso de interrupção, use o mesmo formulário para tentar concluir os registros faltantes.</p>
  </section>;
}
