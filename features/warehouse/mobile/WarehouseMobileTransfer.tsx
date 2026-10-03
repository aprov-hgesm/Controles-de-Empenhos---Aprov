'use client';

import { ArrowLeft, CheckCircle2, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useRef, useState, type ReactNode } from 'react';

import { getWarehouseBarcodeByCode } from '../../../lib/warehouse/barcodeRepository';
import type { WarehouseStockPosition } from '../../../lib/warehouse/location';
import { warehouseStockPositionsEqual } from '../../../lib/warehouse/location';
import { resolveWarehouseStockPositionBarcode } from '../../../lib/warehouse/locationBarcodeResolver';
import {
  createWarehouseTransferIdempotencyKey,
  listWarehouseLocationBalances,
  transferWarehouseStock,
} from '../../../lib/warehouse/locationRepository';
import { listWarehouseLots } from '../../../lib/warehouse/lotRepository';
import type { WarehouseLot } from '../../../lib/warehouse/lot';
import type { WarehouseMaterial } from '../../../lib/warehouse/material';
import { getWarehouseMaterial } from '../../../lib/warehouse/materialRepository';
import { classifyWarehouseMobileLocationScan } from '../../../lib/warehouse/mobileLocationScan';
import {
  prepareWarehouseMobileTransfer,
  validateWarehouseMobileTransferQuantity,
  type WarehouseMobileTransferPreparationError,
} from '../../../lib/warehouse/mobileTransfer';
import type { WarehouseMobileScanEvent, WarehouseMobileScanKind } from '../../../lib/warehouse/mobileScanner';
import type { WarehouseStockPositionResolveResult } from '../../../lib/warehouse/locationBarcode';
import { useWarehouseWorkspaceContext } from '../components/WarehouseModuleContext';
import { WarehouseMobileScanner } from './WarehouseMobileScanner';

type ResolvedPosition = Extract<WarehouseStockPositionResolveResult, { ok: true }>['value'];
type PositionSelection = { code: string; value: ResolvedPosition };
type MaterialSelection = {
  barcode: string;
  material: WarehouseMaterial;
  availableQuantity: number;
  sourceLots: WarehouseLot[];
};
type Review = { quantity: number; idempotencyKey: string };
type Success = {
  applied: boolean;
  movementId: string;
  fromQuantity: number;
  toQuantity: number;
  aggregateQuantity: number;
};

function formatQty(value: number) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
}

function unitLabel(material: WarehouseMaterial) {
  return material.unit.label || ({ unit: 'un', kg: 'kg', g: 'g', l: 'L', ml: 'mL', package: 'pacote', box: 'caixa', bundle: 'fardo', other: 'unidade' } as Record<string, string>)[material.unit.code] || material.unit.code;
}

function positionLabel(value: ResolvedPosition) {
  if (value.position.kind === 'LOCATION') {
    return `${value.depot.code} · ${value.location?.code || value.position.locationId}`;
  }
  return `${value.depot.code} · ${value.parentLocation?.code || value.position.locationId} · ${value.location?.code || value.position.subpositionId}`;
}

function locationError(error: string) {
  if (error === 'DEPOT_NOT_STOCK_POSITION') return 'Depósito não é posição de estoque. Leia um LOCAL ou SUBPOSIÇÃO.';
  if (error === 'WORKSPACE_MISMATCH' || error === 'UG_MISMATCH') return 'A etiqueta pertence a outro workspace/UG.';
  if (error === 'ENTITY_INACTIVE') return 'A posição está inativa.';
  if (error === 'ENTITY_NOT_FOUND') return 'A posição não existe mais.';
  return 'A posição não pôde ser validada no cadastro autoritativo.';
}

function preparationError(error: WarehouseMobileTransferPreparationError) {
  if (error === 'NON_PHYSICAL_POSITION') return 'Origem e destino precisam ser LOCAL ou SUBPOSIÇÃO.';
  if (error === 'SAME_POSITION') return 'Origem e destino precisam ser diferentes.';
  if (error === 'INVALID_QUANTITY') return 'Informe quantidade maior que zero, com até seis casas decimais.';
  if (error === 'INVALID_AVAILABLE_STOCK') return 'O saldo físico atual não pôde ser validado.';
  if (error === 'INSUFFICIENT_STOCK') return 'A quantidade é maior que o saldo disponível na origem.';
  return 'Há lote ativo nessa posição. Para manter lote e validade coerentes, transfira o saldo integral da posição.';
}

function operationError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('WAREHOUSE_TRANSFER_INSUFFICIENT_STOCK')) return 'O saldo da origem mudou antes da confirmação. Revise a operação.';
  if (raw.includes('WAREHOUSE_POSITION_INACTIVE') || raw.includes('WAREHOUSE_SUBPOSITION_INACTIVE')) return 'Origem ou destino ficou inativo antes da confirmação.';
  if (raw.includes('WAREHOUSE_POSITION_NOT_FOUND') || raw.includes('WAREHOUSE_SUBPOSITION_NOT_FOUND')) return 'Origem ou destino não existe mais.';
  if (raw.includes('WAREHOUSE_TRANSFER_LOT_POSITION_MISMATCH')) return 'O lote mudou de posição antes da confirmação. Refaça a leitura.';
  if (raw.includes('WAREHOUSE_IDEMPOTENCY_CONFLICT')) return 'Conflito de idempotência. Recomece a operação.';
  return 'A transferência não pôde ser confirmada. Revalide os dados e tente novamente.';
}

function classifyProduct(value: string): WarehouseMobileScanKind {
  return classifyWarehouseMobileLocationScan(value) === 'LOCATION' ? 'LOCATION' : 'PRODUCT';
}

export function WarehouseMobileTransfer() {
  const workspace = useWarehouseWorkspaceContext();
  const requestRef = useRef(0);
  const [source, setSource] = useState<PositionSelection | null>(null);
  const [material, setMaterial] = useState<MaterialSelection | null>(null);
  const [quantityText, setQuantityText] = useState('');
  const [quantity, setQuantity] = useState<number | null>(null);
  const [destination, setDestination] = useState<PositionSelection | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [success, setSuccess] = useState<Success | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reset = useCallback(() => {
    requestRef.current += 1;
    setSource(null); setMaterial(null); setQuantityText(''); setQuantity(null);
    setDestination(null); setReview(null); setSuccess(null); setMessage(null); setWorking(false);
  }, []);

  const resolvePosition = useCallback(async (code: string) => {
    if (!workspace.ug) throw new Error('WAREHOUSE_MOBILE_UG_REQUIRED');
    const result = await resolveWarehouseStockPositionBarcode({ code, workspaceId: workspace.workspaceId, ug: workspace.ug });
    if (result.ok === false) throw new Error('POSITION:' + result.error);
    return result.value;
  }, [workspace.ug, workspace.workspaceId]);

  const loadMaterialAtSource = useCallback(async (barcode: string, position: WarehouseStockPosition): Promise<MaterialSelection> => {
    if (!workspace.ug) throw new Error('WAREHOUSE_MOBILE_UG_REQUIRED');
    const association = await getWarehouseBarcodeByCode(workspace.workspaceId, barcode);
    if (!association || association.status !== 'active' || association.ug !== workspace.ug) throw new Error('PRODUCT_NOT_FOUND');

    const [foundMaterial, balances, lots] = await Promise.all([
      getWarehouseMaterial(workspace.workspaceId, association.materialId),
      listWarehouseLocationBalances(workspace.workspaceId, 500, association.materialId),
      listWarehouseLots(workspace.workspaceId, 500, association.materialId),
    ]);
    if (!foundMaterial || foundMaterial.status !== 'active' || foundMaterial.ug !== workspace.ug) throw new Error('MATERIAL_INACTIVE');
    const sourceBalance = balances.find((item) => item.balance.quantity > 0 && warehouseStockPositionsEqual(item.balance.position, position));
    if (!sourceBalance) throw new Error('SOURCE_WITHOUT_MATERIAL');
    return {
      barcode,
      material: foundMaterial,
      availableQuantity: sourceBalance.balance.quantity,
      sourceLots: lots.map((item) => item.lot).filter((lot) => lot.status === 'active' && lot.quantity > 0 && warehouseStockPositionsEqual(lot.position, position)),
    };
  }, [workspace.ug, workspace.workspaceId]);

  const scanSource = useCallback((event: WarehouseMobileScanEvent) => {
    const id = ++requestRef.current; setWorking(true); setMessage(null); setSuccess(null);
    void resolvePosition(event.value).then((value) => {
      if (id !== requestRef.current) return;
      setSource({ code: event.value, value }); setMaterial(null); setQuantity(null); setDestination(null); setReview(null);
    }).catch((error) => {
      if (id !== requestRef.current) return;
      const raw = error instanceof Error ? error.message : String(error);
      setMessage(raw.startsWith('POSITION:') ? locationError(raw.slice(9)) : 'Falha ao revalidar a origem.');
    }).finally(() => { if (id === requestRef.current) setWorking(false); });
  }, [resolvePosition]);

  const scanProduct = useCallback((event: WarehouseMobileScanEvent) => {
    if (!source) return;
    const id = ++requestRef.current; setWorking(true); setMessage(null);
    void loadMaterialAtSource(event.value, source.value.position).then((value) => {
      if (id !== requestRef.current) return;
      setMaterial(value); setQuantityText(''); setQuantity(null); setDestination(null); setReview(null);
    }).catch((error) => {
      if (id !== requestRef.current) return;
      const raw = error instanceof Error ? error.message : String(error);
      setMessage(raw.includes('SOURCE_WITHOUT_MATERIAL') ? 'O material lido não possui saldo físico positivo na origem.' : 'Código comercial não encontrado, inativo ou incompatível com este workspace/UG.');
    }).finally(() => { if (id === requestRef.current) setWorking(false); });
  }, [loadMaterialAtSource, source]);

  const acceptQuantity = () => {
    if (!source || !material) return;
    const result = validateWarehouseMobileTransferQuantity({
      materialId: material.material.id,
      source: source.value.position,
      quantity: Number(quantityText.trim().replace(',', '.')),
      availableQuantity: material.availableQuantity,
      lots: material.sourceLots,
    });
    if (result.ok === false) { setMessage(preparationError(result.error)); return; }
    setQuantity(result.quantity); setDestination(null); setReview(null); setMessage(null);
  };

  const scanDestination = useCallback((event: WarehouseMobileScanEvent) => {
    if (!source || !material || quantity === null) return;
    const id = ++requestRef.current; setWorking(true); setMessage(null);
    void resolvePosition(event.value).then((value) => {
      if (id !== requestRef.current) return;
      const prepared = prepareWarehouseMobileTransfer({ materialId: material.material.id, from: source.value.position, to: value.position, quantity, availableQuantity: material.availableQuantity, lots: material.sourceLots });
      if (prepared.ok === false) { setMessage(preparationError(prepared.error)); return; }
      setDestination({ code: event.value, value });
      setReview({ quantity: prepared.quantity, idempotencyKey: createWarehouseTransferIdempotencyKey() });
    }).catch((error) => {
      if (id !== requestRef.current) return;
      const raw = error instanceof Error ? error.message : String(error);
      setMessage(raw.startsWith('POSITION:') ? locationError(raw.slice(9)) : 'Falha ao revalidar o destino.');
    }).finally(() => { if (id === requestRef.current) setWorking(false); });
  }, [material, quantity, resolvePosition, source]);

  const confirm = useCallback(async () => {
    if (!source || !material || !destination || !review) return;
    setWorking(true); setMessage(null); setSuccess(null);
    try {
      const [freshSource, freshDestination] = await Promise.all([resolvePosition(source.code), resolvePosition(destination.code)]);
      if (!warehouseStockPositionsEqual(freshSource.position, source.value.position) || !warehouseStockPositionsEqual(freshDestination.position, destination.value.position)) throw new Error('POSITION_CHANGED');
      const freshMaterial = await loadMaterialAtSource(material.barcode, freshSource.position);
      if (freshMaterial.material.id !== material.material.id) throw new Error('PRODUCT_CHANGED');
      const prepared = prepareWarehouseMobileTransfer({ materialId: freshMaterial.material.id, from: freshSource.position, to: freshDestination.position, quantity: review.quantity, availableQuantity: freshMaterial.availableQuantity, lots: freshMaterial.sourceLots });
      if (prepared.ok === false) { setMessage(preparationError(prepared.error)); return; }
      const result = await transferWarehouseStock(workspace.workspaceId, {
        materialId: freshMaterial.material.id,
        quantity: prepared.quantity,
        from: freshSource.position,
        to: freshDestination.position,
        relocateLotIds: prepared.relocateLotIds,
        idempotencyKey: review.idempotencyKey,
        note: 'Transferência confirmada pela Central Móvel R1',
      });
      setMaterial(freshMaterial);
      setSuccess({ applied: result.applied, movementId: result.movement.id, fromQuantity: result.fromBalance.quantity, toQuantity: result.toBalance.quantity, aggregateQuantity: result.balance.quantity });
      setMessage(result.applied ? 'Transferência concluída. Saldo agregado preservado e distribuição física atualizada.' : 'Replay idempotente: nenhuma segunda transferência foi criada.');
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      setMessage(raw.includes('POSITION_CHANGED') || raw.includes('PRODUCT_CHANGED') ? 'Origem, destino ou material mudou desde a leitura. Recomece a operação.' : operationError(error));
    } finally { setWorking(false); }
  }, [destination, loadMaterialAtSource, material, resolvePosition, review, source, workspace.workspaceId]);

  return (
    <div className="space-y-5" data-testid="warehouse-mobile-transfer">
      <header className="rounded-3xl bg-[#00288e] p-5 text-white">
        <Link href="/central-mobile" className="inline-flex items-center gap-2 text-xs font-black text-blue-100"><ArrowLeft className="h-4 w-4" /> Central Móvel</Link>
        <h1 className="mt-4 text-2xl font-black">Transferência móvel</h1>
        <p className="mt-2 text-sm font-semibold text-blue-100">Origem → material → quantidade → destino → confirmação humana.</p>
      </header>

      {message && <div className={`rounded-2xl border p-4 text-xs font-bold ${success ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{message}</div>}

      {!source && <Step title="1 · LER ORIGEM"><WarehouseMobileScanner expectation="EXPECT_SOURCE_LOCATION" identifyScan={classifyWarehouseMobileLocationScan} onValidatedScan={scanSource} title="LER ORIGEM" /></Step>}
      {source && <Card title="Origem validada" value={positionLabel(source.value)} detail={source.code} />}

      {source && !material && <Step title="2 · LER MATERIAL"><WarehouseMobileScanner expectation="EXPECT_PRODUCT" identifyScan={classifyProduct} onValidatedScan={scanProduct} title="LER MATERIAL" /><Secondary onClick={reset}>Trocar origem</Secondary></Step>}

      {material && <Card title="Material" value={material.material.description} detail={`Disponível: ${formatQty(material.availableQuantity)} ${unitLabel(material.material)}${material.sourceLots.length ? ' · com lote ativo (transferência integral)' : ''}`} />}

      {material && quantity === null && <Step title="3 · QUANTIDADE"><input value={quantityText} onChange={(event) => { setQuantityText(event.target.value); setMessage(null); }} inputMode="decimal" className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 font-black" placeholder="0" data-testid="warehouse-mobile-transfer-quantity" /><Primary onClick={acceptQuantity}>Continuar para destino</Primary></Step>}

      {material && quantity !== null && !destination && <Step title="4 · LER DESTINO"><p className="rounded-2xl bg-blue-50 p-3 text-xs font-bold text-blue-900">Quantidade: {formatQty(quantity)} {unitLabel(material.material)}</p><WarehouseMobileScanner expectation="EXPECT_DESTINATION_LOCATION" identifyScan={classifyWarehouseMobileLocationScan} onValidatedScan={scanDestination} title="LER DESTINO" /><Secondary onClick={() => { setQuantity(null); setDestination(null); setReview(null); }}>Alterar quantidade</Secondary></Step>}

      {source && material && destination && review && !success && <Step title="5 · REVISAR E CONFIRMAR"><div className="rounded-3xl border border-emerald-200 bg-white p-5" data-testid="warehouse-mobile-transfer-review"><p className="flex items-center gap-2 text-sm font-black text-emerald-800"><ShieldCheck className="h-5 w-5" /> Nenhum material foi movimentado ainda</p><dl className="mt-4 space-y-2 text-xs"><Row label="Origem" value={positionLabel(source.value)} /><Row label="Material" value={material.material.description} /><Row label="Quantidade" value={`${formatQty(review.quantity)} ${unitLabel(material.material)}`} />{material.sourceLots.length > 0 && <Row label="Lotes" value={material.sourceLots.map((lot) => lot.code).join(" · ")} />}<Row label="Destino" value={positionLabel(destination.value)} /></dl><button type="button" onClick={() => void confirm()} disabled={working} className="mt-5 min-h-12 w-full rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white disabled:opacity-50" data-testid="warehouse-mobile-transfer-confirm">{working ? 'REVALIDANDO…' : 'CONFIRMAR TRANSFERÊNCIA'}</button><Secondary onClick={() => { setDestination(null); setReview(null); }}>Trocar destino</Secondary></div></Step>}

      {success && <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5" data-testid="warehouse-mobile-transfer-success"><p className="flex items-center gap-2 text-sm font-black text-emerald-950"><CheckCircle2 className="h-5 w-5" /> {success.applied ? 'Transferência concluída' : 'Replay idempotente confirmado'}</p><p className="mt-2 text-xs font-semibold text-emerald-800">Origem: {formatQty(success.fromQuantity)} · Destino: {formatQty(success.toQuantity)} · Total agregado: {formatQty(success.aggregateQuantity)}</p><p className="mt-2 break-all font-mono text-[9px] text-emerald-700">{success.movementId}</p><Primary onClick={reset}>Nova transferência</Primary></section>}

      {working && !review && <p className="flex items-center justify-center gap-2 rounded-2xl bg-blue-50 p-3 text-xs font-bold text-blue-900"><RefreshCw className="h-4 w-4 animate-spin" /> Revalidando dados autoritativos…</p>}
      <p className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-[11px] font-semibold text-slate-500"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /> A confirmação revalida origem, destino, material, saldo e lotes. Não há listener contínuo nem escrita direta de saldo físico pelo cliente.</p>
    </div>
  );
}

function Step({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-3"><h2 className="text-lg font-black text-slate-950">{title}</h2>{children}</section>;
}
function Card({ title, value, detail }: { title: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-[9px] font-black uppercase text-emerald-700">{title}</p><p className="mt-1 text-sm font-black text-emerald-950">{value}</p><p className="mt-1 break-all text-[10px] font-semibold text-emerald-700">{detail}</p></div>;
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><dt className="text-[9px] font-black uppercase text-slate-400">{label}</dt><dd className="mt-1 font-black text-slate-800">{value}</dd></div>;
}
function Primary({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} className="mt-3 min-h-12 w-full rounded-2xl bg-[#00288e] px-4 text-sm font-black text-white">{children}</button>;
}
function Secondary({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600">{children}</button>;
}
