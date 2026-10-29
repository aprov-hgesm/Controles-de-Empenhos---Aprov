/**
 * Projeção de leitura para o Painel: um único percurso pelos empenhos.
 *
 * Normal: rowsLimit=Infinity preserva todas as linhas.
 * Essencial: preserva contagem e somas de TODOS os registros filtrados,
 * enquanto mantém em memória de renderização somente os primeiros N.
 * Nunca altera os itens, estado Firestore, saldo ou os dados de exportação.
 */
export interface DashboardAmount {
  committed: number;
  received: number;
}

export interface DashboardRowsProjection<T> {
  visibleRows: T[];
  matchedCount: number;
  committed: number;
  received: number;
}

export function projectDashboardRows<T>(
  records: readonly T[],
  matches: (record: T) => boolean,
  getAmounts: (record: T) => DashboardAmount | undefined,
  rowsLimit: number
): DashboardRowsProjection<T> {
  const visibleRows: T[] = [];
  const safeLimit = Number.isFinite(rowsLimit)
    ? Math.max(0, Math.floor(rowsLimit))
    : Number.POSITIVE_INFINITY;
  let matchedCount = 0;
  let committed = 0;
  let received = 0;

  for (const record of records) {
    if (!matches(record)) continue;
    matchedCount += 1;
    const amounts = getAmounts(record);
    committed += amounts?.committed ?? 0;
    received += amounts?.received ?? 0;
    if (visibleRows.length < safeLimit) visibleRows.push(record);
  }

  return { visibleRows, matchedCount, committed, received };
}
