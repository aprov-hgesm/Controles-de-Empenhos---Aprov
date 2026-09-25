'use client';

import { WarehouseMaterialWithdrawal } from './WarehouseMaterialWithdrawal';

/**
 * Compatibilidade da FASE 8.
 *
 * A antiga superfície "Saída Expressa" foi absorvida por Saída de Material.
 * O export permanece para rotas/imports legados, mas não existe segundo motor:
 * WarehouseMaterialWithdrawal reutiliza o OUTBOUND oficial.
 */
export function WarehouseExpressOutbound({
  workspaceId,
}: {
  workspaceId: string;
}) {
  return <WarehouseMaterialWithdrawal workspaceId={workspaceId} />;
}
