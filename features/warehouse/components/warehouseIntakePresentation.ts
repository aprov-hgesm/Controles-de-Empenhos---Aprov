import type { WarehouseItemIntakeEffectiveStatus } from '../../../lib/warehouse/intakeState';
import type { WarehouseInvoiceIntakeQueueRow } from '../../../lib/warehouse/intakeStateRepository';

export function warehouseIntakeStatusLabel(
  status: WarehouseItemIntakeEffectiveStatus
): string {
  switch (status) {
    case 'PENDING':
      return 'Pendente';
    case 'PARTIALLY_PROCESSED':
      return 'Parcialmente tratado';
    case 'PROCESSED':
      return 'Tratado';
    case 'RECONCILIATION_REQUIRED':
      return 'Reconciliação necessária';
  }
}

export function warehouseIntakeStatusClass(
  status: WarehouseItemIntakeEffectiveStatus
): string {
  switch (status) {
    case 'PENDING':
      return 'bg-amber-100 text-amber-700';
    case 'PARTIALLY_PROCESSED':
      return 'bg-blue-100 text-blue-700';
    case 'PROCESSED':
      return 'bg-emerald-100 text-emerald-700';
    case 'RECONCILIATION_REQUIRED':
      return 'bg-rose-100 text-rose-700';
  }
}

export function warehouseIntakeReconciliationMessage(
  row: WarehouseInvoiceIntakeQueueRow
): string | null {
  switch (row.reconciliationReason) {
    case 'CANONICAL_QUANTITY_CHANGED':
      return 'A quantidade atual da NF diverge do estado logístico preservado. Nenhuma correção foi aplicada automaticamente.';
    case 'CANONICAL_SOURCE_MISSING':
      return 'A NF ou o item não está mais presente na fonte canônica consultada. O histórico warehouse foi preservado sem compensação automática.';
    case 'LEGACY_INVOICE_PROJECTION':
      return 'Existe projeção logística legada para este item, mas não há estado de tratamento compatível com o novo motor. Revisão será necessária antes de nova movimentação.';
    default:
      return null;
  }
}

export function warehouseImmediateConsumptionErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || '');
  const mappings: Array<[string, string]> = [
    ['WAREHOUSE_ITEM_INTAKE_CONCURRENT_MODIFICATION', 'A pendência foi alterada em outra tela. Atualize a fila antes de repetir.'],
    ['WAREHOUSE_IMMEDIATE_CONSUMPTION_EXCEEDS_PENDING', 'A quantidade supera o pendente atual.'],
    ['WAREHOUSE_IMMEDIATE_CONSUMPTION_STOCK_MISMATCH', 'A projeção logística não comporta esta parcela. O item precisa ser reconciliado.'],
    ['WAREHOUSE_ITEM_INTAKE_RECONCILIATION_REQUIRED', 'O item exige reconciliação antes do consumo imediato.'],
    ['WAREHOUSE_DESTINATION_INACTIVE', 'O destino selecionado está inativo.'],
    ['WAREHOUSE_WITHDRAWN_BY_REQUIRED', 'Informe quem recebeu/retirou o material.'],
    ['WAREHOUSE_IDEMPOTENCY_CONFLICT', 'A tentativa anterior possui conteúdo diferente. Atualize a fila antes de continuar.'],
    ['WAREHOUSE_CONSUMPTION_IDEMPOTENCY_CONFLICT', 'A tentativa anterior de consumo possui conteúdo diferente. Atualize a fila antes de continuar.'],
  ];
  for (const [code, message] of mappings) {
    if (raw.includes(code)) return message;
  }
  return raw || 'Não foi possível confirmar o consumo imediato.';
}

export function warehouseAllocationErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : String(error || '');
  if (code.includes('WAREHOUSE_ITEM_INTAKE_CONCURRENT_MODIFICATION')) {
    return 'A pendência foi alterada em outra tela. A operação não foi executada; atualize a fila antes de continuar.';
  }
  if (
    code.includes('WAREHOUSE_ITEM_INTAKE_RECONCILIATION_REQUIRED')
    || code.includes('WAREHOUSE_ITEM_INTAKE_LEGACY_COMPLETED')
  ) {
    return 'O item exige reconciliação antes de uma nova alocação. Nenhum saldo foi movimentado.';
  }
  if (code.includes('WAREHOUSE_INTAKE_ALLOCATION_EXCEEDS_PENDING')) {
    return 'A quantidade informada supera a quantidade pendente atual.';
  }
  if (code.includes('WAREHOUSE_TRANSFER_INSUFFICIENT_STOCK')) {
    return 'A quantidade disponível em Sem localização não é suficiente. O item precisa ser reconciliado.';
  }
  if (
    code.includes('WAREHOUSE_POSITION_INACTIVE')
    || code.includes('WAREHOUSE_SUBPOSITION_INACTIVE')
    || code.includes('WAREHOUSE_POSITION_NOT_FOUND')
  ) {
    return 'O depósito, localização ou subposição deixou de estar disponível. Selecione uma posição ativa.';
  }
  if (code.includes('WAREHOUSE_INTAKE_LOT_CONFLICT')) {
    return 'Já existe um registro de validade nessa posição com dados diferentes. Revise a validade.';
  }
  if (code.includes('WAREHOUSE_BARCODE_MATERIAL_CONFLICT')) {
    return 'Este código de barras já está associado a outro material e não pode ser reutilizado.';
  }
  if (
    code.includes('WAREHOUSE_BARCODE_PRESENTATION_CONFLICT')
    || code.includes('WAREHOUSE_BARCODE_INACTIVE')
  ) {
    return 'O código de barras existente não é compatível com esta apresentação ou está inativo.';
  }
  if (code.includes('WAREHOUSE_IDEMPOTENCY_CONFLICT')) {
    return 'A tentativa anterior já possui uma operação com dados diferentes. Atualize a fila antes de repetir.';
  }
  if (code.includes('WAREHOUSE_INTAKE_LOT_REQUIRED')) {
    return 'Não foi possível criar a referência técnica de validade. Atualize a fila e tente novamente.';
  }
  if (code.includes('WAREHOUSE_INTAKE_INVALID_EXPIRY')) {
    return 'Informe uma validade válida ou marque explicitamente Sem validade.';
  }
  return error instanceof Error
    ? error.message
    : 'Não foi possível confirmar a alocação.';
}

export function normalizeWarehouseQueueSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}
