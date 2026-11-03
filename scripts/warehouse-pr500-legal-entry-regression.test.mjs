#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');

test('Warehouse status reuses real signed-identity legal acceptance (no client storage bypass)', () => {
  const status = read('app/api/central-depositos/status/route.ts');
  const verifier = read('lib/server/warehouseLegalAcceptance.ts');
  const gate = read('features/warehouse/components/WarehouseProtectedSurface.tsx');
  assert.match(status, /verifyWarehouseRequest\(/);
  assert.match(status, /await readWarehouseLegalAcceptance\(access\)/);
  assert.match(status, /legalAccepted,/);
  assert.match(verifier, /isVerifiedLegalAcceptance\(/);
  assert.match(verifier, /legalAcceptanceDocumentId\(access\.uid\)/);
  assert.match(verifier, /CURRENT_LEGAL_BUNDLE\.legalBundleVersion/);
  assert.match(verifier, /cache: 'no-store'/);
  assert.doesNotMatch(verifier, /setDoc\(|updateDoc\(|deleteDoc\(|runTransaction\(/);
  assert.match(gate, /authorization\.status\.legalAccepted === true/);
  assert.match(gate, /if \(legalAcceptedByWarehouseStatus\) return operationalSurface/);
  assert.match(gate, /<LegalAcceptanceGate/);
  assert.doesNotMatch(gate, /localStorage|sessionStorage/);
});

test('Optional Essential surface has local recovery instead of crashing the Warehouse shell', () => {
  const surface = read('features/warehouse/components/WarehouseEssentialSurfaceBoundary.tsx');
  const sections = read('features/warehouse/components/WarehouseSectionContent.tsx');
  assert.match(surface, /getDerivedStateFromError/);
  assert.match(surface, /WAREHOUSE_ESSENTIAL_RENDER_FAILURE/);
  assert.match(surface, /this\.props\.onRestoreNormal/);
  assert.match(sections, /WarehouseEssentialSurfaceBoundary/);
  assert.match(sections, /setMode\('premium'\)/);
});

test('Cloud Run build has a per-revision Next deploymentId to detect version skew', () => {
  const next = read('next.config.ts');
  const docker = read('Dockerfile');
  const ci = read('.github/workflows/emprovex-cloud-run-stage.yml');
  assert.match(next, /deploymentId: process\.env\.NEXT_DEPLOYMENT_ID/);
  assert.match(next, /source: '\/central-depositos'/);
  assert.match(docker, /ARG NEXT_DEPLOYMENT_ID/);
  assert.match(ci, /--build-arg NEXT_DEPLOYMENT_ID="g\$\{SHORT_SHA\}"/);
});
