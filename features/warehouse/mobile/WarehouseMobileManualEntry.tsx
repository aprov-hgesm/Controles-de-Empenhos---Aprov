'use client';

import { ArrowLeft, CheckCircle2, LoaderCircle, PackagePlus, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getWarehouseBarcodeByCode } from '../../../lib/warehouse/barcodeRepository';
import { normalizeWarehouseLocationQuantity, type WarehouseStockPosition } from '../../../lib/warehouse/location';
import { resolveWarehouseStockPositionBarcode } from '../../../lib/warehouse/locationBarcodeResolver';
import { normalizeWarehouseExpiryDate } from '../../../lib/warehouse/lot';
import { type WarehouseMaterial } from '../../../lib/warehouse/material';
import { getWarehouseMaterial, listWarehouseMaterials } from '../../../lib/warehouse/materialRepository';
import { registerWarehouseManualEntry } from '../../../lib/warehouse/manualEntryRepository';
import { warehouseManualEntryErrorMessage } from '../../../lib/warehouse/manualEntryMessages';
import { classifyWarehouseMobileProductScan, createWarehouseMobileAllocationOperationId } from '../../../lib/warehouse/mobileIntakeAllocation';
import { classifyWarehouseMobileLocationScan } from '../../../lib/warehouse/mobileLocationScan';
import type { WarehouseMobileScanEvent } from '../../../lib/warehouse/mobileScanner';
import { useWarehouseWorkspaceContext } from '../components/WarehouseModuleContext';
import { WarehouseMobileScanner } from './WarehouseMobileScanner';

type ProductState =
  | { status: 'idle' }
  | { status: 'resolving'; code: string }
  | { status: 'known'; code: string; material: WarehouseMaterial }
  | { status: 'unknown'; code: string; confirmed: boolean }
  | { status: 'withoutBarcode' }
  | { status: 'error'; message: string };
type LocationState =
  | { status: 'idle' }
  | { status: 'resolving' }
  | { status: 'resolved'; code: string; position: WarehouseStockPosition; label: string }
  | { status: 'error'; message: string };

function materialUnitLabel(material: WarehouseMaterial): string {
  return material.unit.label || material.unit.code.toUpperCase();
}

const inputClass = 'mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none focus:border-[#00288e]';

export function WarehouseMobileManualEntry() {
  const workspace = useWarehouseWorkspaceContext();
  const productRequestRef = useRef(0);
  const locationRequestRef = useRef(0);
  const submittingRef = useRef(false);

  const [product, setProduct] = useState<ProductState>({ status: 'idle' });
  const [location, setLocation] = useState<LocationState>({ status: 'idle' });
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [catalog, setCatalog] = useState<WarehouseMaterial[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('UN');
  const [quantity, setQuantity] = useState('1');
  const [expiresOn, setExpiresOn] = useState('');
  const [provenance, setProvenance] = useState('');
  const [reference, setReference] = useState('');
  const [operationId, setOperationId] = useState(createWarehouseMobileAllocationOperationId);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const knownMaterial = product.status === 'known' ? product.material : null;
  const selectedMaterial = useMemo(
    () => knownMaterial || catalog.find((item) => item.id === selectedId) || null,
    [catalog, knownMaterial, selectedId]
  );
  const activeMode = knownMaterial ? 'existing' : mode;
  const normalizedQuantity = normalizeWarehouseLocationQuantity(Number(quantity));
  const quantityValid = quantity.trim() !== '' && normalizedQuantity !== null && normalizedQuantity > 0;
  const barcode = product.status === 'known' || product.status === 'unknown' ? product.code : null;
  const productReady = product.status === 'known'
    || product.status === 'withoutBarcode'
    || (product.status === 'unknown' && product.confirmed);

  const renewOperation = () => {
    setOperationId(createWarehouseMobileAllocationOperationId());
    setError(null);
    setSuccess(null);
  };

  const reset = useCallback(() => {
    productRequestRef.current += 1;
    locationRequestRef.current += 1;
    setProduct({ status: 'idle' });
    setLocation({ status: 'idle' });
    setMode('new');
    setSelectedId('');
    setDescription('');
    setUnit('UN');
    setQuantity('1');
    setExpiresOn('');
    setProvenance('');
    setReference('');
    setOperationId(createWarehouseMobileAllocationOperationId());
    setError(null);
  }, []);

  useEffect(() => {
    if (!productReady || activeMode !== 'existing' || knownMaterial || catalogStatus !== 'idle') return;
    setCatalogStatus('loading');
    void listWarehouseMaterials(workspace.workspaceId, 150).then((items) => {
      setCatalog(items.filter((item) => item.status === 'active' && item.ug === workspace.ug));
      setCatalogStatus('loaded');
    }).catch(() => {
      setCatalogStatus('error');
    });
  }, [activeMode, catalogStatus, knownMaterial, productReady, workspace.workspaceId, workspace.ug]);

  const resolveProduct = useCallback((event: WarehouseMobileScanEvent) => {
    const requestId = ++productRequestRef.current;
    setProduct({ status: 'resolving', code: event.value });
    setSelectedId('');
    setError(null);
    renewOperation();

    void (async () => {
      const association = await getWarehouseBarcodeByCode(workspace.workspaceId, event.value);
      if (requestId !== productRequestRef.current) return;

      if (!association) {
        setMode('new');
        setProduct({ status: 'unknown', code: event.value, confirmed: false });
        return;
      }
      if (association.status !== 'active' || association.ug !== workspace.ug) {
        throw new Error('Código inativo ou vinculado a outra UG.');
      }
      // MANUAL_ENTRY recebe quantidade na unidade canônica e não converte apresentações.
      if (association.factorToBaseUnit !== 1) {
        throw new Error('Este código representa uma embalagem com conversão. Use o cadastro desktop para evitar divergência de quantidades.');
      }

      const material = await getWarehouseMaterial(workspace.workspaceId, association.materialId);
      if (requestId !== productRequestRef.current) return;
      if (!material || material.status !== 'active' || material.ug !== workspace.ug) {
        throw new Error('O código aponta para um material indisponível nesta UG.');
      }
      setMode('existing');
      setProduct({ status: 'known', code: event.value, material });
    })().catch((caught) => {
      if (requestId !== productRequestRef.current) return;
      setProduct({
        status: 'error',
        message: caught instanceof Error ? caught.message : 'Falha ao consultar o código de barras.',
      });
    });
  }, [workspace.workspaceId, workspace.ug]);

  const resolveLocation = useCallback((event: WarehouseMobileScanEvent) => {
    const requestId = ++locationRequestRef.current;
    renewOperation();
    setLocation({ status: 'resolving' });
    if (!workspace.ug) {
      setLocation({ status: 'error', message: 'UG não resolvida. Reabra o Operador Móvel.' });
      return;
    }
    void resolveWarehouseStockPositionBarcode({
      code: event.value,
      workspaceId: workspace.workspaceId,
      ug: workspace.ug,
    }).then((result) => {
      if (requestId !== locationRequestRef.current) return;
      if (!result.ok) {
        setLocation({
          status: 'error',
          message: result.error === 'DEPOT_NOT_STOCK_POSITION'
            ? 'A etiqueta é de um depósito. Leia a etiqueta de um Local ou de uma prateleira.'
            : 'Localização inválida, inativa ou fora da UG. Confira a etiqueta.',
        });
        return;
      }

      const labels = [
        result.value.depot.code,
        result.value.parentLocation?.code,
        result.value.location?.code,
      ].filter((value): value is string => Boolean(value));
      setLocation({
        status: 'resolved',
        code: event.value,
        position: result.value.position,
        label: labels.join(' → '),
      });
    }).catch(() => {
      if (requestId === locationRequestRef.current) {
        setLocation({ status: 'error', message: 'Falha ao revalidar a prateleira. Confira a conexão.' });
      }
    });
  }, [workspace.workspaceId, workspace.ug]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return catalog.filter((item) => !query
      || [item.description, item.id, ...item.aliases].join(' ').toLocaleLowerCase('pt-BR').includes(query)
    ).slice(0, 25);
  }, [catalog, search]);

  const submit = async () => {
    if (submittingRef.current || working) return;
    setError(null);
    setSuccess(null);

    if (!productReady) { setError('Leia o material ou indique que não possui etiqueta.'); return; }
    if (product.status === 'unknown' && !product.confirmed) {
      setError('Confirme a associação do código de barras ao material.'); return;
    }
    if (activeMode === 'existing' && !selectedMaterial) {
      setError('Selecione um material já cadastrado.'); return;
    }
    if (activeMode === 'new' && (!description.trim() || description.trim().length > 240 || !unit.trim())) {
      setError('Informe descrição e unidade do novo material.'); return;
    }
    if (!quantityValid) { setError('Informe uma quantidade positiva válida.'); return; }
    if (!provenance.trim()) { setError('Informe a procedência do material.'); return; }
    if (location.status !== 'resolved' || location.position.kind === 'UNASSIGNED') {
      setError('Leia uma etiqueta de Local ou subposição ativa.'); return;
    }
    if (normalizeWarehouseExpiryDate(expiresOn || null) === undefined) {
      setError('Informe uma data de validade válida ou deixe em branco.'); return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setError('Sem conexão. O rascunho foi mantido.'); return;
    }

    submittingRef.current = true;
    setWorking(true);
    try {
      // O motor compartilhado verifica o código DENTRO da transação,
      // impedindo corrida entre o scan e a gravação sem leitura duplicada.
      const result = await registerWarehouseManualEntry(workspace.workspaceId, {
        operationId,
        existingMaterialId: activeMode === 'existing' ? selectedMaterial?.id : null,
        description: activeMode === 'existing' ? selectedMaterial?.description || '' : description.trim(),
        unitLabel: activeMode === 'existing' && selectedMaterial ? materialUnitLabel(selectedMaterial) : unit.trim(),
        quantity: normalizedQuantity as number,
        provenance: provenance.trim(),
        reference: reference.trim() || null,
        position: location.position,
        expiresOn: expiresOn || null,
        barcode,
      });

      const registered = result.entry.applied ? 'Entrada avulsa registrada' : 'Entrada já registrada anteriormente';
      const warning = result.warnings.length ? ' Atenção: ' + result.warnings.join(' ') : '';
      const message = registered + ': ' + result.material.description
        + ' · ' + (normalizedQuantity as number).toLocaleString('pt-BR', { maximumFractionDigits: 6 })
        + ' ' + materialUnitLabel(result.material) + ' · ' + location.label + '.' + warning;
      reset();
      setSuccess(message);
    } catch (caught) {
      // Conserva operationId e dados: repetir após timeout não deve duplicar o lançamento.
      setError(warehouseManualEntryErrorMessage(caught));
    } finally {
      submittingRef.current = false;
      setWorking(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="warehouse-mobile-manual-entry">
      <header className="rounded-3xl bg-[#00288e] p-5 text-white">
        <Link href="/operador-movel" className="inline-flex min-h-10 items-center gap-2 text-xs font-black text-blue-100">
          <ArrowLeft className="h-4 w-4" /> Operador Móvel
        </Link>
        <p className="mt-3 font-mono text-[10px] font-black uppercase tracking-widest text-blue-200">Entrada avulsa · Sem NF</p>
        <h1 className="mt-1 text-2xl font-black">Cadastrar material</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-blue-100">
          Leia o material, escolha a prateleira e informe quantidade, unidade, procedência e validade.
          A entrada utiliza o mesmo estoque e ledger do desktop.
        </p>
      </header>

      {success && (
        <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-900">
          <CheckCircle2 className="mr-2 inline h-5 w-5" />{success}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold leading-6 text-rose-900">
          <TriangleAlert className="mr-2 inline h-5 w-5" />{error}
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-black text-slate-950">1 · Etiqueta do material</h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          O código comercial identifica um material já cadastrado ou permite associar um novo.
        </p>
        {(product.status === 'idle' || product.status === 'error') && (
          <div className="mt-3 space-y-3">
            <WarehouseMobileScanner
              expectation="EXPECT_PRODUCT"
              identifyScan={classifyWarehouseMobileProductScan}
              onValidatedScan={resolveProduct}
              title="LER MATERIAL"
            />
            <button type="button" disabled={working} onClick={() => {
              productRequestRef.current += 1;
              setProduct({ status: 'withoutBarcode' });
              setMode('new');
              renewOperation();
            }} className="min-h-11 w-full rounded-2xl border border-slate-300 px-3 text-xs font-black text-slate-700">
              Material sem etiqueta — cadastrar manualmente
            </button>
          </div>
        )}
        {product.status === 'resolving' && <p className="mt-3 text-xs font-bold text-blue-900">Conferindo barcode no estoque oficial…</p>}
        {product.status === 'error' && <p className="mt-3 text-xs font-semibold text-rose-800">{product.message}</p>}
        {productReady && (
          <div className="mt-3 space-y-3">
            <p className="break-all rounded-xl bg-slate-50 p-3 font-mono text-xs font-bold text-slate-900">
              {barcode || 'Sem código de barras'}
            </p>
            {product.status === 'known' && (
              <p className="rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-900">
                Material reconhecido: {product.material.description} · {materialUnitLabel(product.material)}
              </p>
            )}
            {product.status === 'unknown' && (
              <label className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">
                <input type="checkbox" checked={product.confirmed} disabled={working} onChange={(event) => {
                  setProduct({ ...product, confirmed: event.target.checked });
                  renewOperation();
                }} className="mt-1 h-4 w-4" />
                Vincular este código ainda desconhecido ao material escolhido na confirmação.
              </label>
            )}
            <button type="button" disabled={working} onClick={reset}
              className="min-h-10 w-full rounded-xl border border-slate-200 text-xs font-black text-slate-700">
              Trocar material / etiqueta
            </button>
          </div>
        )}
      </section>

      {productReady && (
        <>
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-black text-slate-950">2 · Descrição e unidade</h2>
            {!knownMaterial && (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={working} onClick={() => { setMode('new'); setSelectedId(''); renewOperation(); }}
                  className={'min-h-11 rounded-2xl text-xs font-black ' + (mode === 'new' ? 'bg-[#00288e] text-white' : 'border border-slate-300 text-slate-700')}>
                  Novo material
                </button>
                <button type="button" disabled={working} onClick={() => { setMode('existing'); renewOperation(); }}
                  className={'min-h-11 rounded-2xl text-xs font-black ' + (mode === 'existing' ? 'bg-[#00288e] text-white' : 'border border-slate-300 text-slate-700')}>
                  Já cadastrado
                </button>
              </div>
            )}
            {activeMode === 'existing' ? (
              knownMaterial ? (
                <p className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-900">
                  {knownMaterial.description} · {materialUnitLabel(knownMaterial)}
                </p>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700">Pesquisar material existente
                    <input value={search} disabled={working} onChange={(event) => setSearch(event.target.value)}
                      placeholder="Descrição ou código" className={inputClass} />
                  </label>
                  {catalogStatus === 'loading' && <p className="mt-2 text-xs text-slate-600">Carregando catálogo…</p>}
                  {catalogStatus === 'error' && (
                    <button type="button" onClick={() => setCatalogStatus('idle')}
                      className="mt-2 min-h-10 rounded-xl border px-3 text-xs font-bold">Tentar carregar novamente</button>
                  )}
                  <div className="mt-2 max-h-48 space-y-1 overflow-auto">
                    {filtered.map((item) => (
                      <button type="button" key={item.id} disabled={working} onClick={() => { setSelectedId(item.id); renewOperation(); }}
                        className={'min-h-12 w-full rounded-xl border px-3 py-2 text-left text-xs font-semibold ' +
                          (selectedId === item.id ? 'border-blue-500 bg-blue-50 text-blue-950' : 'border-slate-200 text-slate-800')}>
                        {item.description} · {materialUnitLabel(item)}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">Consulta limitada aos primeiros 150 materiais ativos. Se não encontrar, use o cadastro completo no desktop.</p>
                </div>
              )
            ) : (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700">Descrição do material
                  <input value={description} maxLength={240} disabled={working} onChange={(event) => { setDescription(event.target.value); renewOperation(); }}
                    placeholder="Ex.: Suco de uva integral" className={inputClass} />
                </label>
                <label className="block text-xs font-bold text-slate-700">Unidade / apresentação
                  <input value={unit} maxLength={80} disabled={working} onChange={(event) => { setUnit(event.target.value); renewOperation(); }}
                    placeholder="UN, KG, L, CX..." className={inputClass} />
                </label>
              </div>
            )}
            <label className="block text-xs font-bold text-slate-700">Quantidade em unidade-base
              <input type="number" inputMode="decimal" step="any" min="0.000001" value={quantity} disabled={working}
                onChange={(event) => { setQuantity(event.target.value); renewOperation(); }} className={inputClass} />
            </label>
            <label className="block text-xs font-bold text-slate-700">Procedência do material
              <input value={provenance} maxLength={180} disabled={working}
                onChange={(event) => { setProvenance(event.target.value); renewOperation(); }}
                placeholder="Ex.: doação, estoque anterior..." className={inputClass} />
            </label>
            <label className="block text-xs font-bold text-slate-700">Referência da origem · opcional
              <input value={reference} maxLength={160} disabled={working}
                onChange={(event) => { setReference(event.target.value); renewOperation(); }}
                placeholder="Termo ou observação" className={inputClass} />
            </label>
            <label className="block text-xs font-bold text-slate-700">Data de validade · opcional
              <input type="date" value={expiresOn} disabled={working}
                onChange={(event) => { setExpiresOn(event.target.value); renewOperation(); }} className={inputClass} />
            </label>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-black text-slate-950">3 · Etiqueta da prateleira</h2>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
              Leia o Local ou a subposição. O depósito sozinho não recebe estoque.
            </p>
            {location.status !== 'resolved' && (
              <div className="mt-3">
                <WarehouseMobileScanner
                  expectation="EXPECT_LOCATION"
                  identifyScan={classifyWarehouseMobileLocationScan}
                  onValidatedScan={resolveLocation}
                  title="LER PRATELEIRA / LOCAL"
                />
              </div>
            )}
            {location.status === 'resolving' && <p className="mt-3 text-xs text-blue-900">Conferindo a posição…</p>}
            {location.status === 'error' && <p role="alert" className="mt-3 text-xs font-semibold text-rose-800">{location.message}</p>}
            {location.status === 'resolved' && (
              <div className="mt-3">
                <p className="rounded-xl bg-emerald-50 p-3 text-sm font-black text-emerald-950">{location.label}</p>
                <button type="button" disabled={working} onClick={() => {
                  locationRequestRef.current += 1;
                  setLocation({ status: 'idle' });
                  renewOperation();
                }} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 text-xs font-black">
                  Trocar prateleira
                </button>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-black text-slate-950">4 · Confirmar entrada</h2>
            <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">
              Esta confirmação cria uma entrada avulsa auditável, aumenta o saldo oficial e vincula a localização física.
              Não use para corrigir divergências de inventário.
            </p>
            <button type="button" onClick={() => void submit()} disabled={working || !productReady}
              className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#00288e] px-4 text-sm font-black text-white disabled:opacity-50">
              {working ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <PackagePlus className="h-5 w-5" />}
              {working ? 'Registrando…' : 'Confirmar entrada avulsa'}
            </button>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">
              Em caso de falha de rede, confira o estoque antes de tentar novamente. O identificador da operação é preservado para evitar duplicidade.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
