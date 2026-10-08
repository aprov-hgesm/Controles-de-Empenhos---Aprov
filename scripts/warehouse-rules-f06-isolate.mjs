#!/usr/bin/env node
// Only use in a throwaway GitHub Actions checkout before emulators:exec.
// This file deliberately creates INSECURE DIAGNOSTIC variants and must
// NEVER be deployed or merged into production rules.
import { readFileSync, writeFileSync } from 'node:fs';
const variant = process.env.F06_ISOLATION_VARIANT;
if (process.env.GITHUB_ACTIONS !== 'true'
    || process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID !== 'demo-emprovex-f06'
    || !['movement','physical','lots'].includes(variant)) {
  throw new Error('F06_ISOLATION_EMULATOR_ONLY');
}
const path = 'firestore.warehouse.rules';
let s = readFileSync(path, 'utf8');
const edits = {
  movement: [
    'allow create: if canAccessWarehouseModule(workspaceId)\n          && warehouseMovementCreateAllowed(workspaceId, movementId);',
    'allow create: if canAccessWarehouseModule(workspaceId);'
  ],
  physical: [
    'allow create, update: if canAccessWarehouseModule(workspaceId)\n          && warehouseLocationBalanceWriteAllowed(workspaceId, locationBalanceId);',
    'allow create, update: if canAccessWarehouseModule(workspaceId);'
  ],
  lots: [
    'allow create: if canAccessWarehouseModule(workspaceId)\n          && validWarehouseLotCreate(workspaceId, lotId);\n        allow update: if canAccessWarehouseModule(workspaceId)\n          && validWarehouseLotUpdate(workspaceId, lotId);',
    'allow create: if canAccessWarehouseModule(workspaceId);\n        allow update: if canAccessWarehouseModule(workspaceId);'
  ]
};
const [from, to] = edits[variant];
if (s.split(from).length !== 2) throw new Error('F06_ISOLATION_RULES_ANCHOR_MISMATCH');
s=s.replace(from,to);
writeFileSync(path,s);
console.log('INSECURE_EMULATOR_ONLY F06_ISOLATION=' + variant);
console.log('TESTS_ARE_DIAGNOSTIC_NOT_CERTIFICATION');
