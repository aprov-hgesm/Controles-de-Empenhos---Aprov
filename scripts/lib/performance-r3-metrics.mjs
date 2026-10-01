import { readFileSync } from 'node:fs';

const ANSI_RE = /\u001B\[[0-?]*[ -\/]*[@-~]/g;

export function stripAnsi(value) {
  return String(value ?? '').replace(ANSI_RE, '');
}

export function sizeToKb(value) {
  const match = String(value ?? '').trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*(B|kB|MB)$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(amount)) return null;
  if (unit === 'b') return amount / 1024;
  if (unit === 'mb') return amount * 1024;
  return amount;
}

export function parseNextBuildOutput(raw) {
  const lines = stripAnsi(raw).split(/\r?\n/);
  const routes = {};
  const chunks = [];
  let sharedFirstLoadJsKb = null;
  let inSharedChunkBlock = false;

  for (const original of lines) {
    const line = original.trimEnd();
    const sharedMatch = line.match(/First Load JS shared by all\s+([0-9.]+\s*(?:B|kB|MB))/i);
    if (sharedMatch) {
      sharedFirstLoadJsKb = sizeToKb(sharedMatch[1]);
      inSharedChunkBlock = true;
      continue;
    }

    const routeMatch = line.match(/^[┌├└│\s]*[○ƒ●]?\s*(\/\S*)\s+([0-9.]+\s*(?:B|kB|MB))\s+([0-9.]+\s*(?:B|kB|MB))\s*$/i);
    if (routeMatch) {
      routes[routeMatch[1]] = {
        sizeKb: roundKb(sizeToKb(routeMatch[2])),
        firstLoadJsKb: roundKb(sizeToKb(routeMatch[3])),
      };
      inSharedChunkBlock = false;
      continue;
    }

    if (inSharedChunkBlock) {
      const chunkMatch = line.match(/^[├└│\s+]*([^\s].*?)\s+([0-9.]+\s*(?:B|kB|MB))\s*$/i);
      if (chunkMatch && /(?:chunks\/|\.js)/i.test(chunkMatch[1])) {
        chunks.push({
          name: chunkMatch[1].trim(),
          sizeKb: roundKb(sizeToKb(chunkMatch[2])),
        });
        continue;
      }
      if (line.trim() === '' || /(?:Middleware|○\s+Static|ƒ\s+Dynamic)/.test(line)) {
        inSharedChunkBlock = false;
      }
    }
  }

  return {
    sharedFirstLoadJsKb: roundKb(sharedFirstLoadJsKb),
    routes,
    chunks,
  };
}

export function roundKb(value) {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

export function percentDelta(baseline, current) {
  if (!Number.isFinite(baseline) || baseline === 0 || !Number.isFinite(current)) return null;
  return Math.round((((current - baseline) / baseline) * 100) * 100) / 100;
}

export function compareBundle(baseline, current) {
  const routeRows = [];
  for (const [route, baselineRoute] of Object.entries(baseline.bundle.routes ?? {})) {
    const currentRoute = current.routes?.[route];
    routeRows.push({
      route,
      baselineFirstLoadJsKb: baselineRoute.firstLoadJsKb,
      currentFirstLoadJsKb: currentRoute?.firstLoadJsKb ?? null,
      deltaKb: currentRoute?.firstLoadJsKb == null
        ? null
        : roundKb(currentRoute.firstLoadJsKb - baselineRoute.firstLoadJsKb),
      deltaPercent: currentRoute?.firstLoadJsKb == null
        ? null
        : percentDelta(baselineRoute.firstLoadJsKb, currentRoute.firstLoadJsKb),
    });
  }

  const baselineShared = baseline.bundle.sharedFirstLoadJsKb;
  const currentShared = current.sharedFirstLoadJsKb;
  return {
    shared: {
      baselineKb: baselineShared,
      currentKb: currentShared ?? null,
      deltaKb: currentShared == null ? null : roundKb(currentShared - baselineShared),
      deltaPercent: currentShared == null ? null : percentDelta(baselineShared, currentShared),
    },
    routes: routeRows,
  };
}

export function evaluateBundleBudgets(comparison, budgets) {
  const findings = [];
  const routePolicy = budgets.bundle.routeRegression;
  const sharedPolicy = budgets.bundle.sharedRegression;

  for (const row of comparison.routes) {
    if (row.currentFirstLoadJsKb == null) {
      findings.push({level:'warning', metric:`route:${row.route}`, message:'Route was not found in the parsed build report.'});
      continue;
    }
    const level = classifyIncrease(row.deltaKb, row.deltaPercent, routePolicy);
    if (level) findings.push({
      level,
      metric:`route:${row.route}`,
      message:`First Load JS changed by ${row.deltaKb} kB (${row.deltaPercent}%).`,
    });
  }

  if (comparison.shared.currentKb == null) {
    findings.push({level:'warning', metric:'shared-js', message:'Shared First Load JS was not found in the parsed build report.'});
  } else {
    const level = classifyIncrease(comparison.shared.deltaKb, comparison.shared.deltaPercent, sharedPolicy);
    if (level) findings.push({
      level,
      metric:'shared-js',
      message:`Shared First Load JS changed by ${comparison.shared.deltaKb} kB (${comparison.shared.deltaPercent}%).`,
    });
  }

  return findings;
}

function classifyIncrease(deltaKb, deltaPercent, policy) {
  if (!Number.isFinite(deltaKb) || !Number.isFinite(deltaPercent) || deltaKb <= 0) return null;
  if (deltaPercent >= policy.block.percent && deltaKb >= policy.block.absoluteKb) return 'blocking';
  if (deltaPercent >= policy.warning.percent && deltaKb >= policy.warning.absoluteKb) return 'warning';
  return null;
}

export function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function sanitizeRuntimeObservations(input, scenarioManifest) {
  if (!Array.isArray(input)) throw new Error('Runtime observations must be a JSON array.');
  const allowedScenarioIds = new Set((scenarioManifest.scenarios ?? []).map((item) => item.id));
  return input.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Observation ${index} must be an object.`);
    }
    if (!allowedScenarioIds.has(item.scenarioId)) {
      throw new Error(`Observation ${index} has unknown scenarioId: ${String(item.scenarioId)}`);
    }
    const sanitized = {scenarioId:item.scenarioId};
    for (const field of ['sampleCount','operationalReadyMs','lcpMs','inpMs','cls','documentsEstimated']) {
      if (item[field] == null) continue;
      if (typeof item[field] !== 'number' || !Number.isFinite(item[field]) || item[field] < 0) {
        throw new Error(`Observation ${index} field ${field} must be a non-negative finite number.`);
      }
      sanitized[field] = item[field];
    }
    return sanitized;
  });
}

export function evaluateRuntimeBudgets(observations, budgets) {
  const findings=[];
  const vitals=budgets.runtime.webVitals.warningAbove;
  for (const item of observations) {
    if (item.lcpMs != null && item.lcpMs > vitals.lcpMs) findings.push({level:'warning',metric:`${item.scenarioId}:lcp`,message:`LCP ${item.lcpMs} ms is above ${vitals.lcpMs} ms.`});
    if (item.inpMs != null && item.inpMs > vitals.inpMs) findings.push({level:'warning',metric:`${item.scenarioId}:inp`,message:`INP ${item.inpMs} ms is above ${vitals.inpMs} ms.`});
    if (item.cls != null && item.cls > vitals.cls) findings.push({level:'warning',metric:`${item.scenarioId}:cls`,message:`CLS ${item.cls} is above ${vitals.cls}.`});
  }
  return findings;
}
