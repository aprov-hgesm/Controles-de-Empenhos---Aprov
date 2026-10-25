/**
 * Public browser-only display hint for InfinitePay redirects.
 * NEVER a settlement decision. Caller must NOT grant access, mark paid,
 * log or expose the callback's transaction identifiers.
 */
export function inspectInfinitePayReturn(pageUrl) {
  let url;
  try { url = new URL(pageUrl); }
  catch { return { isReturn: false, cleanedPath: '/regularizacao', verified: false }; }
  const isRegularization = url.pathname === '/regularizacao';
  const keys = ['order_nsu', 'transaction_nsu', 'slug', 'receipt_url'];
  const isReturn = isRegularization && keys.some((key) => url.searchParams.has(key));
  return {
    isReturn,
    cleanedPath: url.pathname + url.hash,
    verified: false,
  };
}
