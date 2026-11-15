// Original EMPROVEX implementation. Decimal strings only; no floating point money.
export function units(value, precision = 4) {
  if (!Number.isInteger(precision) || precision < 0 || precision > 6) throw Error('PRECISION');
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,11})(\.\d{1,6})?$/.test(value)) throw Error('DECIMAL');
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > precision) throw Error('PRECISION');
  return BigInt(whole) * 10n ** BigInt(precision) + BigInt(fraction.padEnd(precision, '0') || '0');
}
export function decimal(value, precision = 4) {
  if (typeof value !== 'bigint' || value < 0n) throw Error('DECIMAL');
  const scale = 10n ** BigInt(precision);
  if (!precision) return String(value);
  return `${value / scale}.${String(value % scale).padStart(precision, '0')}`;
}
const sameScope = (a, b) => ['companyId','auctionId','itemId','portal'].every(k => typeof a[k] === 'string' && a[k] && a[k] === b[k]);
export function validatePolicy(p) {
  if (!sameScope(p, p) || p.portal !== 'local-simulator' || !['reverse','forward'].includes(p.direction)) throw Error('SCOPE');
  if (!Number.isInteger(p.precision) || p.precision < 0 || p.precision > 6) throw Error('PRECISION');
  if (units(p.limit, p.precision) <= 0n || units(p.step, p.precision) <= 0n) throw Error('LIMIT');
  for (const key of ['maxAgeMs','minIntervalMs','maxBids']) if (!Number.isSafeInteger(p[key]) || p[key] <= 0) throw Error('POLICY');
  return Object.freeze({...p});
}
export function decide(policy, observation, state, now) {
  const p = validatePolicy(policy), o = observation;
  const stop = reason => ({action:'wait', reason});
  if (!Number.isSafeInteger(now) || !o || !Number.isSafeInteger(o.observedAt) || !Number.isSafeInteger(o.closesAt)) return stop('INVALID_TIME');
  if (!sameScope(p, o) || o.direction !== p.direction || o.precision !== p.precision) return stop('SCOPE_CHANGED');
  if (o.phase !== 'open') return stop('NOT_OPEN');
  if (o.connected !== true) return stop('DISCONNECTED');
  if (o.observedAt > now || now - o.observedAt > p.maxAgeMs) return stop('STALE');
  if (now >= o.closesAt) return stop('CLOSED');
  if (!Number.isSafeInteger(o.revision) || o.revision < 1) return stop('REVISION');
  if (!Number.isInteger(state.count) || state.count < 0 || state.count >= p.maxBids) return stop('MAX_BIDS');
  if (state.lastSentAt !== null && (!Number.isSafeInteger(state.lastSentAt) || now - state.lastSentAt < p.minIntervalMs)) return stop('INTERVAL');
  if (o.leaderIsSelf === true) return stop('LEADING');
  if (o.leaderIsSelf !== false) return stop('UNKNOWN_POSITION');
  let best, limit, step, portalStep;
  try { best = units(o.best, p.precision); limit = units(p.limit, p.precision); step = units(p.step, p.precision); portalStep = units(o.minStep, p.precision); } catch { return stop('INVALID_PRICE'); }
  if (best <= 0n || portalStep <= 0n) return stop('INVALID_PRICE');
  const delta = step > portalStep ? step : portalStep;
  const bid = p.direction === 'reverse' ? best - delta : best + delta;
  if (bid <= 0n || (p.direction === 'reverse' ? bid < limit : bid > limit)) return stop('LIMIT_REACHED');
  return {action:'bid', amount:decimal(bid,p.precision), revision:o.revision};
}
// One runner per local page. Restart is deliberately disarmed; never resume a pending bid.
export class Runner {
  constructor(adapter, {clock = Date.now, onEvent = () => {}, timeoutMs = 2000} = {}) {
    if (adapter.kind !== 'simulator') throw Error('LIVE_DISABLED');
    this.timeoutMs = timeoutMs; this.uncertain = false;
    this.adapter = adapter; this.clock = clock; this.onEvent = onEvent;
    this.status = 'disarmed'; this.busy = false; this.count = 0; this.lastSentAt = null; this.sequence = 0;
  }
  event(type, detail = {}) { try { this.onEvent({type, at:this.clock(), ...detail}); } catch {} }
  arm(policy) {
    if (this.busy || this.uncertain) throw Error('RECONCILIATION_REQUIRED');
    this.policy = validatePolicy(policy); this.status = 'armed'; this.event('armed');
  }
  stop() { this.status = this.uncertain ? 'uncertain' : 'stopped'; this.event('stopped'); }
  async bounded(action) {
    let timer;
    try { return await Promise.race([Promise.resolve().then(action), new Promise((_, reject) => {timer = setTimeout(() => reject(Error('TIMEOUT')), this.timeoutMs);})]); }
    finally {clearTimeout(timer);}
  }
  async tick() {
    if (this.status !== 'armed' || this.busy) return {action:'wait',reason:this.status};
    this.busy = true;
    try {
      const o = await this.bounded(() => this.adapter.observe());
      if (this.status !== 'armed') return {action:'wait',reason:'stopped'};
      const d = decide(this.policy, o, this, this.clock());
      this.event('decision', d);
      if (d.action !== 'bid') {
        if (!['LEADING','INTERVAL'].includes(d.reason)) this.stop();
        return d;
      }
      const intent = {...d, companyId:this.policy.companyId, auctionId:this.policy.auctionId, itemId:this.policy.itemId,
        portal:this.policy.portal, direction:this.policy.direction, id:`local-${++this.sequence}`};
      // Mark before submission. Exceptions/ambiguous receipts never trigger an automatic retry.
      this.lastSentAt = this.clock(); this.count++;
      let receipt;
      try { receipt = await this.bounded(() => this.adapter.submit(intent)); }
      catch { this.uncertain = true; this.status = 'uncertain'; this.event('uncertain'); return {action:'wait',reason:'UNCERTAIN'}; }
      if (!receipt || receipt.id !== intent.id || !['accepted','rejected'].includes(receipt.status)
          || (receipt.status === 'accepted' && receipt.amount !== intent.amount)) {
        this.uncertain = true; this.status = 'uncertain'; this.event('uncertain'); return {action:'wait',reason:'UNCERTAIN'};
      }
      this.event(receipt.status, {amount:intent.amount, id:intent.id});
      return {...d, receipt};
    } catch (e) { this.stop(); this.event('error', {reason:e.message}); return {action:'wait',reason:'ERROR'}; }
    finally { this.busy = false; }
  }
}
