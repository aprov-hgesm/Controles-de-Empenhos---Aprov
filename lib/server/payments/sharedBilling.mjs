/**
 * EMPROVEX — one workspace, one account, multiple independent payments.
 * The excess cents are disclosed as a division fee (never InfinitePay fees).
 * No auth or role changes. Server-only arithmetic with integer cents.
 */
export const SHARED_TERMS_VERSION = 'emprovex_shared_payment_v1';
export const SHARED_MAX_PARTICIPANTS = 20;

export function quoteSharedPayment(amountCents, count) {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0
    || !Number.isSafeInteger(count) || count < 2 || count > SHARED_MAX_PARTICIPANTS) {
    throw new Error('SHARED_INVALID_SPLIT');
  }
  const partAmountCents = Math.ceil(amountCents / count);
  // Do not create links below the documented R$1.00 minimum.
  if (partAmountCents < 100) throw new Error('SHARED_AMOUNT_TOO_SMALL');
  const totalCents = partAmountCents * count;
  return { amountCents, count, partAmountCents, totalCents, feeCents: totalCents - amountCents };
}

export function createSharedPayment({ amountCents, participantNames, acceptedAt }) {
  if (!Array.isArray(participantNames)) throw new Error('SHARED_INVALID_PARTICIPANTS');
  const quote = quoteSharedPayment(amountCents, participantNames.length);
  const names = participantNames.map(name => typeof name === 'string' ? name.trim() : '');
  if (names.some(name => name.length < 2 || name.length > 60 || /[<>]/.test(name))
    || new Set(names.map(name => name.toLocaleLowerCase('pt-BR'))).size !== names.length) {
    throw new Error('SHARED_INVALID_PARTICIPANTS');
  }
  if (typeof acceptedAt !== 'string' || !Number.isFinite(Date.parse(acceptedAt))) {
    throw new Error('SHARED_INVALID_DATE');
  }
  return {
    version: 'shared_v1',
    termsVersion: SHARED_TERMS_VERSION,
    acceptedAt,
    ...quote,
    parts: names.map((name, i) => ({
      number: i + 1, name, amountCents: quote.partAmountCents, status: 'open',
    })),
  };
}

export function applySharedPayment(shared, number, ledgerId, paidAt) {
  if (!shared || shared.version !== 'shared_v1' || !Array.isArray(shared.parts)
      || shared.parts.length !== shared.count || !Number.isSafeInteger(number)
      || number < 1 || number > shared.count) throw new Error('SHARED_INVALID_STATE');
  const selected = shared.parts[number - 1];
  if (!selected || selected.number !== number || selected.amountCents !== shared.partAmountCents
      || selected.status === 'paid' || typeof ledgerId !== 'string' || !ledgerId
      || typeof paidAt !== 'string' || !Number.isFinite(Date.parse(paidAt))) {
    throw new Error('SHARED_ALREADY_PAID_OR_INVALID');
  }
  const parts = shared.parts.map(part => part.number === number
    ? { ...part, status: 'paid', ledgerId, paidAt, checkoutState: 'settled' } : part);
  const paidCents = parts.filter(part => part.status === 'paid')
    .reduce((sum, part) => sum + part.amountCents, 0);
  return { ...shared, parts, paidCents, paidCount: parts.filter(part => part.status === 'paid').length,
    fullyPaid: parts.every(part => part.status === 'paid') };
}
