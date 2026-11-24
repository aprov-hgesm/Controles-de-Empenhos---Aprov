/**
 * Núcleo financeiro isolado do Controle de Crédito.
 * Valores em centavos inteiros; rateio em pontos-base (100% = 10.000).
 * Não acessa Firestore nem modifica o domínio de Empenhos.
 */
export const CREDIT_SHARE_SCALE = 10_000;
export const HGESM_COST_CENTERS = [
  { id: 'FARM', name: 'Farmácia Hospitalar' },
  { id: 'LAC', name: 'Laboratório de Análises Clínicas' },
  { id: 'ODONTO', name: 'Setor de Odontologia' },
  { id: 'APROV', name: 'Aprovisionamento/Nutrição' },
  { id: 'ALMOX', name: 'Almoxarifado' },
] as const;

export interface CreditAllocation {
  centerId: string;
  basisPoints: number;
}
export interface CreditCommitment {
  id: string; // identidade canônica UG + exercício + NE, previamente validada
  centerId: string;
  netCents: number; // valor líquido após reforços/anulações conciliados
}
export interface CreditCenterBalance {
  centerId: string;
  basisPoints: number;
  allocatedCents: number;
  committedCents: number;
  availableCents: number;
  commitmentCount: number;
}

function nonnegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(label + ' inválido.');
}
function safeSum(a: number, b: number): number {
  const result = a + b;
  nonnegativeInteger(result, 'Total');
  return result;
}
function validateCenter(id: string): void {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error('Centro de custos inválido.');
}

/** Distribui inclusive o saldo não destinado, preservando cada centavo. */
export function calculateCreditBalance(
  creditCents: number,
  allocations: readonly CreditAllocation[],
  commitments: readonly CreditCommitment[],
) {
  nonnegativeInteger(creditCents, 'Valor do crédito');
  const shares = new Map<string, number>();
  let totalBasisPoints = 0;
  for (const allocation of allocations) {
    validateCenter(allocation.centerId);
    if (shares.has(allocation.centerId)) throw new Error('Centro de custos duplicado.');
    nonnegativeInteger(allocation.basisPoints, 'Percentual');
    totalBasisPoints += allocation.basisPoints;
    if (totalBasisPoints > CREDIT_SHARE_SCALE) throw new Error('Rateio superior a 100%.');
    shares.set(allocation.centerId, allocation.basisPoints);
  }
  const spent = new Map<string, { cents: number; count: number }>();
  const seen = new Set<string>();
  let committedCents = 0;
  for (const commitment of commitments) {
    validateCenter(commitment.centerId);
    if (!commitment.id || seen.has(commitment.id)) throw new Error('Empenho inválido ou duplicado.');
    seen.add(commitment.id);
    nonnegativeInteger(commitment.netCents, 'Valor empenhado');
    const previous = spent.get(commitment.centerId) ?? { cents: 0, count: 0 };
    spent.set(commitment.centerId, { cents: safeSum(previous.cents, commitment.netCents), count: previous.count + 1 });
    committedCents = safeSum(committedCents, commitment.netCents);
    // Um centro com histórico nunca desaparece após edição do rateio.
    if (!shares.has(commitment.centerId)) shares.set(commitment.centerId, 0);
  }

  const residualId = ''; // chave interna, impossível para um centro válido
  const weights = [...shares.entries(), [residualId, CREDIT_SHARE_SCALE - totalBasisPoints] as [string, number]];
  const parts = weights.map(([id, weight]) => {
    // Separa quociente e resto para não multiplicar valores monetários grandes.
    const remainderProduct = (creditCents % CREDIT_SHARE_SCALE) * weight;
    return {
      id,
      cents: Math.floor(creditCents / CREDIT_SHARE_SCALE) * weight + Math.floor(remainderProduct / CREDIT_SHARE_SCALE),
      remainder: remainderProduct % CREDIT_SHARE_SCALE,
    };
  });
  const missing = creditCents - parts.reduce((sum, part) => sum + part.cents, 0);
  parts.sort((a, b) => b.remainder - a.remainder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (let i = 0; i < missing; i++) parts[i].cents++;
  const allocated = new Map(parts.map(part => [part.id, part.cents]));
  const centers: CreditCenterBalance[] = [...shares].map(([centerId, basisPoints]) => {
    const allocatedCents = allocated.get(centerId) ?? 0;
    const current = spent.get(centerId) ?? { cents: 0, count: 0 };
    return { centerId, basisPoints, allocatedCents, committedCents: current.cents,
      availableCents: allocatedCents - current.cents, commitmentCount: current.count };
  }).sort((a, b) => a.centerId < b.centerId ? -1 : a.centerId > b.centerId ? 1 : 0);
  return {
    creditCents,
    committedCents,
    availableCents: creditCents - committedCents,
    commitmentCount: seen.size,
    unallocatedBasisPoints: CREDIT_SHARE_SCALE - totalBasisPoints,
    unallocatedCents: allocated.get(residualId) ?? 0,
    centers,
    overdrawn: committedCents > creditCents,
    overdrawnCenterIds: centers.filter(center => center.availableCents < 0).map(center => center.centerId),
  };
}

/** Aponta pendências, sem confundir prazo vencido com recolhimento efetivo. */
export function creditAlerts(availableCents: number, commitmentCount: number, deadline: string | null, today: string) {
  if (!Number.isSafeInteger(availableCents)) throw new Error('Saldo inválido.');
  nonnegativeInteger(commitmentCount, 'Quantidade de empenhos');
  const day = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Data inválida.');
    const ms = Date.parse(value + 'T00:00:00Z');
    if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) throw new Error('Data inválida.');
    return ms / 86_400_000;
  };
  const current = day(today);
  const daysRemaining = deadline === null ? null : day(deadline) - current;
  return {
    noCommitments: availableCents > 0 && commitmentCount === 0,
    deadlineMissing: availableCents > 0 && daysRemaining === null,
    overdue: availableCents > 0 && daysRemaining !== null && daysRemaining < 0,
    dueToday: availableCents > 0 && daysRemaining === 0,
    dueWithinSevenDays: availableCents > 0 && daysRemaining !== null && daysRemaining >= 1 && daysRemaining <= 7,
    daysRemaining,
  };
}
