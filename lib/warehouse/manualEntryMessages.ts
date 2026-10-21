/**
 * Mensagens comuns ao formulário desktop e ao operador móvel.
 * Falhas do Firestore nunca são traduzidas como "código inexistente".
 */
export function warehouseManualEntryErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || '');
  const match = (key: string) => raw.includes(key);
  if (match('WAREHOUSE_MANUAL_ENTRY_POSITION_REQUIRED')) {
    return 'Selecione ou leia novamente uma posição física ativa do depósito.';
  }
  if (match('WAREHOUSE_MANUAL_ENTRY_INVALID_EXPIRY')) {
    return 'Informe uma data de validade válida ou deixe em branco.';
  }
  if (match('WAREHOUSE_MANUAL_ENTRY_PROVENANCE_REQUIRED')) {
    return 'Informe a procedência do material.';
  }
  if (match('WAREHOUSE_MANUAL_ENTRY_MATERIAL_NOT_FOUND')
    || match('WAREHOUSE_MANUAL_ENTRY_MATERIAL_INACTIVE')) {
    return 'Material não encontrado ou inativo. Atualize o cadastro.';
  }
  if (match('WAREHOUSE_MANUAL_ENTRY_MATERIAL_CONFLICT')) {
    return 'O cadastro do material mudou. Confira os dados antes de repetir.';
  }
  if (match('WAREHOUSE_BARCODE_ALREADY_LINKED')) {
    return 'O código de barras já pertence a outro material ou está inativo. Confira o vínculo antes de registrar.';
  }
  if (match('WAREHOUSE_BARCODE_RESERVED_LOCATION_NAMESPACE')) {
    return 'Este código identifica uma posição do depósito, não um material.';
  }
  if (match('WAREHOUSE_MANUAL_ENTRY_BARCODE_INVALID') || match('WAREHOUSE_INVALID_BARCODE')) {
    return 'Código de barras inválido ou incompatível com a unidade do material.';
  }
  if (match('WAREHOUSE_IDEMPOTENCY_CONFLICT')) {
    return 'Esta operação já foi usada com outros dados. Atualize a tela antes de tentar novamente.';
  }
  if (match('WAREHOUSE_MANUAL_ENTRY_ENRICHMENT_PENDING')) {
    return 'O estoque já foi registrado, mas faltou concluir lote ou código de barras. '
      + 'Mantenha os dados e tente novamente: o mesmo lançamento não será duplicado.';
  }
  if (match('WAREHOUSE_MANUAL_ENTRY_PROJECTION_INCONSISTENT')) {
    return 'Há divergência entre o movimento e o saldo. Não repita até conferir o estoque.';
  }
  if (match('WAREHOUSE_MANUAL_ENTRY_LOT_CONFLICT')) {
    return 'O lote desta operação tem dados diferentes. Confira a validade antes de repetir.';
  }
  if (match('permission-denied') || match('PERMISSION_DENIED')
    || match('Missing or insufficient permissions')) {
    return 'O Firestore recusou a entrada. Nenhuma gravação desta transação foi confirmada.';
  }
  if (error instanceof TypeError) {
    return 'Falha de conexão. O rascunho foi preservado; confira o estoque antes de repetir.';
  }
  return raw || 'Não foi possível confirmar a entrada. Confira o estoque antes de repetir.';
}
