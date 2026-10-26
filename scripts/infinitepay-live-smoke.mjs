#!/usr/bin/env node
/**
 * Explicitly authorized REAL Pix payment smoke. Never run from CI.
 *
 * Usage:
 * node scripts/infinitepay-live-smoke.mjs dry-run --workspace usuario-teste
 * node scripts/infinitepay-live-smoke.mjs create --workspace usuario-teste --amount-cents 100 --authorize-real-pix-test
 * node scripts/infinitepay-live-smoke.mjs verify --order epx-YYYYMM-....
 *
 * Does not read/write Firebase or change a SaaS customer's account.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { callInfinitePay } from '../lib/server/payments/infinitepayCheckout.mjs';
import {
  prepareIsolatedPixTest, readCheckoutUrl,
  makePixCheckFromReturn, assessIsolatedPixResult,
} from '../lib/server/payments/infinitepaySmokeHarness.mjs';

const DIR = path.join(os.tmpdir(), 'emprovex-infinitepay-smoke-v1');
const ORDER_REGEX = /^epx-[0-9]{6}-[a-f0-9]{24}$/;
const params = process.argv.slice(2);
const mode = params.shift();

function option(key) {
  const i = params.indexOf(key);
  return i >= 0 ? params[i + 1] : undefined;
}
function orderPath(order) {
  if (!ORDER_REGEX.test(order || '')) throw new Error('Invalid test order identifier');
  return path.join(DIR, order + '.json');
}
async function saveNew(state) {
  await mkdir(DIR, { recursive: true, mode: 0o700 });
  await writeFile(orderPath(state.orderNsu), JSON.stringify(state, null, 2), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
}
async function readState(order) {
  const state = JSON.parse(await readFile(orderPath(order), 'utf8'));
  if (state.orderNsu !== order || state.mode !== 'isolated_infinitepay_pix_smoke') {
    throw new Error('Test state does not match the order');
  }
  return state;
}
async function updateState(state) {
  await writeFile(orderPath(state.orderNsu), JSON.stringify(state, null, 2), { encoding: 'utf8', mode: 0o600 });
}
function getApiKey() {
  const key = process.env.INFINITEPAY_API_KEY?.trim();
  if (!key || key.length < 16 || /\s/.test(key)) {
    throw new Error('Configure INFINITEPAY_API_KEY only in your local shell before a live call.');
  }
  return key;
}
async function run() {
  if (!['dry-run', 'create', 'verify'].includes(mode)) {
    throw new Error('Use dry-run, create, or verify. No call was made.');
  }
  if (mode === 'dry-run' || mode === 'create') {
    const workspaceId = option('--workspace');
    const value = option('--amount-cents') ?? '100';
    if (!/^[0-9]+$/.test(value)) throw new Error('Amount must be an integer in cents.');
    const amountCents = Number(value);
    const test = prepareIsolatedPixTest({ workspaceId, amountCents });
    if (mode === 'dry-run') {
      stdout.write(JSON.stringify({
        mode: 'DRY_RUN_NO_NETWORK',
        amountBRL: (amountCents / 100).toFixed(2),
        description: test.request.items[0].description,
        singlePayment: test.request.options.single_payment,
        redirect: test.request.redirect_url,
        willModifyBilling: false,
        willCallInfinitePay: false,
      }, null, 2) + '\n');
      return;
    }
    // The sole opt-in for REAL money; no network call on incidental runs.
    if (!params.includes('--authorize-real-pix-test')) {
      throw new Error('Live charge creation requires --authorize-real-pix-test. No call was made.');
    }
    const apiKey = getApiKey();
    if (!process.env.INFINITEPAY_HANDLE?.trim()) {
      throw new Error('Set INFINITEPAY_HANDLE to your InfiniteTag for later authenticated verification.');
    }
    await saveNew(test.state);
    stdout.write('Pedido de teste salvo localmente antes da chamada à InfinitePay.\n');
    const response = await callInfinitePay({
      operation: 'links',
      apiKey,
      payload: test.request,
      allowExternalCall: true,
    });
    const checkoutUrl = readCheckoutUrl(response);
    await updateState({ ...test.state, status: 'checkout_created', checkoutUrl });
    stdout.write('\nCHECKOUT CRIADO NA INFINITEPAY (ainda NÃO foi pago)\n');
    stdout.write('Valor: R$ ' + (amountCents / 100).toFixed(2).replace('.', ',') + '\n');
    stdout.write('Pedido de teste: ' + test.state.orderNsu + '\n');
    stdout.write('Link para abrir no navegador: ' + checkoutUrl + '\n');
    stdout.write('Pague apenas se reconhecer o recebedor e o valor no aplicativo bancário.\n');
    stdout.write('Após pagar, clique em Continuar no checkout e use verify com a URL final.\n');
    return;
  }

  const orderNsu = option('--order');
  const state = await readState(orderNsu);
  if (state.status !== 'checkout_created' && state.status !== 'verified') {
    throw new Error('Checkout creation was not confirmed locally; do not claim a successful payment.');
  }
  const apiKey = getApiKey();
  const handle = process.env.INFINITEPAY_HANDLE;
  const rl = readline.createInterface({ input: stdin, output: stdout });
  let finalUrl;
  try {
    finalUrl = (await rl.question('Cole a URL FINAL do navegador após o pagamento (não cole API Key): ')).trim();
  } finally {
    rl.close();
  }
  const prep = makePixCheckFromReturn({ returnUrl: finalUrl, state, handle });
  const paymentCheck = await callInfinitePay({
    operation: 'payment_check', apiKey,
    payload: prep.checkRequest, allowExternalCall: true,
  });
  const decision = assessIsolatedPixResult({
    amountCents: state.amountCents,
    paymentCheck,
  });
  if (!decision.verified) {
    stdout.write('PAGAMENTO NÃO CONFIRMADO PELO PROVEDOR: ' + decision.reason + '\n');
    stdout.write('Nenhuma assinatura do EMPROVEX foi modificada.\n');
    return;
  }
  await updateState({
    ...state, status: 'verified',
    verifiedAt: new Date().toISOString(),
    transactionFingerprint: prep.transactionFingerprint,
  });
  stdout.write('\nPIX REAL CONFIRMADO COM A INFINITEPAY\n');
  stdout.write('Valor esperado: R$ ' + (state.amountCents / 100).toFixed(2).replace('.', ',') + '\n');
  stdout.write('Pedido: ' + state.orderNsu + '\n');
  stdout.write('Identificador resumido de auditoria: ' + prep.transactionFingerprint.slice(0, 16) + '\n');
  stdout.write('O teste NÃO registrou cobrança nem alterou o acesso no EMPROVEX.\n');
}
run().catch((error) => {
  // Never print HTTP provider error bodies, API secrets or redirected URLs.
  process.stderr.write('TESTE INTERROMPIDO: ' + (error instanceof Error ? error.message : 'Falha desconhecida') + '\n');
  process.exitCode = 1;
});
