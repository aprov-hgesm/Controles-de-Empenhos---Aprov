#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const originalFetch = globalThis.fetch;

function normalizeHeaders(headersInit) {
  if (!headersInit) return [];
  if (headersInit instanceof Headers) return [...headersInit.entries()];
  if (Array.isArray(headersInit)) return headersInit;
  return Object.entries(headersInit);
}

async function curlFetch(input, init = {}) {
  const url = typeof input === 'string' || input instanceof URL
    ? String(input)
    : input?.url;

  if (!url) throw new TypeError('URL inválida para transporte curl.');

  const method = String(init.method || 'GET').toUpperCase();
  const marker = '\n__EMPROVEX_HTTP_STATUS__:';
  const args = [
    '--silent',
    '--show-error',
    '--location',
    '--connect-timeout', '20',
    '--max-time', '90',
    '--write-out', `${marker}%{http_code}`,
  ];

  if (method !== 'GET') args.push('--request', method);

  for (const [name, value] of normalizeHeaders(init.headers)) {
    args.push('--header', `${name}: ${value}`);
  }

  if (init.body != null) {
    args.push('--data-binary', typeof init.body === 'string' ? init.body : String(init.body));
  }

  args.push(url);

  const result = spawnSync('curl', args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });

  if (result.error?.code === 'ENOENT') {
    throw new Error('curl não encontrado no ambiente.');
  }
  if (result.status !== 0) {
    throw new Error(`curl falhou (${result.status ?? 'sem status'}): ${result.stderr.trim() || 'sem detalhes'}`);
  }

  const output = result.stdout || '';
  const markerIndex = output.lastIndexOf(marker);
  if (markerIndex < 0) {
    throw new Error('Resposta HTTP sem status retornado pelo curl.');
  }

  const body = output.slice(0, markerIndex);
  const status = Number(output.slice(markerIndex + marker.length).trim());
  if (!Number.isInteger(status) || status < 100 || status > 599) {
    throw new Error(`Status HTTP inválido retornado pelo curl: ${String(status)}.`);
  }

  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

try {
  globalThis.fetch = curlFetch;
  await import('./audit-document-storage-pre-decommission.mjs');
} finally {
  globalThis.fetch = originalFetch;
}
