'use client';

import {
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useRef, useState, type ReactNode } from 'react';

import type { WarehouseBarcodeAssociation } from '../../../lib/warehouse/barcode';
import { getWarehouseBarcodeByCode } from '../../../lib/warehouse/barcodeRepository';
import { warehouseStockPositionKey } from '../../../lib/warehouse/location';
import type { WarehouseStockPositionResolveResult } from '../../../lib/warehouse/locationBarcode';
import { resolveWarehouseStockPositionBarcode } from '../../../lib/warehouse/locationBarcodeResolver';
import {
  warehouseLotExpiryState,
  type WarehouseLot,
} from '../../../lib/warehouse/lot';
import { classifyWarehouseMobileLocationScan } from '../../../lib/warehouse/mobileLocationScan';
import {
  classifyWarehouseMobileOutboundProductScan,
  prepareWarehouseMobileOutboundOptions,
  prepareWarehouseMobileOutboundReview,
  warehouseMobileOutboundScannedPositionMatches,
  type WarehouseMobileOutboundPositionOption,
  type WarehouseMobileOutboundPreparation,
} from '../../../lib/warehouse/mobileOutbound';
import {
  loadWarehouseMobileOutboundAvailability,
  type WarehouseMobileOutboundAvailability,
} from '../../../lib/warehouse/mobileOutboundRepository';
import type { WarehouseMobileScanEvent } from '../../../lib/warehouse/mobileScanner';
import {
  createWarehouseWithdrawalId,
  createWarehouseWithdrawalLineId,
  normalizeWarehouseDestinationName,
} from '../../../lib/warehouse/withdrawal';
import {
  finalizeWarehouseMaterialWithdrawal,
  listWarehouseDestinationsCached,
} from '../../../lib/warehouse/withdrawalRepository';
import { useWarehouseWorkspaceContext } from '../components/WarehouseModuleContext';
import { WarehouseMobileScanner } from './WarehouseMobileScanner';

type ResolvedPosition = Extract<
  WarehouseStockPositionResolveResult,
  { ok: true }
>['value'];

type ProductState = {
  barcode: string;
  association: WarehouseBarcodeAssociation;
  availability: WarehouseMobileOutboundAvailability;
};

type PositionSelection = {
  option: WarehouseMobileOutboundPositionOption;
  label: string;
};

type ReviewState = {
  withdrawalId: string;
  lineId: string;
  lotId: string | null;
  planBaseQuantity: number;
};

type SuccessState = {
  applied: boolean;
  withdrawalId: string;
  movementId: string | null;
  aggregateQuantity: number;
  locationQuantity: number;
  lotQuantity: number | null;
};

function formatQty(value: number) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
}

function unitLabel(code: string, label: string | null) {
  return label || ({
    unit: 'un',
    kg: 'kg',
    g: 'g',
    l: 'L',
    ml: 'mL',
    package: 'pacote',
    box: 'caixa',
    bundle: 'fardo',
    other: 'unidade',
  } as Record<string, string>)[code] || code;
}

function resolvedPositionLabel(value: ResolvedPosition) {
  if (value.position.kind === 'LOCATION') {
    return value.depot.code + ' · ' + (value.location?.code || value.position.locationId);
  }
  if (value.position.kind === 'SUBPOSITION') {
    return value.depot.code
      + ' · '
      + (value.parentLocation?.code || value.position.locationId)
      + ' · '
      + (value.location?.code || value.position.subpositionId);
  }
  return 'Posição não física';
}

function expiryLabel(expiresOn: string | null) {
  if (!expiresOn) return 'Validade não informada';
  const [year, month, day] = expiresOn.split('-');
  return day && month && year ? day + '/' + month + '/' + year : expiresOn;
}

function lotStateLabel(lot: WarehouseLot) {
  const state = warehouseLotExpiryState(lot);
  if (state === 'EXPIRED') return 'Vencido — não recomendado pelo FEFO';
  if (state === 'INACTIVE') return 'Lote inativo';
  if (state === 'DEPLETED') return 'Sem quantidade atribuída';
  if (state === 'NO_EXPIRY') return 'Sem validade informada';
  if (state === 'NEAR_EXPIRY') return 'Próximo do vencimento';
  return 'Válido';
}

function positionResolutionError(error: string) {
  if (error === 'DEPOT_NOT_STOCK_POSITION') {
    return 'Depósito não é posição de estoque. Leia um LOCAL ou SUBPOSIÇÃO.';
  }
  if (error === 'WORKSPACE_MISMATCH' || error === 'UG_MISMATCH') {
    return 'A etiqueta pertence a outro workspace/UG.';
  }
  if (error === 'ENTITY_INACTIVE') return 'A posição ficou inativa.';
  if (error === 'ENTITY_NOT_FOUND') return 'A posição não existe mais.';
  return 'A posição não pôde ser revalidada no cadastro autoritativo.';
}

function preparationError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('WAREHOUSE_OUTBOUND_INVALID_QUANTITY')) {
    return 'Informe uma quantidade maior que zero, com até seis casas decimais.';
  }
  if (raw.includes('WAREHOUSE_OUTBOUND_INSUFFICIENT_STOCK')) {
    return 'O saldo agregado é insuficiente para esta saída.';
  }
  if (raw.includes('WAREHOUSE_OUTBOUND_LOCATION_INSUFFICIENT_STOCK')) {
    return 'Nenhuma posição ativa possui saldo físico suficiente para a quantidade informada.';
  }
  if (raw.includes('WAREHOUSE_BARCODE_INACTIVE')) return 'O código de barras está inativo.';
  if (raw.includes('WAREHOUSE_BARCODE_MATERIAL_CONVERSION_MISMATCH')) {
    return 'O código de barras não corresponde ao material canônico.';
  }
  if (raw.includes('WAREHOUSE_OUTBOUND_LOT_INACTIVE')) return 'O lote selecionado está inativo.';
  if (raw.includes('WAREHOUSE_OUTBOUND_LOT_POSITION_MISMATCH')) {
    return 'O lote selecionado não pertence à posição escolhida.';
  }
  if (raw.includes('WAREHOUSE_OUTBOUND_LOT_INSUFFICIENT_ATTRIBUTION')) {
    return 'O lote selecionado não possui atribuição suficiente para esta saída.';
  }
  if (
    raw.includes('WAREHOUSE_MOBILE_OUTBOUND_LOCATION_LIMIT')
    || raw.includes('WAREHOUSE_MOBILE_OUTBOUND_LOT_LIMIT')
  ) {
    return 'A leitura crítica excedeu o limite seguro. Use a Central desktop para revisar este material.';
  }
  if (raw.includes('WAREHOUSE_MOBILE_OUTBOUND_')) {
    return 'Os dados autoritativos da saída não puderam ser validados com segurança.';
  }
  return 'Não foi possível preparar a saída. Revalide os dados e tente novamente.';
}

function confirmationError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('WAREHOUSE_OUTBOUND_INSUFFICIENT_STOCK')) {
    return 'O saldo agregado mudou antes da confirmação. A saída não foi aplicada.';
  }
  if (raw.includes('WAREHOUSE_OUTBOUND_LOCATION_INSUFFICIENT_STOCK')) {
    return 'O saldo da posição mudou antes da confirmação. A saída não foi aplicada.';
  }
  if (
    raw.includes('WAREHOUSE_BARCODE_INACTIVE')
    || raw.includes('WAREHOUSE_BARCODE_CHANGED')
    || raw.includes('WAREHOUSE_BARCODE_MATERIAL_CONVERSION_MISMATCH')
  ) {
    return 'O barcode mudou ou ficou inválido antes da confirmação. A saída não foi aplicada.';
  }
  if (
    raw.includes('WAREHOUSE_OUTBOUND_LOT_INACTIVE')
    || raw.includes('WAREHOUSE_OUTBOUND_LOT_POSITION_MISMATCH')
    || raw.includes('WAREHOUSE_OUTBOUND_LOT_INSUFFICIENT_ATTRIBUTION')
    || raw.includes('WAREHOUSE_OUTBOUND_LOT_NOT_FOUND')
  ) {
    return 'O lote mudou e não atende mais à saída preparada. A saída não foi aplicada.';
  }
  if (raw.includes('WAREHOUSE_MOBILE_OUTBOUND_DESTINATION_NOT_FOUND')) {
    return 'O destino informado não corresponde a um destino ativo cadastrado na Central.';
  }
  if (raw.includes('WAREHOUSE_MOBILE_OUTBOUND_DESTINATION_AMBIGUOUS')) {
    return 'Há mais de um destino ativo com esse nome. Revise o cadastro na Central desktop.';
  }
  if (raw.includes('WAREHOUSE_DESTINATION_INACTIVE')) {
    return 'O destino ficou inativo antes da confirmação. A saída não foi aplicada.';
  }
  if (
    raw.includes('WAREHOUSE_IDEMPOTENCY_CONFLICT')
    || raw.includes('WAREHOUSE_WITHDRAWAL_IDEMPOTENCY_CONFLICT')
  ) {
    return 'Conflito de idempotência: a identidade da retirada já representa outra solicitação. Recomece a jornada.';
  }
  if (raw.startsWith('POSITION:')) return positionResolutionError(raw.slice(9));
  if (raw.includes('POSITION_CHANGED')) {
    return 'A etiqueta escaneada não corresponde mais à posição escolhida. Refaça a leitura.';
  }
  if (raw.includes('PRODUCT_CHANGED')) {
    return 'O barcode deixou de apontar para o material preparado. Recomece a jornada.';
  }
  return 'Resultado não confirmado. Não assuma sucesso: toque novamente em CONFIRMAR SAÍDA para executar replay seguro com a mesma chave de idempotência.';
}

export function WarehouseMobileOutbound() {
  const workspace = useWarehouseWorkspaceContext();
  const requestRef = useRef(0);
  const [destination, setDestination] = useState('');
  const [pickedBy, setPickedBy] = useState('');
  const [partyReady, setPartyReady] = useState(false);
  const [product, setProduct] = useState<ProductState | null>(null);
  const [quantityText, setQuantityText] = useState('');
  const [preparation, setPreparation] =
    useState<WarehouseMobileOutboundPreparation | null>(null);
  const [position, setPosition] = useState<PositionSelection | null>(null);
  const [scannedPosition, setScannedPosition] =
    useState<{ code: string; value: ResolvedPosition } | null>(null);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reset = useCallback(() => {
    requestRef.current += 1;
    setDestination('');
    setPickedBy('');
    setPartyReady(false);
    setProduct(null);
    setQuantityText('');
    setPreparation(null);
    setPosition(null);
    setScannedPosition(null);
    setReview(null);
    setSuccess(null);
    setMessage(null);
    setWorking(false);
  }, []);

  const resolvePosition = useCallback(async (code: string) => {
    if (!workspace.ug) throw new Error('WAREHOUSE_MOBILE_UG_REQUIRED');
    const result = await resolveWarehouseStockPositionBarcode({
      code,
      workspaceId: workspace.workspaceId,
      ug: workspace.ug,
    });
    if (!result.ok) throw new Error('POSITION:' + result.error);
    return result.value;
  }, [workspace.ug, workspace.workspaceId]);

  const confirmWithdrawalParty = () => {
    const normalizedDestination = destination.trim();
    const normalizedPickedBy = pickedBy.trim();
    if (normalizedDestination.length < 2 || normalizedPickedBy.length < 2) {
      setMessage('Informe destino da retirada e retirado por antes de confirmar a saída.');
      return;
    }
    setDestination(normalizedDestination);
    setPickedBy(normalizedPickedBy);
    setPartyReady(true);
    setMessage(null);
  };

  const resetProduct = useCallback(() => {
    requestRef.current += 1;
    setProduct(null);
    setQuantityText('');
    setPreparation(null);
    setPosition(null);
    setScannedPosition(null);
    setReview(null);
    setDestination('');
    setPickedBy('');
    setPartyReady(false);
    setSuccess(null);
    setMessage(null);
  }, []);

  const scanProduct = useCallback((event: WarehouseMobileScanEvent) => {
    if (!workspace.ug) return;
    const requestId = ++requestRef.current;
    setWorking(true);
    setMessage(null);
    setSuccess(null);

    void (async () => {
      const association = await getWarehouseBarcodeByCode(
        workspace.workspaceId,
        event.value
      );
      if (!association) throw new Error('PRODUCT_UNKNOWN');
      if (association.status !== 'active') throw new Error('WAREHOUSE_BARCODE_INACTIVE');
      if (association.ug !== workspace.ug) throw new Error('PRODUCT_SCOPE_MISMATCH');

      const availability = await loadWarehouseMobileOutboundAvailability(
        workspace.workspaceId,
        association.materialId
      );
      if (
        availability.material.status !== 'active'
        || availability.material.id !== association.materialId
        || availability.material.ug !== workspace.ug
      ) {
        throw new Error('MATERIAL_INACTIVE');
      }

      if (requestId !== requestRef.current) return;
      setProduct({ barcode: event.value, association, availability });
      setQuantityText('');
      setPreparation(null);
      setPosition(null);
      setScannedPosition(null);
      setReview(null);
    })().catch((error) => {
      if (requestId !== requestRef.current) return;
      const raw = error instanceof Error ? error.message : String(error);
      if (raw.includes('PRODUCT_UNKNOWN')) {
        setMessage('Código comercial não encontrado. A leitura não gera baixa nem cria material.');
      } else if (raw.includes('WAREHOUSE_BARCODE_INACTIVE')) {
        setMessage('O código comercial está inativo e não pode iniciar uma saída.');
      } else if (raw.includes('PRODUCT_SCOPE_MISMATCH')) {
        setMessage('O código comercial pertence a outra UG.');
      } else {
        setMessage(preparationError(error));
      }
    }).finally(() => {
      if (requestId === requestRef.current) setWorking(false);
    });
  }, [workspace.ug, workspace.workspaceId]);

  const acceptQuantity = () => {
    if (!product) return;
    try {
      const requestedQuantity = Number(quantityText.trim().replace(',', '.'));
      const prepared = prepareWarehouseMobileOutboundOptions({
        material: product.availability.material,
        balance: product.availability.balance,
        barcodeAssociation: product.association,
        requestedQuantity,
        locationBalances: product.availability.locationBalances,
        lots: product.availability.lots,
      });
      setPreparation(prepared);
      setPosition(null);
      setScannedPosition(null);
      setReview(null);
      setMessage(null);
    } catch (error) {
      setMessage(preparationError(error));
    }
  };

  const positionLabel = useCallback(
    (option: WarehouseMobileOutboundPositionOption) =>
      product?.availability.positionLabels.find(
        (item) => item.key === option.key
      )?.label || option.key,
    [product]
  );

  const choosePosition = (option: WarehouseMobileOutboundPositionOption) => {
    setPosition({ option, label: positionLabel(option) });
    setScannedPosition(null);
    setReview(null);
    setPartyReady(false);
    setMessage(null);
  };

  const scanPosition = useCallback((event: WarehouseMobileScanEvent) => {
    if (!position) return;
    const requestId = ++requestRef.current;
    setWorking(true);
    setMessage(null);
    void resolvePosition(event.value).then((value) => {
      if (requestId !== requestRef.current) return;
      if (
        !warehouseMobileOutboundScannedPositionMatches(
          value.position,
          position.option.position
        )
      ) {
        setMessage('Posição incorreta. A etiqueta lida não corresponde à posição escolhida para esta saída.');
        return;
      }
      setScannedPosition({ code: event.value, value });
      setReview(null);
    }).catch((error) => {
      if (requestId !== requestRef.current) return;
      const raw = error instanceof Error ? error.message : String(error);
      setMessage(
        raw.startsWith('POSITION:')
          ? positionResolutionError(raw.slice(9))
          : 'Falha ao revalidar a posição.'
      );
    }).finally(() => {
      if (requestId === requestRef.current) setWorking(false);
    });
  }, [position, resolvePosition]);

  const chooseLot = (lot: WarehouseLot | null) => {
    if (!product || !preparation || !position || !scannedPosition) return;
    try {
      const plan = prepareWarehouseMobileOutboundReview({
        material: product.availability.material,
        balance: product.availability.balance,
        barcodeAssociation: product.association,
        requestedQuantity: preparation.requestedQuantity,
        position: position.option.position,
        locationBalance: position.option.balance,
        lot,
      });
      setReview({
        withdrawalId: createWarehouseWithdrawalId(),
        lineId: createWarehouseWithdrawalLineId(),
        lotId: lot?.id || null,
        planBaseQuantity: plan.baseQuantity,
      });
      setMessage(null);
    } catch (error) {
      setMessage(preparationError(error));
    }
  };

  const confirm = useCallback(async () => {
    if (
      !product
      || !preparation
      || !position
      || !scannedPosition
      || !review
      || !partyReady
    ) {
      return;
    }
    setWorking(true);
    setMessage(null);
    setSuccess(null);

    try {
      const [freshPosition, freshAssociation] = await Promise.all([
        resolvePosition(scannedPosition.code),
        getWarehouseBarcodeByCode(workspace.workspaceId, product.barcode),
      ]);
      if (
        !warehouseMobileOutboundScannedPositionMatches(
          freshPosition.position,
          position.option.position
        )
      ) {
        throw new Error('POSITION_CHANGED');
      }
      if (
        !freshAssociation
        || freshAssociation.materialId !== product.association.materialId
      ) {
        throw new Error('PRODUCT_CHANGED');
      }

      const destinationKey = normalizeWarehouseDestinationName(destination)
        .toLocaleLowerCase('pt-BR');
      const destinationMatches = (await listWarehouseDestinationsCached(
        workspace.workspaceId
      )).filter((item) =>
        item.destination.status === 'active'
        && normalizeWarehouseDestinationName(item.destination.name)
          .toLocaleLowerCase('pt-BR') === destinationKey
      );
      if (destinationMatches.length === 0) {
        throw new Error('WAREHOUSE_MOBILE_OUTBOUND_DESTINATION_NOT_FOUND');
      }
      if (destinationMatches.length > 1) {
        throw new Error('WAREHOUSE_MOBILE_OUTBOUND_DESTINATION_AMBIGUOUS');
      }
      const canonicalDestination = destinationMatches[0].destination;
      const selectedLot = position.option.lots.find(
        (lot) => lot.id === review.lotId
      ) || null;

      const result = await finalizeWarehouseMaterialWithdrawal(
        workspace.workspaceId,
        {
          withdrawalId: review.withdrawalId,
          destinationId: canonicalDestination.id,
          withdrawnBy: pickedBy,
          lines: [{
            lineId: review.lineId,
            materialId: product.association.materialId,
            materialDescription: product.availability.material.description,
            requestedQuantity: preparation.requestedQuantity,
            presentation: freshAssociation.presentation,
            presentationLabel: unitLabel(
              freshAssociation.presentation.code,
              freshAssociation.presentation.label
            ),
            baseQuantity: review.planBaseQuantity,
            unitLabel: unitLabel(
              product.availability.material.unit.code,
              product.availability.material.unit.label
            ),
            position: freshPosition.position,
            positionLabel: position.label,
            barcodeAssociation: freshAssociation,
            barcode: product.barcode,
            lotId: review.lotId,
            lotCode: selectedLot?.code || null,
          }],
        }
      );

      const refreshed = await loadWarehouseMobileOutboundAvailability(
        workspace.workspaceId,
        product.association.materialId
      );
      const refreshedLocation = refreshed.locationBalances.find(
        (item) => warehouseStockPositionKey(item.position) === position.option.key
      );
      const refreshedLot = review.lotId
        ? refreshed.lots.find((lot) => lot.id === review.lotId)
        : null;

      setSuccess({
        applied: result.movementIds.length > 0,
        withdrawalId: result.withdrawal.id,
        movementId: result.movementIds[0] || null,
        aggregateQuantity: refreshed.balance.quantity,
        locationQuantity: refreshedLocation?.quantity || 0,
        lotQuantity: review.lotId ? refreshedLot?.quantity || 0 : null,
      });
      setMessage(
        result.movementIds.length > 0
          ? 'Saída confirmada pelo fluxo canônico de retirada e consumo.'
          : 'Replay idempotente confirmado: nenhuma segunda baixa foi criada.'
      );
    } catch (error) {
      setMessage(confirmationError(error));
    } finally {
      setWorking(false);
    }
  }, [
    destination,
    partyReady,
    pickedBy,
    position,
    preparation,
    product,
    resolvePosition,
    review,
    scannedPosition,
    workspace.workspaceId,
  ]);

  const recommendedKey = preparation?.recommendedPosition
    ? warehouseStockPositionKey(preparation.recommendedPosition)
    : null;
  const selectedLots =
    position?.option.lots.filter((lot) => lot.quantity > 0) || [];

  return (
    <div className="space-y-5" data-testid="warehouse-mobile-outbound">
      <header className="rounded-3xl bg-[#00288e] p-5 text-white">
        <Link
          href="/central-mobile"
          className="inline-flex items-center gap-2 text-xs font-black text-blue-100"
        >
          <ArrowLeft className="h-4 w-4" /> Central Móvel
        </Link>
        <h1 className="mt-4 text-2xl font-black">Saída de material</h1>
        <p className="mt-2 text-sm font-semibold text-blue-100">
          Material → quantidade → origem da retirada → lote → destino da retirada → confirmar baixa.
        </p>
      </header>

      {message && (
        <div
          className={`rounded-2xl border p-4 text-xs font-bold ${
            success
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          {message}
        </div>
      )}

      {!product && (
        <Step title="1 · LER MATERIAL">
          <WarehouseMobileScanner
            expectation="EXPECT_PRODUCT"
            identifyScan={classifyWarehouseMobileOutboundProductScan}
            onValidatedScan={scanProduct}
            title="LER MATERIAL"
          />
        </Step>
      )}

      {product && (
        <Card
          title="Material"
          value={product.availability.material.description}
          detail={
            'Apresentação: '
            + unitLabel(
              product.association.presentation.code,
              product.association.presentation.label
            )
            + ' · Unidade oficial: '
            + unitLabel(
              product.availability.material.unit.code,
              product.availability.material.unit.label
            )
            + ' · Saldo agregado: '
            + formatQty(product.availability.balance.quantity)
          }
        />
      )}

      {product && !preparation && (
        <Step title="2 · QUANTIDADE">
          <input
            value={quantityText}
            onChange={(event) => {
              setQuantityText(event.target.value);
              setMessage(null);
            }}
            inputMode="decimal"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 font-black"
            placeholder="0"
            data-testid="warehouse-mobile-outbound-quantity"
          />
          <Primary onClick={acceptQuantity}>Ver origens disponíveis</Primary>
          <Secondary onClick={resetProduct}>Ler outro material</Secondary>
        </Step>
      )}

      {product && preparation && !position && (
        <Step title="3 · ESCOLHER ORIGEM DA RETIRADA">
          <div className="rounded-2xl bg-blue-50 p-3 text-xs font-bold text-blue-900">
            Quantidade: {formatQty(preparation.requestedQuantity)}{' '}
            {unitLabel(
              product.association.presentation.code,
              product.association.presentation.label
            )}
            {' '}→ impacto de {formatQty(preparation.baseQuantity)}{' '}
            {unitLabel(
              product.availability.material.unit.code,
              product.availability.material.unit.label
            )}
          </div>

          {preparation.recommendedLot ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-[10px] font-black uppercase text-emerald-700">
                Origem recomendada por FEFO
              </p>
              <p className="mt-1 text-sm font-black text-emerald-950">
                {positionLabel(
                  preparation.options.find((item) => item.key === recommendedKey)
                    || preparation.options[0]
                )}
              </p>
              <p className="mt-1 text-xs font-semibold text-emerald-800">
                Lote {preparation.recommendedLot.code} ·{' '}
                {expiryLabel(preparation.recommendedLot.expiresOn)}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs font-semibold text-slate-600">
              Sem recomendação FEFO aplicável para a quantidade. Escolha uma origem com saldo suficiente.
            </div>
          )}

          <div className="space-y-2">
            {preparation.options.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => choosePosition(option)}
                className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left"
              >
                <p className="text-sm font-black text-slate-950">
                  {positionLabel(option)}
                  {option.key === recommendedKey ? ' · FEFO' : ''}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Disponível: {formatQty(option.balance.quantity)} unidades-base
                  {option.fefoLot
                    ? ' · lote recomendado '
                      + option.fefoLot.code
                      + ' ('
                      + expiryLabel(option.fefoLot.expiresOn)
                      + ')'
                    : ''}
                </p>
              </button>
            ))}
          </div>
        </Step>
      )}

      {position && (
        <Card
          title="Origem da saída"
          value={position.label}
          detail={'Saldo físico: ' + formatQty(position.option.balance.quantity)}
        />
      )}

      {position && !scannedPosition && (
        <Step title="4 · CONFIRMAR ORIGEM FÍSICA">
          <WarehouseMobileScanner
            expectation="EXPECT_LOCATION"
            identifyScan={classifyWarehouseMobileLocationScan}
            onValidatedScan={scanPosition}
            title="LER ORIGEM DA SAÍDA"
          />
          <Secondary
            onClick={() => {
              setPosition(null);
              setScannedPosition(null);
              setReview(null);
            }}
          >
            Escolher outra origem
          </Secondary>
        </Step>
      )}

      {scannedPosition && (
        <Card
          title="Origem confirmada"
          value={resolvedPositionLabel(scannedPosition.value)}
          detail={scannedPosition.code}
        />
      )}

      {preparation && scannedPosition && position && !review && (
        <Step title="5 · LOTE">
          {selectedLots.length > 0 ? (
            <div className="space-y-2">
              {selectedLots.map((lot) => {
                const eligible =
                  lot.status === 'active'
                  && lot.quantity + 0.000001 >= preparation.baseQuantity;
                return (
                  <button
                    key={lot.id}
                    type="button"
                    disabled={!eligible}
                    onClick={() => chooseLot(lot)}
                    className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left disabled:opacity-45"
                  >
                    <p className="text-sm font-black text-slate-950">
                      Lote {lot.code}
                      {position.option.fefoLot?.id === lot.id
                        ? ' · FEFO recomendado'
                        : ''}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {expiryLabel(lot.expiresOn)}
                      {' · atribuído '}
                      {formatQty(lot.quantity)}
                      {' · '}
                      {lotStateLabel(lot)}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-2xl bg-slate-50 p-4 text-xs font-semibold text-slate-600">
              Nenhum lote atribuído a esta posição. O contrato vigente permite saída sem lote.
            </p>
          )}

          {position.option.fefoLot && (
            <Primary onClick={() => chooseLot(position.option.fefoLot)}>
              Usar lote recomendado por FEFO
            </Primary>
          )}
          <Secondary onClick={() => chooseLot(null)}>Continuar sem lote</Secondary>
        </Step>
      )}

      {review && !partyReady && !success && (
        <Step title="6 · DESTINO DA RETIRADA / RETIRADO POR">
          <p className="rounded-2xl bg-blue-50 p-3 text-xs font-bold leading-5 text-blue-900">
            Estes dados identificam para onde o material saiu e quem realizou a retirada. Não representam outro local de estoque.
          </p>
          <input
            value={destination}
            onChange={(event) => {
              setDestination(event.target.value);
              setMessage(null);
            }}
            maxLength={72}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold"
            placeholder="Destino da retirada"
            data-testid="warehouse-mobile-outbound-destination"
          />
          <input
            value={pickedBy}
            onChange={(event) => {
              setPickedBy(event.target.value);
              setMessage(null);
            }}
            maxLength={72}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold"
            placeholder="Retirado por"
            data-testid="warehouse-mobile-outbound-picked-by"
          />
          <Primary onClick={confirmWithdrawalParty}>Continuar para confirmação</Primary>
        </Step>
      )}

      {review && partyReady && (
        <Card
          title="Destino da retirada"
          value={destination}
          detail={'Retirado por: ' + pickedBy}
        />
      )}

      {product && preparation && position && scannedPosition && review && partyReady && !success && (
        <Step title="7 · REVISAR E CONFIRMAR SAÍDA">
          <div
            className="rounded-3xl border border-emerald-200 bg-white p-5"
            data-testid="warehouse-mobile-outbound-review"
          >
            <p className="flex items-center gap-2 text-sm font-black text-emerald-800">
              <ShieldCheck className="h-5 w-5" />
              Nenhuma baixa foi executada até aqui
            </p>
            <dl className="mt-4 space-y-2 text-xs">
              <Row label="Destino" value={destination} />
              <Row label="Retirado por" value={pickedBy} />
              <Row label="Material" value={product.availability.material.description} />
              <Row
                label="Apresentação"
                value={unitLabel(
                  product.association.presentation.code,
                  product.association.presentation.label
                )}
              />
              <Row
                label="Quantidade"
                value={
                  formatQty(preparation.requestedQuantity)
                  + ' → '
                  + formatQty(review.planBaseQuantity)
                  + ' '
                  + unitLabel(
                    product.availability.material.unit.code,
                    product.availability.material.unit.label
                  )
                }
              />
              <Row
                label="Origem da retirada"
                value={resolvedPositionLabel(scannedPosition.value)}
              />
              <Row
                label="Lote"
                value={
                  review.lotId
                    ? (
                      position.option.lots.find(
                        (lot) => lot.id === review.lotId
                      )?.code || review.lotId
                    )
                    : 'Sem lote selecionado'
                }
              />
              {review.lotId && (
                <Row
                  label="Validade"
                  value={expiryLabel(
                    position.option.lots.find(
                      (lot) => lot.id === review.lotId
                    )?.expiresOn || null
                  )}
                />
              )}
            </dl>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={working}
              className="mt-5 min-h-12 w-full rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white disabled:opacity-50"
              data-testid="warehouse-mobile-outbound-confirm"
            >
              {working ? 'REVALIDANDO…' : 'CONFIRMAR SAÍDA'}
            </button>
            <Secondary
              onClick={() => {
                setPartyReady(false);
                setMessage(null);
              }}
            >
              Alterar destino/retirado por
            </Secondary>
            <p className="mt-3 text-[10px] font-semibold leading-4 text-slate-500">
              Em falha de conexão após o clique, esta tela preserva a mesma chave de idempotência para replay seguro.
            </p>
          </div>
        </Step>
      )}

      {success && (
        <section
          className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5"
          data-testid="warehouse-mobile-outbound-success"
        >
          <p className="flex items-center gap-2 text-sm font-black text-emerald-950">
            <CheckCircle2 className="h-5 w-5" />
            {success.applied
              ? 'Saída concluída'
              : 'Replay idempotente confirmado'}
          </p>
          <p className="mt-2 text-xs font-semibold text-emerald-800">
            Saldo agregado: {formatQty(success.aggregateQuantity)}
            {' · Posição: '}
            {formatQty(success.locationQuantity)}
            {success.lotQuantity !== null
              ? ' · Lote: ' + formatQty(success.lotQuantity)
              : ''}
          </p>
          <p className="mt-2 break-all font-mono text-[9px] text-emerald-700">
            {success.withdrawalId}
            {success.movementId ? ' · ' + success.movementId : ''}
          </p>
          <Primary onClick={reset}>Nova saída</Primary>
        </section>
      )}

      {working && !review && (
        <p className="flex items-center justify-center gap-2 rounded-2xl bg-blue-50 p-3 text-xs font-bold text-blue-900">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Revalidando dados autoritativos…
        </p>
      )}

      <p className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-[11px] font-semibold text-slate-500">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        Saída reduz somente estoque físico localizado e nunca transfere material para outra posição. A confirmação reutiliza o fluxo canônico de retirada/consumo da Central, com OUTBOUND transacional e replay idempotente.
      </p>
    </div>
  );
}

function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      {children}
    </section>
  );
}

function Card({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-[9px] font-black uppercase text-emerald-700">{title}</p>
      <p className="mt-1 text-sm font-black text-emerald-950">{value}</p>
      <p className="mt-1 break-all text-[10px] font-semibold text-emerald-700">
        {detail}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <dt className="text-[9px] font-black uppercase text-slate-400">{label}</dt>
      <dd className="mt-1 font-black text-slate-800">{value}</dd>
    </div>
  );
}

function Primary({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 min-h-12 w-full rounded-2xl bg-[#00288e] px-4 text-sm font-black text-white"
    >
      {children}
    </button>
  );
}

function Secondary({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600"
    >
      {children}
    </button>
  );
}
