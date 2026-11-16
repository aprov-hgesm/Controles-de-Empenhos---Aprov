/** Paginação do PDF do cronograma: preserve legibilidade em A4. */
export function getCronogramaPdfLayout(remessaCount: number) {
  const orientation = remessaCount > 3 ? 'landscape' as const : 'portrait' as const;
  const margin = orientation === 'landscape' ? 10 : 12;
  const pageWidth = orientation === 'landscape' ? 297 : 210;
  return {
    orientation,
    margin,
    pageContentWidth: pageWidth - 2 * margin,
    maxRemessasPerTable: orientation === 'landscape' ? 8 : 3,
    remessaWidth: orientation === 'landscape' ? 17.5 : 17,
  };
}

/** Mantém a sequência e não descarta remessas quando há mais colunas que cabem em A4. */
export function splitCronogramaRemessas<T>(remessas: readonly T[], maxPerTable: number): T[][] {
  if (maxPerTable < 1) throw new RangeError('O tamanho do bloco deve ser positivo.');
  if (!remessas.length) return [[]];
  const groups: T[][] = [];
  for (let i = 0; i < remessas.length; i += maxPerTable) {
    groups.push(remessas.slice(i, i + maxPerTable));
  }
  return groups;
}
