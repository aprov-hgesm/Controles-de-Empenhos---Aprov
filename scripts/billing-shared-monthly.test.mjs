import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteSharedPayment, createSharedPayment, applySharedPayment } from '../lib/server/payments/sharedBilling.mjs';

test('rateio igual arredondado e taxa visível', () => {
  assert.deepEqual(quoteSharedPayment(2990,3), { amountCents:2990, count:3, partAmountCents:997, totalCents:2991, feeCents:1 });
  assert.deepEqual(quoteSharedPayment(2990,4), { amountCents:2990, count:4, partAmountCents:748, totalCents:2992, feeCents:2 });
  assert.deepEqual(quoteSharedPayment(6990,3), { amountCents:6990, count:3, partAmountCents:2330, totalCents:6990, feeCents:0 });
  assert.deepEqual(quoteSharedPayment(6990,4), { amountCents:6990, count:4, partAmountCents:1748, totalCents:6992, feeCents:2 });
});
test('limites de quantidade e valor', () => {
  for (const count of [0,1,21,2.5,'3']) assert.throws(() => quoteSharedPayment(2990,count));
  assert.throws(() => quoteSharedPayment(100,2), /TOO_SMALL/);
  assert.throws(() => quoteSharedPayment(NaN,3));
});
test('identificação dos participantes sem novas contas', () => {
  const s=createSharedPayment({amountCents:2990,participantNames:['1º Ten Rechia','3º Sgt Sodre','Cb Aires'],acceptedAt:'2026-10-29T00:00:00.000Z'});
  assert.equal(s.termsVersion,'emprovex_shared_payment_v1');
  assert.equal(s.parts.length,3);
  assert.ok(s.parts.every(p=>p.status==='open'));
  assert.equal(s.feeCents,1);
  assert.throws(()=>createSharedPayment({amountCents:2990,participantNames:['AAA','aaa'],acceptedAt:'2026-10-29T00:00:00Z'}));
});
test('somente a última cota confirma mensalidade; rejeita pagamento repetido', () => {
  let s=createSharedPayment({amountCents:2990,participantNames:['Aaa','Bbb','Ccc'],acceptedAt:'2026-10-29T00:00:00Z'});
  s=applySharedPayment(s,2,'l2','2026-10-29T00:00:01Z');
  assert.equal(s.fullyPaid,false);assert.equal(s.paidCents,997);
  assert.throws(()=>applySharedPayment(s,2,'l2b','2026-10-29T00:00:02Z'));
  s=applySharedPayment(s,1,'l1','2026-10-29T00:00:03Z');
  s=applySharedPayment(s,3,'l3','2026-10-29T00:00:04Z');
  assert.equal(s.fullyPaid,true); assert.equal(s.paidCents,2991); assert.equal(s.paidCount,3);
});
