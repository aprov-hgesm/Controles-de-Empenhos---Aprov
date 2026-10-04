'use client';

import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  LoaderCircle,
  MapPin,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getWarehouseBarcodeByCode } from '../../../lib/warehouse/barcodeRepository';
import {
  summarizeWarehouseInventoryItems,
  type WarehouseInventoryItem,
} from '../../../lib/warehouse/inventory';
import {
  beginWarehouseInventoryReview,
  cancelWarehouseInventory,
  confirmWarehouseInventory,
  listWarehouseInventoryItems,
  listWarehouseInventorySessions,
  reopenWarehouseInventoryCounting,
  saveWarehouseInventoryCount,
  startWarehouseInventory,
  type WarehouseInventorySessionRecord,
} from '../../../lib/warehouse/inventoryRepository';
import type { WarehouseStockPositionResolveResult } from '../../../lib/warehouse/locationBarcode';
import { resolveWarehouseStockPositionBarcode } from '../../../lib/warehouse/locationBarcodeResolver';
import { classifyWarehouseMobileLocationScan } from '../../../lib/warehouse/mobileLocationScan';
import {
  classifyWarehouseMobileInventoryProductScan,
  findWarehouseMobileInventoryItem,
  warehouseMobileInventoryItemsAtPosition,
  warehouseMobileInventoryPositionDisposition,
  warehouseMobileInventoryScopeFromPosition,
  warehouseMobileInventorySessionMode,
} from '../../../lib/warehouse/mobileInventory';
import type { WarehouseMobileScanEvent } from '../../../lib/warehouse/mobileScanner';
import type { WarehouseMaterial } from '../../../lib/warehouse/material';
import { getWarehouseMaterial } from '../../../lib/warehouse/materialRepository';
import { useWarehouseWorkspaceContext } from '../components/WarehouseModuleContext';
import { WarehouseMobileScanner } from './WarehouseMobileScanner';

type ResolvedPosition = Extract<
  WarehouseStockPositionResolveResult,
  { ok: true }
>['value'];

function formatQuantity(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 6,
  }).format(value);
}

function scopeLabel(record: WarehouseInventorySessionRecord): string {
  const scope = record.session.scope;
  if (scope.kind === 'TOTAL') return 'Inventário total';
  if (scope.kind === 'DEPOT') return 'Depósito · ' + scope.depotId;
  if (scope.kind === 'LOCATION') return 'Local · ' + scope.locationId;
  return 'Subposição · ' + scope.subpositionId;
}

function statusLabel(status: WarehouseInventorySessionRecord['session']['status']): string {
  const labels: Record<WarehouseInventorySessionRecord['session']['status'], string> = {
    OPENING: 'Abrindo',
    COUNTING: 'Contagem',
    REVIEW: 'Revisão',
    CONFIRMING: 'Confirmando',
    RECONCILIATION_REQUIRED: 'Reconciliação necessária',
    CONFIRMED: 'Confirmado',
    CANCELLED: 'Cancelado',
  };
  return labels[status];
}

function positionLabel(value: ResolvedPosition): string {
  if (value.position.kind === 'LOCATION') {
    return [
      value.depot.code || value.depot.name,
      value.location?.code || value.position.locationId,
    ].filter(Boolean).join(' · ');
  }
  if (value.position.kind === 'SUBPOSITION') {
    return [
      value.depot.code || value.depot.name,
      value.parentLocation?.code || value.position.locationId,
      value.location?.code || value.position.subpositionId,
    ].filter(Boolean).join(' · ');
  }
  return 'Posição não física';
}

function locationError(error: string): string {
  if (error === 'DEPOT_NOT_STOCK_POSITION') {
    return 'Depósito não é posição de estoque. Leia um LOCAL ou SUBPOSIÇÃO.';
  }
  if (error === 'WORKSPACE_MISMATCH' || error === 'UG_MISMATCH') {
    return 'A etiqueta pertence a outro workspace/UG.';
  }
  if (error === 'ENTITY_INACTIVE') return 'A posição está inativa.';
  if (error === 'ENTITY_NOT_FOUND') return 'A posição não existe mais.';
  if (error === 'HIERARCHY_INVALID' || error === 'ENTITY_KIND_MISMATCH') {
    return 'A hierarquia física da etiqueta não é válida.';
  }
  return 'A posição não pôde ser revalidada no cadastro autoritativo.';
}

function inventoryError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('WAREHOUSE_INVENTORY_SCOPE_EMPTY')) {
    return 'Não existe saldo físico positivo nesta posição para abrir um inventário.';
  }
  if (raw.includes('WAREHOUSE_INVENTORY_COUNT_INCOMPLETE')) {
    return 'Ainda existem itens pendentes ou obsoletos. Conclua a contagem antes da revisão.';
  }
  if (raw.includes('WAREHOUSE_INVENTORY_CONCURRENT_CHANGE')) {
    return 'O estoque mudou depois do snapshot. Nenhum ajuste foi aplicado ao item obsoleto.';
  }
  if (raw.includes('WAREHOUSE_INVENTORY_NOT_COUNTING')) {
    return 'A sessão não está mais em contagem. Atualize o estado antes de salvar.';
  }
  if (raw.includes('WAREHOUSE_INVENTORY_FINALIZED')) {
    return 'A sessão já foi finalizada e não pode ser regravada.';
  }
  if (raw.includes('WAREHOUSE_INVENTORY_SCOPE_MISMATCH')) {
    return 'A operação foi bloqueada por incompatibilidade de workspace/UG.';
  }
  return 'A operação de inventário não pôde ser concluída. Atualize a sessão e tente novamente.';
}

function materialUnit(material: WarehouseMaterial | null | undefined): string {
  if (!material) return '';
  return material.unit.label || material.unit.code;
}

export function WarehouseMobileInventory() {
  const workspace = useWarehouseWorkspaceContext();
  const requestRef = useRef(0);
  const [sessions, setSessions] = useState<WarehouseInventorySessionRecord[]>([]);
  const [selectedSession, setSelectedSession] = useState<WarehouseInventorySessionRecord | null>(null);
  const [items, setItems] = useState<WarehouseInventoryItem[]>([]);
  const [materials, setMaterials] = useState<Record<string, WarehouseMaterial>>({});
  const [position, setPosition] = useState<ResolvedPosition | null>(null);
  const [selectedItem, setSelectedItem] = useState<WarehouseInventoryItem | null>(null);
  const [countText, setCountText] = useState('');
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const next = await listWarehouseInventorySessions(workspace.workspaceId, 60);
      setSessions(next);
      return next;
    } finally {
      setLoadingSessions(false);
    }
  }, [workspace.workspaceId]);

  useEffect(() => {
    void loadSessions().catch(() => {
      setMessage('Não foi possível carregar as sessões de inventário.');
    });
  }, [loadSessions]);

  const loadSession = useCallback(async (record: WarehouseInventorySessionRecord) => {
    setWorking(true);
    setMessage(null);
    setSuccess(null);
    setReviewAcknowledged(false);
    setPosition(null);
    setSelectedItem(null);
    setCountText('');
    try {
      const records = await listWarehouseInventoryItems(
        workspace.workspaceId,
        record.session.id
      );
      setSelectedSession(record);
      setItems(records.map((entry) => entry.item));
    } catch (error) {
      setMessage(inventoryError(error));
    } finally {
      setWorking(false);
    }
  }, [workspace.workspaceId]);

  const refreshSelected = useCallback(async (inventoryId: string) => {
    const nextSessions = await listWarehouseInventorySessions(workspace.workspaceId, 60);
    const next = nextSessions.find((entry) => entry.session.id === inventoryId);
    if (!next) throw new Error('WAREHOUSE_INVENTORY_NOT_FOUND');
    const records = await listWarehouseInventoryItems(workspace.workspaceId, inventoryId);
    setSessions(nextSessions);
    setSelectedSession(next);
    setItems(records.map((entry) => entry.item));
    setPosition(null);
    setSelectedItem(null);
    setCountText('');
    setReviewAcknowledged(false);
    return next;
  }, [workspace.workspaceId]);

  const resolvePosition = useCallback(async (code: string): Promise<ResolvedPosition> => {
    if (!workspace.ug) throw new Error('WAREHOUSE_MOBILE_UG_REQUIRED');
    const resolved = await resolveWarehouseStockPositionBarcode({
      code,
      workspaceId: workspace.workspaceId,
      ug: workspace.ug,
    });
    if (!resolved.ok) throw new Error('POSITION:' + resolved.error);
    return resolved.value;
  }, [workspace.ug, workspace.workspaceId]);

  const loadMaterialsForItems = useCallback(async (targetItems: readonly WarehouseInventoryItem[]) => {
    const uniqueIds = Array.from(new Set(targetItems.map((item) => item.materialId)));
    const missing = uniqueIds.filter((id) => !materials[id]);
    if (missing.length === 0) return;

    const found = await Promise.all(
      missing.map((id) => getWarehouseMaterial(workspace.workspaceId, id))
    );
    const additions: Record<string, WarehouseMaterial> = {};
    for (let index = 0; index < missing.length; index += 1) {
      const material = found[index];
      if (
        !material
        || material.status !== 'active'
        || (workspace.ug && material.ug !== workspace.ug)
      ) {
        throw new Error('WAREHOUSE_MOBILE_INVENTORY_MATERIAL_INVALID');
      }
      additions[missing[index]] = material;
    }
    setMaterials((current) => ({ ...current, ...additions }));
  }, [materials, workspace.ug, workspace.workspaceId]);

  const openInventoryAtPosition = useCallback((event: WarehouseMobileScanEvent) => {
    const requestId = ++requestRef.current;
    setWorking(true);
    setMessage(null);
    setSuccess(null);

    void resolvePosition(event.value).then(async (resolved) => {
      if (requestId !== requestRef.current) return;
      const scope = warehouseMobileInventoryScopeFromPosition(resolved.position);
      const session = await startWarehouseInventory(workspace.workspaceId, { scope });
      const records = await listWarehouseInventoryItems(
        workspace.workspaceId,
        session.session.id
      );
      if (requestId !== requestRef.current) return;
      const sessionItems = records.map((entry) => entry.item);
      await loadMaterialsForItems(
        warehouseMobileInventoryItemsAtPosition(sessionItems, resolved.position)
      );
      if (requestId !== requestRef.current) return;
      setSelectedSession(session);
      setItems(sessionItems);
      setPosition(resolved);
      setSelectedItem(null);
      setCountText('');
      setReviewAcknowledged(false);
      setSuccess('Sessão aberta com o snapshot oficial desta posição.');
      void loadSessions();
    }).catch((error) => {
      if (requestId !== requestRef.current) return;
      const raw = error instanceof Error ? error.message : String(error);
      setMessage(raw.startsWith('POSITION:') ? locationError(raw.slice(9)) : inventoryError(error));
    }).finally(() => {
      if (requestId === requestRef.current) setWorking(false);
    });
  }, [loadMaterialsForItems, loadSessions, resolvePosition, workspace.workspaceId]);

  const scanCountingPosition = useCallback((event: WarehouseMobileScanEvent) => {
    if (!selectedSession || warehouseMobileInventorySessionMode(selectedSession.session.status) !== 'COUNT') return;
    const requestId = ++requestRef.current;
    setWorking(true);
    setMessage(null);
    setSuccess(null);
    setSelectedItem(null);
    setCountText('');

    void resolvePosition(event.value).then(async (resolved) => {
      if (requestId !== requestRef.current) return;
      const disposition = warehouseMobileInventoryPositionDisposition(
        selectedSession.session.scope,
        items,
        resolved.position
      );
      if (disposition === 'OUT_OF_SCOPE') {
        throw new Error('WAREHOUSE_MOBILE_INVENTORY_POSITION_OUT_OF_SCOPE');
      }
      if (disposition === 'EMPTY') {
        throw new Error('WAREHOUSE_MOBILE_INVENTORY_POSITION_EMPTY');
      }
      const targetItems = warehouseMobileInventoryItemsAtPosition(items, resolved.position);
      await loadMaterialsForItems(targetItems);
      if (requestId !== requestRef.current) return;
      setPosition(resolved);
    }).catch((error) => {
      if (requestId !== requestRef.current) return;
      const raw = error instanceof Error ? error.message : String(error);
      if (raw.startsWith('POSITION:')) setMessage(locationError(raw.slice(9)));
      else if (raw.includes('POSITION_OUT_OF_SCOPE')) setMessage('Esta posição está fora do escopo congelado desta sessão.');
      else if (raw.includes('POSITION_EMPTY')) setMessage('Esta posição pertence ao escopo, mas não possui item no snapshot do inventário.');
      else setMessage(inventoryError(error));
    }).finally(() => {
      if (requestId === requestRef.current) setWorking(false);
    });
  }, [items, loadMaterialsForItems, resolvePosition, selectedSession]);

  const positionItems = useMemo(
    () => position
      ? warehouseMobileInventoryItemsAtPosition(items, position.position)
      : [],
    [items, position]
  );

  const selectExpectedItem = useCallback((item: WarehouseInventoryItem) => {
    setMessage(null);
    setSuccess(null);
    setSelectedItem(item);
    setCountText(item.countedQuantity === null ? '' : String(item.countedQuantity));
  }, []);

  const scanMaterial = useCallback((event: WarehouseMobileScanEvent) => {
    if (!position || !selectedSession) return;
    const requestId = ++requestRef.current;
    setWorking(true);
    setMessage(null);
    setSuccess(null);

    void (async () => {
      const association = await getWarehouseBarcodeByCode(
        workspace.workspaceId,
        event.value
      );
      if (
        !association
        || association.status !== 'active'
        || (workspace.ug && association.ug !== workspace.ug)
      ) {
        throw new Error('WAREHOUSE_MOBILE_INVENTORY_PRODUCT_UNKNOWN');
      }

      const item = findWarehouseMobileInventoryItem(
        items,
        position.position,
        association.materialId
      );
      if (!item) throw new Error('WAREHOUSE_MOBILE_INVENTORY_PRODUCT_OUT_OF_SCOPE');
      if (item.status === 'STALE') throw new Error('WAREHOUSE_MOBILE_INVENTORY_ITEM_STALE');

      const material = await getWarehouseMaterial(workspace.workspaceId, item.materialId);
      if (
        !material
        || material.status !== 'active'
        || (workspace.ug && material.ug !== workspace.ug)
      ) {
        throw new Error('WAREHOUSE_MOBILE_INVENTORY_MATERIAL_INVALID');
      }
      if (requestId !== requestRef.current) return;
      setMaterials((current) => ({ ...current, [material.id]: material }));
      setSelectedItem(item);
      setCountText(item.countedQuantity === null ? '' : String(item.countedQuantity));
    })().catch((error) => {
      if (requestId !== requestRef.current) return;
      const raw = error instanceof Error ? error.message : String(error);
      if (raw.includes('PRODUCT_UNKNOWN')) {
        setMessage('Código comercial não encontrado, inativo ou incompatível com este workspace/UG.');
      } else if (raw.includes('PRODUCT_OUT_OF_SCOPE')) {
        setMessage('O material lido não faz parte do snapshot esperado desta posição.');
      } else if (raw.includes('ITEM_STALE')) {
        setMessage('Este item ficou obsoleto por concorrência e não pode ser corrigido automaticamente.');
      } else {
        setMessage('O material canônico não pôde ser validado.');
      }
    }).finally(() => {
      if (requestId === requestRef.current) setWorking(false);
    });
  }, [items, position, selectedSession, workspace.ug, workspace.workspaceId]);

  const saveCount = useCallback(async () => {
    if (
      !selectedSession
      || !selectedItem
      || warehouseMobileInventorySessionMode(selectedSession.session.status) !== 'COUNT'
    ) return;

    const counted = Number(countText.trim().replace(',', '.'));
    if (!Number.isFinite(counted) || counted < 0) {
      setMessage('Informe uma quantidade contada válida, igual ou maior que zero.');
      return;
    }

    setWorking(true);
    setMessage(null);
    setSuccess(null);
    try {
      const next = await saveWarehouseInventoryCount(
        workspace.workspaceId,
        selectedSession.session.id,
        selectedItem.id,
        counted
      );
      setItems((current) => current.map((item) => item.id === next.id ? next : item));
      setSelectedItem(null);
      setCountText('');
      setSuccess('Contagem salva. Nenhum saldo foi alterado.');
    } catch (error) {
      setMessage(inventoryError(error));
      await refreshSelected(selectedSession.session.id).catch(() => undefined);
    } finally {
      setWorking(false);
    }
  }, [countText, refreshSelected, selectedItem, selectedSession, workspace.workspaceId]);

  const countedItems = useMemo(
    () => items.filter((item) => item.status !== 'PENDING' && item.status !== 'STALE').length,
    [items]
  );
  const allCounted = items.length > 0
    && items.every((item) => item.status !== 'PENDING' && item.status !== 'STALE');

  const beginReview = useCallback(async () => {
    if (!selectedSession || !allCounted) return;
    setWorking(true);
    setMessage(null);
    setSuccess(null);
    try {
      await beginWarehouseInventoryReview(
        workspace.workspaceId,
        selectedSession.session.id
      );
      await refreshSelected(selectedSession.session.id);
      setSuccess('Contagem encerrada. Revise as divergências antes da confirmação final.');
    } catch (error) {
      setMessage(inventoryError(error));
    } finally {
      setWorking(false);
    }
  }, [allCounted, refreshSelected, selectedSession, workspace.workspaceId]);

  const reopenCounting = useCallback(async () => {
    if (!selectedSession) return;
    setWorking(true);
    setMessage(null);
    setSuccess(null);
    try {
      await reopenWarehouseInventoryCounting(
        workspace.workspaceId,
        selectedSession.session.id
      );
      await refreshSelected(selectedSession.session.id);
      setSuccess('Sessão reaberta para correção de contagens. Nenhum saldo foi alterado.');
    } catch (error) {
      setMessage(inventoryError(error));
    } finally {
      setWorking(false);
    }
  }, [refreshSelected, selectedSession, workspace.workspaceId]);

  const confirmInventory = useCallback(async () => {
    if (!selectedSession || !reviewAcknowledged) return;
    const mode = warehouseMobileInventorySessionMode(selectedSession.session.status);
    if (mode !== 'REVIEW' && mode !== 'CONFIRM') return;

    setWorking(true);
    setMessage(null);
    setSuccess(null);
    try {
      const result = await confirmWarehouseInventory(
        workspace.workspaceId,
        selectedSession.session.id
      );
      await refreshSelected(selectedSession.session.id);
      setSuccess(
        'Inventário confirmado. '
        + result.adjusted
        + ' ajuste(s) canônico(s) e '
        + result.matched
        + ' item(ns) sem divergência.'
      );
    } catch (error) {
      setMessage(inventoryError(error));
      await refreshSelected(selectedSession.session.id).catch(() => undefined);
    } finally {
      setWorking(false);
    }
  }, [refreshSelected, reviewAcknowledged, selectedSession, workspace.workspaceId]);

  const cancelInventory = useCallback(async () => {
    if (!selectedSession) return;
    const mode = warehouseMobileInventorySessionMode(selectedSession.session.status);
    if (mode !== 'COUNT' && mode !== 'REVIEW') return;
    if (!window.confirm('Cancelar esta sessão? O histórico será preservado e nenhuma contagem poderá ser retomada.')) return;

    setWorking(true);
    setMessage(null);
    setSuccess(null);
    try {
      await cancelWarehouseInventory(
        workspace.workspaceId,
        selectedSession.session.id
      );
      await refreshSelected(selectedSession.session.id);
      setSuccess('Sessão cancelada e preservada no histórico.');
    } catch (error) {
      setMessage(inventoryError(error));
    } finally {
      setWorking(false);
    }
  }, [refreshSelected, selectedSession, workspace.workspaceId]);

  const mode = selectedSession
    ? warehouseMobileInventorySessionMode(selectedSession.session.status)
    : null;
  const reviewSummary = selectedSession
    ? selectedSession.session.reviewSummary || summarizeWarehouseInventoryItems(items)
    : null;
  const divergentItems = items.filter((item) =>
    item.status === 'DIVERGENT' || item.status === 'ADJUSTED' || item.status === 'STALE'
  );

  return (
    <div className="space-y-5" data-testid="warehouse-mobile-inventory">
      <header className="rounded-3xl bg-[#00288e] p-5 text-white">
        <Link
          href="/central-mobile"
          className="inline-flex items-center gap-2 text-xs font-black text-blue-100"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Central Móvel
        </Link>
        <h1 className="mt-4 text-2xl font-black">Inventário móvel</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-blue-100">
          Posição → esperado → material → contado → revisão → confirmação humana.
        </p>
      </header>

      {message && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-5 text-amber-900">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <span>{message}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold leading-5 text-emerald-900">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <span>{success}</span>
          </div>
        </div>
      )}

      {working && (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-black text-blue-900">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          Revalidando estado autoritativo…
        </div>
      )}

      {!selectedSession && (
        <>
          <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                  1 · SESSÃO
                </p>
                <h2 className="mt-1 text-lg font-black text-slate-950">
                  Abrir inventário desta posição
                </h2>
              </div>
              <MapPin className="h-5 w-5 text-[#00288e]" aria-hidden="true" />
            </div>
            <p className="text-xs font-semibold leading-5 text-slate-500">
              A nova sessão usa o inventário canônico e congela o esperado oficial da posição lida.
            </p>
            <WarehouseMobileScanner
              expectation="EXPECT_LOCATION"
              identifyScan={classifyWarehouseMobileLocationScan}
              onValidatedScan={openInventoryAtPosition}
              title="LER POSIÇÃO PARA ABRIR"
            />
          </section>

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3 px-1">
              <div>
                <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                  SESSÕES EXISTENTES
                </p>
                <h2 className="mt-1 text-lg font-black text-slate-950">
                  Continuar ou consultar
                </h2>
              </div>
              <button
                type="button"
                onClick={() => void loadSessions()}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-100 px-3 text-xs font-black text-slate-700"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Atualizar
              </button>
            </div>
            {loadingSessions ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs font-bold text-slate-500">
                Carregando inventários…
              </div>
            ) : sessions.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs font-bold text-slate-500">
                Nenhuma sessão encontrada.
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((record) => (
                  <button
                    type="button"
                    key={record.session.id}
                    onClick={() => void loadSession(record)}
                    className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-950">
                          {scopeLabel(record)}
                        </p>
                        <p className="mt-1 font-mono text-[9px] font-bold text-slate-500">
                          {record.session.id}
                        </p>
                      </div>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[9px] font-black text-blue-800">
                        {statusLabel(record.session.status)}
                      </span>
                    </div>
                    <p className="mt-3 text-xs font-semibold text-slate-500">
                      {record.session.itemCount} item(ns)
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {selectedSession && (
        <>
          <section className="rounded-3xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                  SESSÃO ATIVA
                </p>
                <h2 className="mt-1 text-lg font-black text-slate-950">
                  {scopeLabel(selectedSession)}
                </h2>
                <p className="mt-1 font-mono text-[9px] font-bold text-slate-500">
                  {selectedSession.session.id}
                </p>
              </div>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[9px] font-black text-blue-800">
                {statusLabel(selectedSession.session.status)}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-[10px] font-bold text-slate-500">Contados</p>
                <p className="mt-1 text-lg font-black text-slate-950">
                  {countedItems}/{items.length}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-[10px] font-bold text-slate-500">Divergências</p>
                <p className="mt-1 text-lg font-black text-slate-950">
                  {items.filter((item) => item.status === 'DIVERGENT' || item.status === 'STALE').length}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                requestRef.current += 1;
                setSelectedSession(null);
                setItems([]);
                setPosition(null);
                setSelectedItem(null);
                setMessage(null);
                setSuccess(null);
              }}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 text-xs font-black text-slate-700"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Trocar sessão
            </button>
          </section>

          {mode === 'COUNT' && (
            <>
              <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
                <div>
                  <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                    2 · POSIÇÃO
                  </p>
                  <h2 className="mt-1 text-lg font-black text-slate-950">
                    LER POSIÇÃO
                  </h2>
                </div>
                <WarehouseMobileScanner
                  expectation="EXPECT_LOCATION"
                  identifyScan={classifyWarehouseMobileLocationScan}
                  onValidatedScan={scanCountingPosition}
                  title="LER POSIÇÃO"
                />
                {position && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-black text-emerald-900">
                    <ShieldCheck className="mr-2 inline h-4 w-4" aria-hidden="true" />
                    {positionLabel(position)}
                  </div>
                )}
              </section>

              {position && (
                <section className="space-y-3">
                  <div className="px-1">
                    <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                      ESPERADO NESTA POSIÇÃO
                    </p>
                    <h2 className="mt-1 text-lg font-black text-slate-950">
                      {positionItems.length} item(ns)
                    </h2>
                  </div>
                  {positionItems.map((item) => {
                    const material = materials[item.materialId];
                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => selectExpectedItem(item)}
                        className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-950">
                              {material?.description || item.materialId}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              Esperado: {formatQuantity(item.expectedQuantity)} {materialUnit(material)}
                            </p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-600">
                            {item.status}
                          </span>
                        </div>
                        {item.countedQuantity !== null && (
                          <p className="mt-2 text-xs font-bold text-slate-700">
                            Contado: {formatQuantity(item.countedQuantity)} · Diferença: {formatQuantity(item.difference)}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </section>
              )}

              {position && (
                <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
                  <div>
                    <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                      3 · MATERIAL
                    </p>
                    <h2 className="mt-1 text-lg font-black text-slate-950">
                      LER MATERIAL
                    </h2>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                      Leia o barcode ou toque em um item esperado acima.
                    </p>
                  </div>
                  <WarehouseMobileScanner
                    expectation="EXPECT_PRODUCT"
                    identifyScan={classifyWarehouseMobileInventoryProductScan}
                    onValidatedScan={scanMaterial}
                    title="LER MATERIAL"
                  />
                </section>
              )}

              {selectedItem && (
                <section className="space-y-3 rounded-3xl border border-blue-200 bg-blue-50 p-4">
                  <div>
                    <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-blue-700">
                      4 · CONTAGEM
                    </p>
                    <h2 className="mt-1 text-lg font-black text-blue-950">
                      {materials[selectedItem.materialId]?.description || selectedItem.materialId}
                    </h2>
                    <p className="mt-1 text-xs font-bold text-blue-800">
                      Esperado: {formatQuantity(selectedItem.expectedQuantity)} {materialUnit(materials[selectedItem.materialId])}
                    </p>
                  </div>
                  <label className="block text-xs font-black text-blue-950">
                    Quantidade contada
                    <input
                      inputMode="decimal"
                      value={countText}
                      onChange={(event) => setCountText(event.target.value)}
                      className="mt-2 min-h-12 w-full rounded-2xl border border-blue-200 bg-white px-4 text-base font-black text-slate-950 outline-none"
                      placeholder="0"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => void saveCount()}
                    className="min-h-12 w-full rounded-2xl bg-[#00288e] px-4 text-sm font-black text-white disabled:opacity-50"
                  >
                    SALVAR CONTAGEM
                  </button>
                  <p className="text-center text-[11px] font-bold leading-5 text-blue-800">
                    Salvar registra somente a contagem. Saldo e ledger permanecem inalterados.
                  </p>
                </section>
              )}

              {allCounted && (
                <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
                  <PackageCheck className="h-6 w-6 text-emerald-700" aria-hidden="true" />
                  <h2 className="mt-2 text-lg font-black text-emerald-950">
                    Todas as contagens foram registradas
                  </h2>
                  <p className="mt-1 text-xs font-semibold leading-5 text-emerald-800">
                    Nenhum ajuste ocorreu até aqui. A próxima etapa apenas fecha a contagem e abre a revisão.
                  </p>
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => void beginReview()}
                    className="mt-4 min-h-12 w-full rounded-2xl bg-emerald-700 px-4 text-sm font-black text-white disabled:opacity-50"
                  >
                    INICIAR REVISÃO
                  </button>
                </section>
              )}

              <button
                type="button"
                onClick={() => void cancelInventory()}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 text-xs font-black text-rose-800"
              >
                <XCircle className="h-4 w-4" aria-hidden="true" />
                Cancelar sessão
              </button>
            </>
          )}

          {(mode === 'REVIEW' || mode === 'CONFIRM') && reviewSummary && (
            <section className="space-y-4 rounded-3xl border border-amber-200 bg-amber-50 p-4">
              <div>
                <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-amber-700">
                  5 · REVISÃO E CONFIRMAÇÃO
                </p>
                <h2 className="mt-1 text-lg font-black text-amber-950">
                  Revise antes de alterar o estoque
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-white p-3">
                  <p className="text-[10px] font-bold text-slate-500">Conferidos</p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {reviewSummary.countedItems}
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-3">
                  <p className="text-[10px] font-bold text-slate-500">Divergentes</p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {reviewSummary.divergentItems}
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-3">
                  <p className="text-[10px] font-bold text-slate-500">Diferença +</p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {formatQuantity(reviewSummary.positiveDifference)}
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-3">
                  <p className="text-[10px] font-bold text-slate-500">Diferença −</p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {formatQuantity(reviewSummary.negativeDifference)}
                  </p>
                </div>
              </div>

              {divergentItems.length > 0 && (
                <div className="space-y-2">
                  {divergentItems.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-amber-200 bg-white p-3">
                      <p className="text-xs font-black text-slate-950">
                        {materials[item.materialId]?.description || item.materialId}
                      </p>
                      <p className="mt-1 text-[11px] font-bold text-slate-600">
                        Esperado {formatQuantity(item.expectedQuantity)} · contado {formatQuantity(item.countedQuantity)} · diferença {formatQuantity(item.difference)}
                      </p>
                      {item.status === 'STALE' && (
                        <p className="mt-2 text-[11px] font-black text-rose-700">
                          STALE — estado concorrente detectado.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <label className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-white p-4">
                <input
                  type="checkbox"
                  checked={reviewAcknowledged}
                  onChange={(event) => setReviewAcknowledged(event.target.checked)}
                  className="mt-1 h-5 w-5"
                />
                <span className="text-xs font-bold leading-5 text-slate-700">
                  Revisei o resumo e autorizo explicitamente os ajustes canônicos de INVENTORY_ADJUSTMENT somente para as divergências confirmadas.
                </span>
              </label>

              <button
                type="button"
                disabled={working || !reviewAcknowledged}
                onClick={() => void confirmInventory()}
                className="min-h-12 w-full rounded-2xl bg-amber-700 px-4 text-sm font-black text-white disabled:opacity-50"
              >
                {mode === 'CONFIRM' ? 'RETOMAR CONFIRMAÇÃO' : 'CONFIRMAR E APLICAR AJUSTES'}
              </button>

              {mode === 'REVIEW' && (
                <button
                  type="button"
                  disabled={working}
                  onClick={() => void reopenCounting()}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-xs font-black text-amber-900"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Voltar para contagem
                </button>
              )}
            </section>
          )}

          {mode === 'RECONCILE' && (
            <section className="rounded-3xl border border-rose-200 bg-rose-50 p-5">
              <TriangleAlert className="h-7 w-7 text-rose-700" aria-hidden="true" />
              <h2 className="mt-3 text-lg font-black text-rose-950">
                RECONCILIATION_REQUIRED
              </h2>
              <p className="mt-2 text-xs font-semibold leading-5 text-rose-800">
                Uma posição mudou após o snapshot. O item STALE não será corrigido automaticamente e o esperado histórico não será sobrescrito. Preserve esta sessão e abra um novo inventário parcial para reconciliar a posição.
              </p>
              {selectedSession.session.staleItemId && (
                <p className="mt-3 break-all font-mono text-[9px] font-bold text-rose-700">
                  {selectedSession.session.staleItemId}
                </p>
              )}
            </section>
          )}

          {mode === 'FINALIZED' && (
            <section className="rounded-3xl border border-slate-200 bg-white p-5">
              <ClipboardCheck className="h-7 w-7 text-[#00288e]" aria-hidden="true" />
              <h2 className="mt-3 text-lg font-black text-slate-950">
                Sessão finalizada
              </h2>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">
                Sessões CONFIRMED ou CANCELLED são somente leitura e não podem ser regravadas.
              </p>
            </section>
          )}

          {mode === 'WAIT' && (
            <section className="rounded-3xl border border-slate-200 bg-white p-5">
              <ShieldCheck className="h-7 w-7 text-[#00288e]" aria-hidden="true" />
              <h2 className="mt-3 text-lg font-black text-slate-950">
                Sessão em transição
              </h2>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">
                Atualize a sessão antes de continuar. Nenhuma escrita móvel será feita fora dos estados canônicos.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
