#!/usr/bin/env node

import assert from 'node:assert/strict';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-emprovex-security';
const API_KEY = 'fake-api-key';
const AUTH_BASE = 'http://127.0.0.1:9099';
const WORKSPACE_ID = 'hgesm-aprov';
const UG = '160416';
const WAREHOUSE_DATABASE_ID = 'emprovex-warehouse';

const apps = [];
const results = [];

function mockGoogleCredential(label, email) {
  return GoogleAuthProvider.credential(
    JSON.stringify({
      sub: 'google-' + label,
      email,
      email_verified: true,
    })
  );
}

async function createSession(label, email) {
  const app = initializeApp(
    {
      projectId: PROJECT_ID,
      apiKey: API_KEY,
      authDomain: PROJECT_ID + '.firebaseapp.com',
    },
    'adm-r1-' + label + '-' + Date.now() + '-' + Math.random().toString(36).slice(2)
  );
  apps.push(app);

  const auth = getAuth(app);
  connectAuthEmulator(auth, AUTH_BASE, { disableWarnings: true });
  const credential = await signInWithCredential(
    auth,
    mockGoogleCredential(label, email)
  );
  const token = await credential.user.getIdTokenResult(true);
  assert.equal(credential.user.emailVerified, true);
  assert.equal(token.signInProvider, 'google.com');

  const db = getFirestore(app, WAREHOUSE_DATABASE_ID);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  return { db, user: credential.user };
}

async function allowed(label, operation) {
  try {
    await operation();
    results.push({ label, outcome: 'ALLOW' });
    console.log('  [PASS] ALLOW — ' + label);
  } catch (error) {
    throw new Error('Esperava ALLOW: ' + label + '\n' + String(error));
  }
}

async function denied(label, operation) {
  try {
    await operation();
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error
      ? String(error.code)
      : '';
    const message = String(error);
    if (
      code.includes('permission-denied')
      || message.includes('PERMISSION_DENIED')
      || message.includes('Missing or insufficient permissions')
    ) {
      results.push({ label, outcome: 'DENY' });
      console.log('  [PASS] DENY  — ' + label);
      return;
    }
    throw new Error('Falha inesperada em DENY: ' + label + '\n' + message);
  }

  throw new Error('Esperava DENY, mas foi permitido: ' + label);
}

async function main() {
  console.log('ADM Depósito — ADM-R1 — segurança direcionada\n');

  const founder = await createSession('founder', 'aprov1hgesm@gmail.com');
  const outsider = await createSession('outsider', 'sector-r1@example.test');

  const materialId = 'mat_' + '1'.repeat(32);
  const depotId = 'dep_' + '2'.repeat(32);
  const locationId = 'loc_' + '3'.repeat(32);
  const layoutId = 'lay_' + '4'.repeat(32);
  const destinationId = 'dest_' + '5'.repeat(32);
  const withdrawalId = 'wd_' + '9'.repeat(32);
  const queueExclusionId = 'qex_' + '8'.repeat(64);

  await allowed('fundador cria material canônico', () =>
    setDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'materials', materialId), {
      schemaVersion: 'warehouse_material_v1',
      id: materialId,
      workspaceId: WORKSPACE_ID,
      ug: UG,
      description: 'Material ADM-R1',
      aliases: [],
      unit: { code: 'unit', label: null },
      status: 'active',
      conversions: [],
    })
  );

  const unassignedBalanceId = 'locbal_' + 'a'.repeat(64);
  const initialMovementId = 'mov_' + 'b'.repeat(64);
  const invoiceEntryMovementId = 'mov_' + 'c'.repeat(64);

  await allowed('fundador cria ledger inicial válido com saldo sem localização', () =>
    runTransaction(founder.db, async (transaction) => {
      const movementRef = doc(
        founder.db, 'warehouse', WORKSPACE_ID, 'movements', initialMovementId
      );
      const balanceRef = doc(
        founder.db, 'warehouse', WORKSPACE_ID, 'balances', materialId
      );
      const locationBalanceRef = doc(
        founder.db, 'warehouse', WORKSPACE_ID, 'locationBalances', unassignedBalanceId
      );

      transaction.set(movementRef, {
        schemaVersion: 'warehouse_movement_v1',
        id: initialMovementId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId,
        type: 'INITIAL_BALANCE',
        quantityDelta: 5,
        idempotencyKeyHash: 'b'.repeat(64),
        reversesMovementId: null,
        note: 'Saldo inicial de teste',
        source: null,
        createdAt: serverTimestamp(),
      });
      transaction.set(balanceRef, {
        schemaVersion: 'warehouse_balance_v1',
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId,
        quantity: 5,
        revision: 1,
        lastMovementId: initialMovementId,
        updatedAt: serverTimestamp(),
      });
      transaction.set(locationBalanceRef, {
        schemaVersion: 'warehouse_location_balance_v1',
        id: unassignedBalanceId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId,
        position: { kind: 'UNASSIGNED' },
        quantity: 5,
        revision: 1,
        lastMovementId: initialMovementId,
        updatedAt: serverTimestamp(),
      });
    })
  );

  await allowed('fundador registra INVOICE_ENTRY válido sobre saldo existente', () =>
    runTransaction(founder.db, async (transaction) => {
      const movementRef = doc(
        founder.db, 'warehouse', WORKSPACE_ID, 'movements', invoiceEntryMovementId
      );
      const balanceRef = doc(
        founder.db, 'warehouse', WORKSPACE_ID, 'balances', materialId
      );
      const locationBalanceRef = doc(
        founder.db, 'warehouse', WORKSPACE_ID, 'locationBalances', unassignedBalanceId
      );

      transaction.set(movementRef, {
        schemaVersion: 'warehouse_movement_v1',
        id: invoiceEntryMovementId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId,
        type: 'INVOICE_ENTRY',
        quantityDelta: 3,
        idempotencyKeyHash: 'c'.repeat(64),
        reversesMovementId: null,
        note: 'Entrada quantitativa da NF para tratamento pelo intake v2',
        source: {
          kind: 'INVOICE',
          action: 'ENTRY',
          invoiceRecordKey: 'nf-r1-entry',
          invoiceId: 'NF-R1-ENTRY',
          empenhoId: '2026NE000002',
          itemIds: ['ITEM-R1-ENTRY'],
          supplier: 'Fornecedor ADM-R1',
          supplierCnpj: null,
          actorUid: founder.user.uid,
        },
        createdAt: serverTimestamp(),
      });
      transaction.set(balanceRef, {
        schemaVersion: 'warehouse_balance_v1',
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId,
        quantity: 8,
        revision: 2,
        lastMovementId: invoiceEntryMovementId,
        updatedAt: serverTimestamp(),
      });
      transaction.set(locationBalanceRef, {
        schemaVersion: 'warehouse_location_balance_v1',
        id: unassignedBalanceId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId,
        position: { kind: 'UNASSIGNED' },
        quantity: 8,
        revision: 2,
        lastMovementId: invoiceEntryMovementId,
        updatedAt: serverTimestamp(),
      });
    })
  );

  await allowed('fundador cria depósito', () =>
    setDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'depots', depotId), {
      schemaVersion: 'warehouse_depot_v1',
      id: depotId,
      workspaceId: WORKSPACE_ID,
      ug: UG,
      code: 'DEP-R1',
      name: 'Depósito ADM-R1',
      description: null,
      visualType: 'CONTAINER',
      sizeProfile: 'MEDIUM',
      status: 'active',
      createdBy: founder.user.uid,
      updatedBy: founder.user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  await allowed('fundador edita código, tipo visual e porte do depósito', () =>
    updateDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'depots', depotId), {
      code: 'DEP-R1-EDIT',
      visualType: 'COLD_CONTAINER',
      sizeProfile: 'LARGE',
      updatedBy: founder.user.uid,
      updatedAt: serverTimestamp(),
    })
  );

  await allowed('fundador cria localização vinculada ao depósito', () =>
    setDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'locations', locationId), {
      schemaVersion: 'warehouse_location_v1',
      id: locationId,
      workspaceId: WORKSPACE_ID,
      ug: UG,
      depotId,
      kind: 'LOCAL',
      parentLocationId: null,
      code: 'LOC-R1',
      name: 'Localização ADM-R1',
      description: null,
      status: 'active',
      createdBy: founder.user.uid,
      updatedBy: founder.user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  await allowed('fundador edita código e nome da localização', () =>
    updateDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'locations', locationId), {
      code: 'LOC-R1-EDIT',
      name: 'Localização ADM-R1 editada',
      updatedBy: founder.user.uid,
      updatedAt: serverTimestamp(),
    })
  );

  const subpositionAId = 'sub_' + '4'.repeat(32);
  const subpositionBId = 'sub_' + '5'.repeat(32);

  await allowed('fundador cria primeira subposição ativa', () =>
    setDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'locations', subpositionAId), {
      schemaVersion: 'warehouse_location_v1',
      id: subpositionAId,
      workspaceId: WORKSPACE_ID,
      ug: UG,
      depotId,
      kind: 'SUBPOSITION',
      parentLocationId: locationId,
      code: 'SUB-R1-A',
      name: 'Subposição ADM-R1 A',
      description: null,
      status: 'active',
      createdBy: founder.user.uid,
      updatedBy: founder.user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  await allowed('fundador cria segunda subposição ativa', () =>
    setDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'locations', subpositionBId), {
      schemaVersion: 'warehouse_location_v1',
      id: subpositionBId,
      workspaceId: WORKSPACE_ID,
      ug: UG,
      depotId,
      kind: 'SUBPOSITION',
      parentLocationId: locationId,
      code: 'SUB-R1-B',
      name: 'Subposição ADM-R1 B',
      description: null,
      status: 'active',
      createdBy: founder.user.uid,
      updatedBy: founder.user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  const transferMovementId = 'mov_' + 'd'.repeat(64);
  const targetBalanceId = 'locbal_' + 'e'.repeat(64);
  const intakeAllocationLotId = 'lot_' + 'f'.repeat(32);
  const intakeAllocationId = 'intake_' + '9'.repeat(64);

  await allowed('fundador faz primeira alocação parcial em subposição A', () =>
    runTransaction(founder.db, async (transaction) => {
      const movementRef = doc(
        founder.db, 'warehouse', WORKSPACE_ID, 'movements', transferMovementId
      );
      const fromBalanceRef = doc(
        founder.db, 'warehouse', WORKSPACE_ID, 'locationBalances', unassignedBalanceId
      );
      const toBalanceRef = doc(
        founder.db, 'warehouse', WORKSPACE_ID, 'locationBalances', targetBalanceId
      );
      const lotRef = doc(
        founder.db, 'warehouse', WORKSPACE_ID, 'lots', intakeAllocationLotId
      );
      const intakeRef = doc(
        founder.db, 'warehouse', WORKSPACE_ID, 'intakes', intakeAllocationId
      );

      transaction.set(movementRef, {
        schemaVersion: 'warehouse_movement_v1',
        id: transferMovementId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId,
        type: 'TRANSFER',
        quantityDelta: 0,
        idempotencyKeyHash: 'd'.repeat(64),
        reversesMovementId: null,
        note: 'Primeira alocação intake v2 de teste',
        source: {
          kind: 'LOCATION_TRANSFER',
          actorUid: founder.user.uid,
          quantity: 2,
          from: { kind: 'UNASSIGNED' },
          to: {
            kind: 'SUBPOSITION',
            depotId,
            locationId,
            subpositionId: subpositionAId,
          },
          fromBalanceId: unassignedBalanceId,
          toBalanceId: targetBalanceId,
        },
        createdAt: serverTimestamp(),
      });

      transaction.set(fromBalanceRef, {
        schemaVersion: 'warehouse_location_balance_v1',
        id: unassignedBalanceId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId,
        position: { kind: 'UNASSIGNED' },
        quantity: 6,
        revision: 3,
        lastMovementId: transferMovementId,
        updatedAt: serverTimestamp(),
      });

      transaction.set(toBalanceRef, {
        schemaVersion: 'warehouse_location_balance_v1',
        id: targetBalanceId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId,
        position: {
          kind: 'SUBPOSITION',
          depotId,
          locationId,
          subpositionId: subpositionAId,
        },
        quantity: 2,
        revision: 1,
        lastMovementId: transferMovementId,
        updatedAt: serverTimestamp(),
      });

      transaction.set(lotRef, {
        schemaVersion: 'warehouse_lot_v1',
        id: intakeAllocationLotId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId,
        code: 'PEND-R1',
        expiresOn: null,
        quantity: 2,
        position: {
          kind: 'SUBPOSITION',
          depotId,
          locationId,
          subpositionId: subpositionAId,
        },
        origin: {
          kind: 'INVOICE',
          movementId: invoiceEntryMovementId,
          invoiceRecordKey: 'nf-r1-entry',
          invoiceId: 'NF-R1-ENTRY',
          supplier: 'Fornecedor ADM-R1',
          supplierCnpj: null,
        },
        status: 'active',
        createdBy: founder.user.uid,
        updatedBy: founder.user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      transaction.set(intakeRef, {
        schemaVersion: 'warehouse_item_intake_v2',
        id: intakeAllocationId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        invoiceRecordKey: 'nf-r1-entry',
        invoiceId: 'NF-R1-ENTRY',
        empenhoId: '2026NE000002',
        itemId: 'ITEM-R1-ENTRY',
        materialId,
        description: 'Material ADM-R1',
        unitLabel: 'UN',
        supplier: 'Fornecedor ADM-R1',
        receivedQuantity: 3,
        allocatedQuantity: 2,
        immediateConsumptionQuantity: 0,
        pendingQuantity: 1,
        status: 'PARTIALLY_PROCESSED',
        createdBy: founder.user.uid,
        updatedBy: founder.user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    })
  );

  const secondTransferMovementId = 'mov_' + '6'.repeat(64);
  const secondTargetBalanceId = 'locbal_' + '7'.repeat(64);
  const secondAllocationLotId = 'lot_' + '8'.repeat(32);

  await allowed('fundador conclui segunda alocação do mesmo intake em subposição B', () =>
    runTransaction(founder.db, async (transaction) => {
      const movementRef = doc(
        founder.db, 'warehouse', WORKSPACE_ID, 'movements', secondTransferMovementId
      );
      const fromBalanceRef = doc(
        founder.db, 'warehouse', WORKSPACE_ID, 'locationBalances', unassignedBalanceId
      );
      const toBalanceRef = doc(
        founder.db, 'warehouse', WORKSPACE_ID, 'locationBalances', secondTargetBalanceId
      );
      const lotRef = doc(
        founder.db, 'warehouse', WORKSPACE_ID, 'lots', secondAllocationLotId
      );
      const intakeRef = doc(
        founder.db, 'warehouse', WORKSPACE_ID, 'intakes', intakeAllocationId
      );

      transaction.set(movementRef, {
        schemaVersion: 'warehouse_movement_v1',
        id: secondTransferMovementId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId,
        type: 'TRANSFER',
        quantityDelta: 0,
        idempotencyKeyHash: '6'.repeat(64),
        reversesMovementId: null,
        note: 'Segunda alocação intake v2 de teste',
        source: {
          kind: 'LOCATION_TRANSFER',
          actorUid: founder.user.uid,
          quantity: 1,
          from: { kind: 'UNASSIGNED' },
          to: {
            kind: 'SUBPOSITION',
            depotId,
            locationId,
            subpositionId: subpositionBId,
          },
          fromBalanceId: unassignedBalanceId,
          toBalanceId: secondTargetBalanceId,
        },
        createdAt: serverTimestamp(),
      });

      transaction.set(fromBalanceRef, {
        schemaVersion: 'warehouse_location_balance_v1',
        id: unassignedBalanceId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId,
        position: { kind: 'UNASSIGNED' },
        quantity: 5,
        revision: 4,
        lastMovementId: secondTransferMovementId,
        updatedAt: serverTimestamp(),
      });

      transaction.set(toBalanceRef, {
        schemaVersion: 'warehouse_location_balance_v1',
        id: secondTargetBalanceId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId,
        position: {
          kind: 'SUBPOSITION',
          depotId,
          locationId,
          subpositionId: subpositionBId,
        },
        quantity: 1,
        revision: 1,
        lastMovementId: secondTransferMovementId,
        updatedAt: serverTimestamp(),
      });

      transaction.set(lotRef, {
        schemaVersion: 'warehouse_lot_v1',
        id: secondAllocationLotId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId,
        code: 'PEND-R1',
        expiresOn: null,
        quantity: 1,
        position: {
          kind: 'SUBPOSITION',
          depotId,
          locationId,
          subpositionId: subpositionBId,
        },
        origin: {
          kind: 'INVOICE',
          movementId: invoiceEntryMovementId,
          invoiceRecordKey: 'nf-r1-entry',
          invoiceId: 'NF-R1-ENTRY',
          supplier: 'Fornecedor ADM-R1',
          supplierCnpj: null,
        },
        status: 'active',
        createdBy: founder.user.uid,
        updatedBy: founder.user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      transaction.update(intakeRef, {
        allocatedQuantity: 3,
        immediateConsumptionQuantity: 0,
        pendingQuantity: 0,
        status: 'PROCESSED',
        updatedBy: founder.user.uid,
        updatedAt: serverTimestamp(),
      });
    })
  );

  const outboundMovementId = 'mov_' + '4'.repeat(64);

  await allowed('Saída de Material zera posição física e lote na retirada total', async () => {
    const batch = writeBatch(founder.db);

    batch.set(
      doc(founder.db, 'warehouse', WORKSPACE_ID, 'movements', outboundMovementId),
      {
        schemaVersion: 'warehouse_movement_v1',
        id: outboundMovementId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId,
        type: 'OUTBOUND',
        quantityDelta: -1,
        idempotencyKeyHash: '4'.repeat(64),
        reversesMovementId: null,
        note: 'Saída total da subposição B para validar reflexo no croqui',
        source: {
          kind: 'EXPRESS_OUTBOUND',
          interface: 'MANUAL_SEARCH',
          actorUid: founder.user.uid,
          requestedQuantity: 1,
          quantity: 1,
          presentation: { code: 'unit', label: null },
          factorToBaseUnit: 1,
          barcodeId: null,
          barcode: null,
          position: {
            kind: 'SUBPOSITION',
            depotId,
            locationId,
            subpositionId: subpositionBId,
          },
          locationBalanceId: secondTargetBalanceId,
          lotId: secondAllocationLotId,
          lotCode: 'PEND-R1',
        },
        createdAt: serverTimestamp(),
      }
    );

    batch.set(
      doc(founder.db, 'warehouse', WORKSPACE_ID, 'balances', materialId),
      {
        schemaVersion: 'warehouse_balance_v1',
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId,
        quantity: 7,
        revision: 3,
        lastMovementId: outboundMovementId,
        updatedAt: serverTimestamp(),
      }
    );

    batch.set(
      doc(founder.db, 'warehouse', WORKSPACE_ID, 'locationBalances', secondTargetBalanceId),
      {
        schemaVersion: 'warehouse_location_balance_v1',
        id: secondTargetBalanceId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId,
        position: {
          kind: 'SUBPOSITION',
          depotId,
          locationId,
          subpositionId: subpositionBId,
        },
        quantity: 0,
        revision: 2,
        lastMovementId: outboundMovementId,
        updatedAt: serverTimestamp(),
      }
    );

    batch.update(
      doc(founder.db, 'warehouse', WORKSPACE_ID, 'lots', secondAllocationLotId),
      {
        quantity: 0,
        updatedBy: founder.user.uid,
        updatedAt: serverTimestamp(),
      }
    );

    await batch.commit();
  });

  await allowed('fundador confirma saldo zero da posição retirada', async () => {
    const [aggregateSnapshot, locationSnapshot, lotSnapshot] = await Promise.all([
      getDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'balances', materialId)),
      getDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'locationBalances', secondTargetBalanceId)),
      getDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'lots', secondAllocationLotId)),
    ]);
    assert.equal(aggregateSnapshot.data()?.quantity, 7);
    assert.equal(locationSnapshot.data()?.quantity, 0);
    assert.equal(lotSnapshot.data()?.quantity, 0);
  });

  const relocationMovementId = 'mov_' + '5'.repeat(64);

  await allowed('Controle de Itens realoca posição completa e lote sem alterar saldo agregado', async () => {
    const batch = writeBatch(founder.db);

    batch.set(
      doc(founder.db, 'warehouse', WORKSPACE_ID, 'movements', relocationMovementId),
      {
        schemaVersion: 'warehouse_movement_v1',
        id: relocationMovementId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId,
        type: 'TRANSFER',
        quantityDelta: 0,
        idempotencyKeyHash: '5'.repeat(64),
        reversesMovementId: null,
        note: 'Realocação pela ficha do material em Controle de Itens',
        source: {
          kind: 'LOCATION_TRANSFER',
          actorUid: founder.user.uid,
          quantity: 2,
          from: {
            kind: 'SUBPOSITION',
            depotId,
            locationId,
            subpositionId: subpositionAId,
          },
          to: {
            kind: 'SUBPOSITION',
            depotId,
            locationId,
            subpositionId: subpositionBId,
          },
          fromBalanceId: targetBalanceId,
          toBalanceId: secondTargetBalanceId,
        },
        createdAt: serverTimestamp(),
      }
    );

    batch.set(
      doc(founder.db, 'warehouse', WORKSPACE_ID, 'locationBalances', targetBalanceId),
      {
        schemaVersion: 'warehouse_location_balance_v1',
        id: targetBalanceId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId,
        position: {
          kind: 'SUBPOSITION',
          depotId,
          locationId,
          subpositionId: subpositionAId,
        },
        quantity: 0,
        revision: 2,
        lastMovementId: relocationMovementId,
        updatedAt: serverTimestamp(),
      }
    );

    batch.set(
      doc(founder.db, 'warehouse', WORKSPACE_ID, 'locationBalances', secondTargetBalanceId),
      {
        schemaVersion: 'warehouse_location_balance_v1',
        id: secondTargetBalanceId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId,
        position: {
          kind: 'SUBPOSITION',
          depotId,
          locationId,
          subpositionId: subpositionBId,
        },
        quantity: 2,
        revision: 3,
        lastMovementId: relocationMovementId,
        updatedAt: serverTimestamp(),
      }
    );

    batch.update(
      doc(founder.db, 'warehouse', WORKSPACE_ID, 'lots', intakeAllocationLotId),
      {
        position: {
          kind: 'SUBPOSITION',
          depotId,
          locationId,
          subpositionId: subpositionBId,
        },
        updatedBy: founder.user.uid,
        updatedAt: serverTimestamp(),
      }
    );

    await batch.commit();
  });

  await allowed('realocação preserva saldo agregado e move projeção física e lote', async () => {
    const [aggregateSnapshot, fromSnapshot, toSnapshot, lotSnapshot] = await Promise.all([
      getDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'balances', materialId)),
      getDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'locationBalances', targetBalanceId)),
      getDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'locationBalances', secondTargetBalanceId)),
      getDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'lots', intakeAllocationLotId)),
    ]);
    assert.equal(aggregateSnapshot.data()?.quantity, 7);
    assert.equal(fromSnapshot.data()?.quantity, 0);
    assert.equal(toSnapshot.data()?.quantity, 2);
    assert.equal(lotSnapshot.data()?.position?.subpositionId, subpositionBId);
  });

  const oldBarcodeId = 'bar_' + '1'.repeat(64);
  const replacementBarcodeId = 'bar_' + '2'.repeat(64);

  await allowed('fundador associa código de barras ao material', () =>
    setDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'barcodes', oldBarcodeId), {
      schemaVersion: 'warehouse_barcode_v1',
      id: oldBarcodeId,
      workspaceId: WORKSPACE_ID,
      ug: UG,
      materialId,
      barcode: '789000000001',
      presentation: { code: 'unit', label: null },
      factorToBaseUnit: 1,
      status: 'active',
      createdBy: founder.user.uid,
      updatedBy: founder.user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  await allowed('edição de barcode preserva o anterior inativo e cria o substituto', async () => {
    const batch = writeBatch(founder.db);
    batch.set(
      doc(founder.db, 'warehouse', WORKSPACE_ID, 'barcodes', replacementBarcodeId),
      {
        schemaVersion: 'warehouse_barcode_v1',
        id: replacementBarcodeId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId,
        barcode: '789000000002',
        presentation: { code: 'unit', label: null },
        factorToBaseUnit: 1,
        status: 'active',
        createdBy: founder.user.uid,
        updatedBy: founder.user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );
    batch.update(
      doc(founder.db, 'warehouse', WORKSPACE_ID, 'barcodes', oldBarcodeId),
      {
        status: 'inactive',
        updatedBy: founder.user.uid,
        updatedAt: serverTimestamp(),
      }
    );
    await batch.commit();
  });

  const inventoryId = 'inv_' + 'a'.repeat(32);
  const inventoryItemId = 'invit_' + 'b'.repeat(64);
  const inventoryMovementId = 'mov_' + 'e'.repeat(64);
  const inventoryRef = doc(
    founder.db, 'warehouse', WORKSPACE_ID, 'inventories', inventoryId
  );
  const inventoryItemRef = doc(
    founder.db, 'warehouse', WORKSPACE_ID, 'inventories', inventoryId, 'items', inventoryItemId
  );

  const [inventoryBalanceBefore, inventoryLocationBefore] = await Promise.all([
    getDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'balances', materialId)),
    getDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'locationBalances', unassignedBalanceId)),
  ]);
  assert.equal(inventoryBalanceBefore.exists(), true);
  assert.equal(inventoryLocationBefore.exists(), true);
  const inventoryAggregate = inventoryBalanceBefore.data();
  const inventoryPhysical = inventoryLocationBefore.data();
  const inventoryCounted = inventoryPhysical.quantity + 1;

  await allowed('fundador abre sessão de inventário no database dedicado', () =>
    setDoc(inventoryRef, {
      schemaVersion: 'warehouse_inventory_v1',
      id: inventoryId,
      workspaceId: WORKSPACE_ID,
      ug: UG,
      scope: { kind: 'TOTAL' },
      status: 'OPENING',
      itemCount: 1,
      openedBy: founder.user.uid,
      reviewedBy: null,
      confirmationStartedBy: null,
      confirmedBy: null,
      cancelledBy: null,
      reviewSummary: null,
      staleItemId: null,
      referenceCapturedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      reviewedAt: null,
      confirmationStartedAt: null,
      confirmedAt: null,
      cancelledAt: null,
    })
  );

  await allowed('fundador cria item de inventário separado do saldo oficial', () =>
    setDoc(inventoryItemRef, {
      schemaVersion: 'warehouse_inventory_item_v1',
      id: inventoryItemId,
      inventoryId,
      workspaceId: WORKSPACE_ID,
      ug: UG,
      materialId,
      position: { kind: 'UNASSIGNED' },
      locationBalanceId: unassignedBalanceId,
      expectedQuantity: inventoryPhysical.quantity,
      expectedBalanceRevision: inventoryAggregate.revision,
      expectedBalanceLastMovementId: inventoryAggregate.lastMovementId,
      expectedLocationRevision: inventoryPhysical.revision,
      expectedLocationLastMovementId: inventoryPhysical.lastMovementId,
      countedQuantity: null,
      difference: null,
      status: 'PENDING',
      countedBy: null,
      countedAt: null,
      adjustmentMovementId: null,
      adjustedBy: null,
      adjustedAt: null,
    })
  );

  await allowed('sessão de inventário entra em contagem', () =>
    updateDoc(inventoryRef, {
      status: 'COUNTING',
      updatedAt: serverTimestamp(),
    })
  );

  await allowed('salvar contagem de inventário não altera estoque', () =>
    updateDoc(inventoryItemRef, {
      countedQuantity: inventoryCounted,
      difference: 1,
      status: 'DIVERGENT',
      countedBy: founder.user.uid,
      countedAt: serverTimestamp(),
      adjustmentMovementId: null,
      adjustedBy: null,
      adjustedAt: null,
    })
  );

  const [inventoryBalanceAfterCount, inventoryLocationAfterCount] = await Promise.all([
    getDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'balances', materialId)),
    getDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'locationBalances', unassignedBalanceId)),
  ]);
  assert.equal(inventoryBalanceAfterCount.data()?.quantity, inventoryAggregate.quantity);
  assert.equal(inventoryLocationAfterCount.data()?.quantity, inventoryPhysical.quantity);

  await denied('contagem isolada não pode alterar saldo diretamente', () =>
    updateDoc(
      doc(founder.db, 'warehouse', WORKSPACE_ID, 'balances', materialId),
      {
        quantity: inventoryAggregate.quantity + 1,
        updatedAt: serverTimestamp(),
      }
    )
  );

  await allowed('fundador fecha inventário para revisão', () =>
    updateDoc(inventoryRef, {
      status: 'REVIEW',
      reviewedBy: founder.user.uid,
      reviewSummary: {
        totalItems: 1,
        countedItems: 1,
        matchedItems: 0,
        divergentItems: 1,
        adjustedItems: 0,
        positiveDifference: 1,
        negativeDifference: 0,
      },
      reviewedAt: serverTimestamp(),
      staleItemId: null,
      updatedAt: serverTimestamp(),
    })
  );

  await allowed('fundador inicia confirmação explícita do inventário', () =>
    updateDoc(inventoryRef, {
      status: 'CONFIRMING',
      confirmationStartedBy: founder.user.uid,
      confirmationStartedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  await allowed('INVENTORY_ADJUSTMENT atualiza ledger, saldo e posição atomicamente', async () => {
    const batch = writeBatch(founder.db);
    batch.set(
      doc(founder.db, 'warehouse', WORKSPACE_ID, 'movements', inventoryMovementId),
      {
        schemaVersion: 'warehouse_movement_v1',
        id: inventoryMovementId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId,
        type: 'INVENTORY_ADJUSTMENT',
        quantityDelta: 1,
        idempotencyKeyHash: 'e'.repeat(64),
        reversesMovementId: null,
        note: 'Ajuste confirmado no inventário físico ' + inventoryId,
        source: {
          kind: 'PHYSICAL_INVENTORY',
          actorUid: founder.user.uid,
          inventoryId,
          inventoryItemId,
          expectedQuantity: inventoryPhysical.quantity,
          countedQuantity: inventoryCounted,
          position: { kind: 'UNASSIGNED' },
          locationBalanceId: unassignedBalanceId,
          expectedLocationRevision: inventoryPhysical.revision,
          expectedLocationLastMovementId: inventoryPhysical.lastMovementId,
        },
        createdAt: serverTimestamp(),
      }
    );
    batch.set(
      doc(founder.db, 'warehouse', WORKSPACE_ID, 'balances', materialId),
      {
        schemaVersion: 'warehouse_balance_v1',
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId,
        quantity: inventoryAggregate.quantity + 1,
        revision: inventoryAggregate.revision + 1,
        lastMovementId: inventoryMovementId,
        updatedAt: serverTimestamp(),
      }
    );
    batch.set(
      doc(founder.db, 'warehouse', WORKSPACE_ID, 'locationBalances', unassignedBalanceId),
      {
        schemaVersion: 'warehouse_location_balance_v1',
        id: unassignedBalanceId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId,
        position: { kind: 'UNASSIGNED' },
        quantity: inventoryPhysical.quantity + 1,
        revision: inventoryPhysical.revision + 1,
        lastMovementId: inventoryMovementId,
        updatedAt: serverTimestamp(),
      }
    );
    batch.update(inventoryItemRef, {
      status: 'ADJUSTED',
      adjustmentMovementId: inventoryMovementId,
      adjustedBy: founder.user.uid,
      adjustedAt: serverTimestamp(),
    });
    await batch.commit();
  });

  await allowed('fundador finaliza inventário confirmado', () =>
    updateDoc(inventoryRef, {
      status: 'CONFIRMED',
      confirmedBy: founder.user.uid,
      confirmedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      staleItemId: null,
    })
  );

  await denied('inventário confirmado não pode ser reaberto', () =>
    updateDoc(inventoryRef, {
      status: 'COUNTING',
      updatedAt: serverTimestamp(),
    })
  );

  await denied('histórico de inventário não pode ser excluído', () =>
    deleteDoc(inventoryRef)
  );

  await denied('usuário não fundador não lê inventário', () =>
    getDoc(doc(outsider.db, 'warehouse', WORKSPACE_ID, 'inventories', inventoryId))
  );

  await allowed('fundador cria croqui versionado', () =>
    setDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'layouts', layoutId), {
      schemaVersion: 'warehouse_depot_layout_v1',
      id: layoutId,
      workspaceId: WORKSPACE_ID,
      ug: UG,
      name: 'Croqui ADM-R1',
      depotId,
      logicalWidth: 1000,
      logicalHeight: 700,
      objects: [],
      version: 1,
      status: 'active',
      previousVersionId: null,
      createdBy: founder.user.uid,
      updatedBy: founder.user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  await allowed('fundador grava configuração básica da R1', () =>
    setDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'settings', 'logistics-alerts'), {
      schemaVersion: 'warehouse_logistics_alert_settings_v1',
      workspaceId: WORKSPACE_ID,
      ug: UG,
      lowStockThreshold: null,
      updatedBy: founder.user.uid,
      updatedAt: serverTimestamp(),
    })
  );

  await allowed('fundador cria destino cadastral', () =>
    setDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'destinations', destinationId), {
      schemaVersion: 'warehouse_destination_v1',
      id: destinationId,
      workspaceId: WORKSPACE_ID,
      ug: UG,
      name: 'Cozinha ADM-R1',
      status: 'active',
      createdBy: founder.user.uid,
      updatedBy: founder.user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );


  await allowed('fundador abre retirada auditável', () =>
    setDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'withdrawals', withdrawalId), {
      schemaVersion: 'warehouse_material_withdrawal_v1',
      id: withdrawalId,
      workspaceId: WORKSPACE_ID,
      ug: UG,
      destinationId,
      destinationName: 'Cozinha ADM-R1',
      withdrawnBy: 'Militar ADM-R1',
      payloadHash: 'a'.repeat(64),
      expectedLineCount: 2,
      appliedLineCount: 0,
      status: 'FINALIZING',
      createdBy: founder.user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      finalizedAt: null,
    })
  );

  await allowed('fundador registra progresso parcial da retirada', () =>
    updateDoc(
      doc(founder.db, 'warehouse', WORKSPACE_ID, 'withdrawals', withdrawalId),
      {
        appliedLineCount: 1,
        status: 'PARTIALLY_APPLIED',
        updatedAt: serverTimestamp(),
        finalizedAt: null,
      }
    )
  );

  await allowed('fundador registra última linha antes do fechamento final', () =>
    updateDoc(
      doc(founder.db, 'warehouse', WORKSPACE_ID, 'withdrawals', withdrawalId),
      {
        appliedLineCount: 2,
        status: 'PARTIALLY_APPLIED',
        updatedAt: serverTimestamp(),
        finalizedAt: null,
      }
    )
  );

  await allowed('fundador finaliza cabeçalho da retirada', () =>
    updateDoc(
      doc(founder.db, 'warehouse', WORKSPACE_ID, 'withdrawals', withdrawalId),
      {
        appliedLineCount: 2,
        status: 'FINALIZED',
        updatedAt: serverTimestamp(),
        finalizedAt: serverTimestamp(),
      }
    )
  );

  const stockConsumptionId = 'cons_' + 'd'.repeat(64);
  const stockLineId = 'wline_' + 'e'.repeat(32);
  const physicalOutboundReturnMovementId = 'mov_' + 'f'.repeat(64);
  const physicalReturnLotId = 'lot_' + 'f'.repeat(32);

  await allowed('fundador projeta saída finalizada no registro auditável', () =>
    setDoc(
      doc(founder.db, 'warehouse', WORKSPACE_ID, 'consumptions', stockConsumptionId),
      {
        schemaVersion: 'warehouse_consumption_record_v1',
        id: stockConsumptionId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        origin: 'STOCK_OUTBOUND',
        materialId,
        materialDescription: 'Material ADM-R1',
        unitLabel: 'UN',
        quantity: 1,
        requestedQuantity: 1,
        presentationLabel: 'UN',
        destinationId,
        destinationName: 'Cozinha ADM-R1',
        withdrawnBy: 'Militar ADM-R1',
        operatorUid: founder.user.uid,
        movementId: outboundMovementId,
        withdrawalId,
        lineId: stockLineId,
        intakeId: null,
        invoiceRecordKey: null,
        barcode: null,
        lotCode: 'PEND-R1',
        positionLabel: 'Subposição ADM-R1 B',
        siscofisStatus: 'PENDING',
        occurredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        siscofisUpdatedBy: null,
        siscofisUpdatedAt: null,
        returnedQuantity: 0,
        lastReturnMovementId: null,
        lastReturnAt: null,
        lastReturnBy: null,
        lastReturnReason: null,
      }
    )
  );

  await allowed('fundador devolve saída ao estoque sem apagar histórico', () =>
    runTransaction(founder.db, async (transaction) => {
      const movementRef = doc(
        founder.db, 'warehouse', WORKSPACE_ID, 'movements', physicalOutboundReturnMovementId
      );
      const balanceRef = doc(
        founder.db, 'warehouse', WORKSPACE_ID, 'balances', materialId
      );
      const locationBalanceRef = doc(
        founder.db, 'warehouse', WORKSPACE_ID, 'locationBalances', secondTargetBalanceId
      );
      const consumptionRef = doc(
        founder.db, 'warehouse', WORKSPACE_ID, 'consumptions', stockConsumptionId
      );

      transaction.set(movementRef, {
        schemaVersion: 'warehouse_movement_v1',
        id: physicalOutboundReturnMovementId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId,
        type: 'OUTBOUND_RETURN',
        quantityDelta: 1,
        idempotencyKeyHash: 'f'.repeat(64),
        reversesMovementId: null,
        note: 'Devolução/cancelamento de saída de teste',
        source: {
          kind: 'OUTBOUND_RETURN',
          actorUid: founder.user.uid,
          consumptionId: stockConsumptionId,
          originalMovementId: outboundMovementId,
          quantity: 1,
          position: {
            kind: 'SUBPOSITION',
            depotId,
            locationId,
            subpositionId: subpositionBId,
          },
          locationBalanceId: secondTargetBalanceId,
          lotId: secondAllocationLotId,
          reason: 'Saída cancelada e material devolvido',
        },
        createdAt: serverTimestamp(),
      });

      transaction.set(balanceRef, {
        schemaVersion: 'warehouse_balance_v1',
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId,
        quantity: 8,
        revision: 4,
        lastMovementId: physicalOutboundReturnMovementId,
        updatedAt: serverTimestamp(),
      });

      transaction.set(locationBalanceRef, {
        schemaVersion: 'warehouse_location_balance_v1',
        id: secondTargetBalanceId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId,
        position: {
          kind: 'SUBPOSITION',
          depotId,
          locationId,
          subpositionId: subpositionBId,
        },
        quantity: 3,
        revision: 4,
        lastMovementId: physicalOutboundReturnMovementId,
        updatedAt: serverTimestamp(),
      });

      transaction.update(consumptionRef, {
        returnedQuantity: 1,
        lastReturnMovementId: physicalOutboundReturnMovementId,
        lastReturnAt: serverTimestamp(),
        lastReturnBy: founder.user.uid,
        lastReturnReason: 'Saída cancelada e material devolvido',
        updatedAt: serverTimestamp(),
      });
    })
  );

  await allowed('devolução recompõe saldo e mantém o registro da saída', async () => {
    const [aggregateSnapshot, locationSnapshot, originalLotSnapshot, consumptionSnapshot] =
      await Promise.all([
        getDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'balances', materialId)),
        getDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'locationBalances', secondTargetBalanceId)),
        getDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'lots', secondAllocationLotId)),
        getDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'consumptions', stockConsumptionId)),
      ]);
    assert.equal(aggregateSnapshot.data()?.quantity, 8);
    assert.equal(locationSnapshot.data()?.quantity, 3);
    assert.equal(originalLotSnapshot.data()?.quantity, 0);
    assert.equal(consumptionSnapshot.data()?.quantity, 1);
    assert.equal(consumptionSnapshot.data()?.returnedQuantity, 1);
  });

  await allowed('validade devolvida é recomposta em enriquecimento idempotente separado', () =>
    setDoc(
      doc(founder.db, 'warehouse', WORKSPACE_ID, 'lots', physicalReturnLotId),
      {
        schemaVersion: 'warehouse_lot_v1',
        id: physicalReturnLotId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId,
        code: 'PEND-R1',
        expiresOn: null,
        quantity: 1,
        position: {
          kind: 'SUBPOSITION',
          depotId,
          locationId,
          subpositionId: subpositionBId,
        },
        origin: {
          kind: 'MANUAL_ENRICHMENT',
          movementId: physicalOutboundReturnMovementId,
          invoiceRecordKey: null,
          invoiceId: null,
          supplier: null,
          supplierCnpj: null,
        },
        status: 'active',
        createdBy: founder.user.uid,
        updatedBy: founder.user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    )
  );

  await allowed('enriquecimento devolvido preserva validade sem alterar o saldo oficial', async () => {
    const [returnLotSnapshot, aggregateSnapshot, locationSnapshot] = await Promise.all([
      getDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'lots', physicalReturnLotId)),
      getDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'balances', materialId)),
      getDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'locationBalances', secondTargetBalanceId)),
    ]);
    assert.equal(returnLotSnapshot.data()?.quantity, 1);
    assert.equal(returnLotSnapshot.data()?.origin?.movementId, physicalOutboundReturnMovementId);
    assert.equal(aggregateSnapshot.data()?.quantity, 8);
    assert.equal(locationSnapshot.data()?.quantity, 3);
  });

  const invalidReturnMovementId = 'mov_' + '0'.repeat(64);
  await denied('devolução não pode ultrapassar a quantidade originalmente retirada', () =>
    runTransaction(founder.db, async (transaction) => {
      transaction.set(
        doc(founder.db, 'warehouse', WORKSPACE_ID, 'movements', invalidReturnMovementId),
        {
          schemaVersion: 'warehouse_movement_v1',
          id: invalidReturnMovementId,
          workspaceId: WORKSPACE_ID,
          ug: UG,
          materialId,
          type: 'OUTBOUND_RETURN',
          quantityDelta: 1,
          idempotencyKeyHash: '0'.repeat(64),
          reversesMovementId: null,
          note: 'Tentativa de devolução excedente',
          source: {
            kind: 'OUTBOUND_RETURN',
            actorUid: founder.user.uid,
            consumptionId: stockConsumptionId,
            originalMovementId: outboundMovementId,
            quantity: 1,
            position: {
              kind: 'SUBPOSITION',
              depotId,
              locationId,
              subpositionId: subpositionBId,
            },
            locationBalanceId: secondTargetBalanceId,
            lotId: secondAllocationLotId,
            reason: 'Tentativa excedente',
          },
          createdAt: serverTimestamp(),
        }
      );
      transaction.set(
        doc(founder.db, 'warehouse', WORKSPACE_ID, 'balances', materialId),
        {
          schemaVersion: 'warehouse_balance_v1',
          workspaceId: WORKSPACE_ID,
          ug: UG,
          materialId,
          quantity: 9,
          revision: 5,
          lastMovementId: invalidReturnMovementId,
          updatedAt: serverTimestamp(),
        }
      );
      transaction.set(
        doc(founder.db, 'warehouse', WORKSPACE_ID, 'locationBalances', secondTargetBalanceId),
        {
          schemaVersion: 'warehouse_location_balance_v1',
          id: secondTargetBalanceId,
          workspaceId: WORKSPACE_ID,
          ug: UG,
          materialId,
          position: {
            kind: 'SUBPOSITION',
            depotId,
            locationId,
            subpositionId: subpositionBId,
          },
          quantity: 4,
          revision: 5,
          lastMovementId: invalidReturnMovementId,
          updatedAt: serverTimestamp(),
        }
      );
      transaction.update(
        doc(founder.db, 'warehouse', WORKSPACE_ID, 'consumptions', stockConsumptionId),
        {
          returnedQuantity: 2,
          lastReturnMovementId: invalidReturnMovementId,
          lastReturnAt: serverTimestamp(),
          lastReturnBy: founder.user.uid,
          lastReturnReason: 'Tentativa excedente',
          updatedAt: serverTimestamp(),
        }
      );
    })
  );

  await allowed('fundador remove NF apenas da fila do ADM', () =>
    setDoc(
      doc(
        founder.db,
        'warehouse',
        WORKSPACE_ID,
        'queueExclusions',
        queueExclusionId
      ),
      {
        schemaVersion: 'warehouse_intake_queue_exclusion_v1',
        id: queueExclusionId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        invoiceRecordKey: 'nf-r1-removida',
        invoiceId: 'NF-R1-REMOVIDA',
        empenhoId: '2026NE000099',
        pregao: '90001/2026',
        removedBy: founder.user.uid,
        removedAt: serverTimestamp(),
      }
    )
  );

  const lightweightIntakeId = 'intake_' + '6'.repeat(64);
  const lightweightConsumptionId = 'cons_' + '7'.repeat(64);

  await allowed('fundador registra consumo imediato leve sem movimento de estoque', () =>
    runTransaction(founder.db, async (transaction) => {
      const intakeRef = doc(
        founder.db,
        'warehouse',
        WORKSPACE_ID,
        'intakes',
        lightweightIntakeId
      );
      const consumptionRef = doc(
        founder.db,
        'warehouse',
        WORKSPACE_ID,
        'consumptions',
        lightweightConsumptionId
      );

      transaction.set(intakeRef, {
        schemaVersion: 'warehouse_item_intake_v2',
        id: lightweightIntakeId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        invoiceRecordKey: 'nf-r1-light',
        invoiceId: 'NF-R1-LIGHT',
        empenhoId: '2026NE000001',
        itemId: 'ITEM-R1-LIGHT',
        materialId: null,
        description: 'Material de consumo imediato',
        unitLabel: 'UN',
        supplier: 'Fornecedor ADM-R1',
        receivedQuantity: 10,
        allocatedQuantity: 0,
        immediateConsumptionQuantity: 10,
        pendingQuantity: 0,
        status: 'PROCESSED',
        createdBy: founder.user.uid,
        updatedBy: founder.user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      transaction.set(consumptionRef, {
        schemaVersion: 'warehouse_consumption_record_v1',
        id: lightweightConsumptionId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        origin: 'IMMEDIATE_CONSUMPTION',
        materialId: null,
        materialDescription: 'Material de consumo imediato',
        unitLabel: 'UN',
        quantity: 10,
        requestedQuantity: 10,
        presentationLabel: 'UN',
        destinationId,
        destinationName: 'Cozinha ADM-R1',
        withdrawnBy: 'Militar ADM-R1',
        operatorUid: founder.user.uid,
        movementId: null,
        withdrawalId: null,
        lineId: null,
        intakeId: lightweightIntakeId,
        invoiceRecordKey: 'nf-r1-light',
        barcode: null,
        lotCode: null,
        positionLabel: 'Consumo imediato · sem entrada em estoque',
        siscofisStatus: 'PENDING',
        occurredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        siscofisUpdatedBy: null,
        siscofisUpdatedAt: null,
      });
    })
  );

  const manualMaterialId = 'mat_' + 'abcdef0123456789'.repeat(2);
  const manualMovementId = 'mov_' + '1234567890abcdef'.repeat(4);
  const manualLocationBalanceId = 'locbal_' + 'fedcba0987654321'.repeat(4);

  await allowed('fundador cria material para entrada avulsa auditável', () =>
    setDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'materials', manualMaterialId), {
      schemaVersion: 'warehouse_material_v1',
      id: manualMaterialId,
      workspaceId: WORKSPACE_ID,
      ug: UG,
      description: 'Material de procedência diversa',
      aliases: [],
      unit: { code: 'unit', label: null },
      status: 'active',
      conversions: [],
    })
  );

  await allowed('fundador registra MANUAL_ENTRY com procedência estruturada', () =>
    runTransaction(founder.db, async (transaction) => {
      const movementRef = doc(
        founder.db, 'warehouse', WORKSPACE_ID, 'movements', manualMovementId
      );
      const balanceRef = doc(
        founder.db, 'warehouse', WORKSPACE_ID, 'balances', manualMaterialId
      );
      const locationBalanceRef = doc(
        founder.db, 'warehouse', WORKSPACE_ID, 'locationBalances', manualLocationBalanceId
      );

      transaction.set(movementRef, {
        schemaVersion: 'warehouse_movement_v1',
        id: manualMovementId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId: manualMaterialId,
        type: 'MANUAL_ENTRY',
        quantityDelta: 4,
        idempotencyKeyHash: '1234567890abcdef'.repeat(4),
        reversesMovementId: null,
        note: 'Entrada avulsa · doação',
        source: {
          kind: 'MANUAL_ENTRY',
          actorUid: founder.user.uid,
          provenance: 'Doação',
          reference: 'TERMO 01/2026',
        },
        createdAt: serverTimestamp(),
      });
      transaction.set(balanceRef, {
        schemaVersion: 'warehouse_balance_v1',
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId: manualMaterialId,
        quantity: 4,
        revision: 1,
        lastMovementId: manualMovementId,
        updatedAt: serverTimestamp(),
      });
      transaction.set(locationBalanceRef, {
        schemaVersion: 'warehouse_location_balance_v1',
        id: manualLocationBalanceId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        materialId: manualMaterialId,
        position: { kind: 'UNASSIGNED' },
        quantity: 4,
        revision: 1,
        lastMovementId: manualMovementId,
        updatedAt: serverTimestamp(),
      });
    })
  );

  const returnOutboundMovementId = 'mov_' + '2468ace013579bdf'.repeat(4);
  const returnConsumptionId = 'cons_' + '13579bdf2468ace0'.repeat(4);
  const returnLineId = 'wline_' + '13579bdf2468ace0'.repeat(2);

  await allowed('fundador registra saída vinculada antes da devolução', () =>
    runTransaction(founder.db, async (transaction) => {
      transaction.set(
        doc(founder.db, 'warehouse', WORKSPACE_ID, 'movements', returnOutboundMovementId),
        {
          schemaVersion: 'warehouse_movement_v1',
          id: returnOutboundMovementId,
          workspaceId: WORKSPACE_ID,
          ug: UG,
          materialId: manualMaterialId,
          type: 'OUTBOUND',
          quantityDelta: -2,
          idempotencyKeyHash: '2468ace013579bdf'.repeat(4),
          reversesMovementId: null,
          note: 'Saída para teste de devolução parcial',
          source: {
            kind: 'EXPRESS_OUTBOUND',
            interface: 'MANUAL_SEARCH',
            actorUid: founder.user.uid,
            requestedQuantity: 2,
            quantity: 2,
            presentation: { code: 'unit', label: null },
            factorToBaseUnit: 1,
            barcodeId: null,
            barcode: null,
            position: { kind: 'UNASSIGNED' },
            locationBalanceId: manualLocationBalanceId,
            lotId: null,
            lotCode: null,
          },
          createdAt: serverTimestamp(),
        }
      );
      transaction.set(
        doc(founder.db, 'warehouse', WORKSPACE_ID, 'balances', manualMaterialId),
        {
          schemaVersion: 'warehouse_balance_v1',
          workspaceId: WORKSPACE_ID,
          ug: UG,
          materialId: manualMaterialId,
          quantity: 2,
          revision: 2,
          lastMovementId: returnOutboundMovementId,
          updatedAt: serverTimestamp(),
        }
      );
      transaction.set(
        doc(founder.db, 'warehouse', WORKSPACE_ID, 'locationBalances', manualLocationBalanceId),
        {
          schemaVersion: 'warehouse_location_balance_v1',
          id: manualLocationBalanceId,
          workspaceId: WORKSPACE_ID,
          ug: UG,
          materialId: manualMaterialId,
          position: { kind: 'UNASSIGNED' },
          quantity: 2,
          revision: 2,
          lastMovementId: returnOutboundMovementId,
          updatedAt: serverTimestamp(),
        }
      );
    })
  );

  await allowed('fundador registra projeção auditável da saída para relatório', () =>
    setDoc(
      doc(founder.db, 'warehouse', WORKSPACE_ID, 'consumptions', returnConsumptionId),
      {
        schemaVersion: 'warehouse_consumption_record_v1',
        id: returnConsumptionId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        origin: 'STOCK_OUTBOUND',
        materialId: manualMaterialId,
        materialDescription: 'Material de procedência diversa',
        unitLabel: 'UN',
        quantity: 2,
        requestedQuantity: 2,
        presentationLabel: 'UN',
        destinationId,
        destinationName: 'Cozinha ADM-R1',
        withdrawnBy: 'Militar ADM-R1',
        operatorUid: founder.user.uid,
        movementId: returnOutboundMovementId,
        withdrawalId,
        lineId: returnLineId,
        intakeId: null,
        invoiceRecordKey: null,
        barcode: null,
        lotCode: null,
        positionLabel: 'Sem localização',
        siscofisStatus: 'PENDING',
        occurredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        siscofisUpdatedBy: null,
        siscofisUpdatedAt: null,
        returnedQuantity: 0,
        lastReturnMovementId: null,
        lastReturnAt: null,
        lastReturnBy: null,
        lastReturnReason: null,
      }
    )
  );

  const outboundReturnMovementId = 'mov_' + 'abcdef1234567890'.repeat(4);

  await allowed('cancelamento parcial devolve exatamente a quantidade informada ao estoque', () =>
    runTransaction(founder.db, async (transaction) => {
      transaction.set(
        doc(founder.db, 'warehouse', WORKSPACE_ID, 'movements', outboundReturnMovementId),
        {
          schemaVersion: 'warehouse_movement_v1',
          id: outboundReturnMovementId,
          workspaceId: WORKSPACE_ID,
          ug: UG,
          materialId: manualMaterialId,
          type: 'MANUAL_ENTRY',
          quantityDelta: 1,
          idempotencyKeyHash: 'abcdef1234567890'.repeat(4),
          reversesMovementId: null,
          note: 'Devolução/cancelamento de saída',
          source: {
            kind: 'MANUAL_ENTRY',
            actorUid: founder.user.uid,
            provenance: 'Devolução de saída',
            reference: returnConsumptionId,
          },
          createdAt: serverTimestamp(),
        }
      );
      transaction.set(
        doc(founder.db, 'warehouse', WORKSPACE_ID, 'balances', manualMaterialId),
        {
          schemaVersion: 'warehouse_balance_v1',
          workspaceId: WORKSPACE_ID,
          ug: UG,
          materialId: manualMaterialId,
          quantity: 3,
          revision: 3,
          lastMovementId: outboundReturnMovementId,
          updatedAt: serverTimestamp(),
        }
      );
      transaction.set(
        doc(founder.db, 'warehouse', WORKSPACE_ID, 'locationBalances', manualLocationBalanceId),
        {
          schemaVersion: 'warehouse_location_balance_v1',
          id: manualLocationBalanceId,
          workspaceId: WORKSPACE_ID,
          ug: UG,
          materialId: manualMaterialId,
          position: { kind: 'UNASSIGNED' },
          quantity: 3,
          revision: 3,
          lastMovementId: outboundReturnMovementId,
          updatedAt: serverTimestamp(),
        }
      );
      transaction.update(
        doc(founder.db, 'warehouse', WORKSPACE_ID, 'consumptions', returnConsumptionId),
        {
          returnedQuantity: 1,
          lastReturnMovementId: outboundReturnMovementId,
          lastReturnAt: serverTimestamp(),
          lastReturnBy: founder.user.uid,
          lastReturnReason: 'Material devolvido',
          updatedAt: serverTimestamp(),
        }
      );
    })
  );

  await allowed('devolução parcial preserva saída original e saldo líquido', async () => {
    const [balanceSnapshot, locationSnapshot, consumptionSnapshot] = await Promise.all([
      getDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'balances', manualMaterialId)),
      getDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'locationBalances', manualLocationBalanceId)),
      getDoc(doc(founder.db, 'warehouse', WORKSPACE_ID, 'consumptions', returnConsumptionId)),
    ]);
    assert.equal(balanceSnapshot.data()?.quantity, 3);
    assert.equal(locationSnapshot.data()?.quantity, 3);
    assert.equal(consumptionSnapshot.data()?.quantity, 2);
    assert.equal(consumptionSnapshot.data()?.returnedQuantity, 1);
    assert.equal(consumptionSnapshot.data()?.lastReturnMovementId, outboundReturnMovementId);
  });

  const excessiveReturnMovementId = 'mov_' + 'deadbeefcafefeed'.repeat(4);
  await denied('devolução acima do saldo ainda retirado permanece bloqueada', () =>
    runTransaction(founder.db, async (transaction) => {
      transaction.set(
        doc(founder.db, 'warehouse', WORKSPACE_ID, 'movements', excessiveReturnMovementId),
        {
          schemaVersion: 'warehouse_movement_v1',
          id: excessiveReturnMovementId,
          workspaceId: WORKSPACE_ID,
          ug: UG,
          materialId: manualMaterialId,
          type: 'MANUAL_ENTRY',
          quantityDelta: 2,
          idempotencyKeyHash: 'deadbeefcafefeed'.repeat(4),
          reversesMovementId: null,
          note: 'Devolução inválida acima do remanescente',
          source: {
            kind: 'MANUAL_ENTRY',
            actorUid: founder.user.uid,
            provenance: 'Devolução de saída',
            reference: returnConsumptionId,
          },
          createdAt: serverTimestamp(),
        }
      );
      transaction.set(
        doc(founder.db, 'warehouse', WORKSPACE_ID, 'balances', manualMaterialId),
        {
          schemaVersion: 'warehouse_balance_v1',
          workspaceId: WORKSPACE_ID,
          ug: UG,
          materialId: manualMaterialId,
          quantity: 5,
          revision: 4,
          lastMovementId: excessiveReturnMovementId,
          updatedAt: serverTimestamp(),
        }
      );
      transaction.set(
        doc(founder.db, 'warehouse', WORKSPACE_ID, 'locationBalances', manualLocationBalanceId),
        {
          schemaVersion: 'warehouse_location_balance_v1',
          id: manualLocationBalanceId,
          workspaceId: WORKSPACE_ID,
          ug: UG,
          materialId: manualMaterialId,
          position: { kind: 'UNASSIGNED' },
          quantity: 5,
          revision: 4,
          lastMovementId: excessiveReturnMovementId,
          updatedAt: serverTimestamp(),
        }
      );
      transaction.update(
        doc(founder.db, 'warehouse', WORKSPACE_ID, 'consumptions', returnConsumptionId),
        {
          returnedQuantity: 3,
          lastReturnMovementId: excessiveReturnMovementId,
          lastReturnAt: serverTimestamp(),
          lastReturnBy: founder.user.uid,
          lastReturnReason: 'Tentativa acima do remanescente',
          updatedAt: serverTimestamp(),
        }
      );
    })
  );

  const invalidManualMovementId = 'mov_' + '0f1e2d3c4b5a6978'.repeat(4);
  await denied('MANUAL_ENTRY sem procedência estruturada permanece bloqueado', () =>
    runTransaction(founder.db, async (transaction) => {
      transaction.set(
        doc(founder.db, 'warehouse', WORKSPACE_ID, 'movements', invalidManualMovementId),
        {
          schemaVersion: 'warehouse_movement_v1',
          id: invalidManualMovementId,
          workspaceId: WORKSPACE_ID,
          ug: UG,
          materialId: manualMaterialId,
          type: 'MANUAL_ENTRY',
          quantityDelta: 1,
          idempotencyKeyHash: '0f1e2d3c4b5a6978'.repeat(4),
          reversesMovementId: null,
          note: 'Entrada avulsa inválida',
          createdAt: serverTimestamp(),
        }
      );
      transaction.set(
        doc(founder.db, 'warehouse', WORKSPACE_ID, 'balances', manualMaterialId),
        {
          schemaVersion: 'warehouse_balance_v1',
          workspaceId: WORKSPACE_ID,
          ug: UG,
          materialId: manualMaterialId,
          quantity: 5,
          revision: 2,
          lastMovementId: invalidManualMovementId,
          updatedAt: serverTimestamp(),
        }
      );
      transaction.set(
        doc(founder.db, 'warehouse', WORKSPACE_ID, 'locationBalances', manualLocationBalanceId),
        {
          schemaVersion: 'warehouse_location_balance_v1',
          id: manualLocationBalanceId,
          workspaceId: WORKSPACE_ID,
          ug: UG,
          materialId: manualMaterialId,
          position: { kind: 'UNASSIGNED' },
          quantity: 5,
          revision: 2,
          lastMovementId: invalidManualMovementId,
          updatedAt: serverTimestamp(),
        }
      );
    })
  );

  for (const domain of [
    ['materials', materialId],
    ['depots', depotId],
    ['locations', locationId],
    ['layouts', layoutId],
    ['settings', 'logistics-alerts'],
    ['destinations', destinationId],
    ['withdrawals', withdrawalId],
    ['inventories', inventoryId],
    ['queueExclusions', queueExclusionId],
  ]) {
    const [collectionName, documentId] = domain;
    await allowed('fundador lê ' + collectionName, async () => {
      const snapshot = await getDoc(
        doc(founder.db, 'warehouse', WORKSPACE_ID, collectionName, documentId)
      );
      assert.equal(snapshot.exists(), true);
    });

    await allowed('fundador lista ' + collectionName, () =>
      getDocs(collection(founder.db, 'warehouse', WORKSPACE_ID, collectionName))
    );
  }

  await denied('usuário não fundador não lê a R1', () =>
    getDoc(doc(outsider.db, 'warehouse', WORKSPACE_ID, 'materials', materialId))
  );

  await denied('usuário não fundador não grava a R1', () =>
    setDoc(doc(outsider.db, 'warehouse', WORKSPACE_ID, 'materials', 'mat_' + '9'.repeat(32)), {
      schemaVersion: 'warehouse_material_v1',
      id: 'mat_' + '9'.repeat(32),
      workspaceId: WORKSPACE_ID,
      ug: UG,
      description: 'Tentativa externa',
      aliases: [],
      unit: { code: 'unit', label: null },
      status: 'active',
      conversions: [],
    })
  );

  await allowed('fundador lista saldos físicos somente leitura para a prévia 2.5D', () =>
    getDocs(collection(founder.db, 'warehouse', WORKSPACE_ID, 'locationBalances'))
  );

  await denied('usuário não fundador não lista saldos físicos', () =>
    getDocs(collection(outsider.db, 'warehouse', WORKSPACE_ID, 'locationBalances'))
  );

  await denied('gravação física arbitrária continua bloqueada pelos validadores', () =>
    setDoc(
      doc(founder.db, 'warehouse', WORKSPACE_ID, 'locationBalances', 'probe-r1'),
      { marker: 'invalid-write-must-stay-denied' }
    )
  );

  const operationalDomains = [
    'movements',
    'balances',
    'lots',
    'barcodes',
    'siscofisSnapshots',
    'consumptions',
    'withdrawals',
    'inventories',
    'intakes',
  ];

  for (const domain of operationalDomains) {
    await allowed('fundador lista domínio operacional: ' + domain, () =>
      getDocs(collection(founder.db, 'warehouse', WORKSPACE_ID, domain))
    );

    await denied('gravação arbitrária segue negada em ' + domain, () =>
      setDoc(
        doc(founder.db, 'warehouse', WORKSPACE_ID, domain, 'probe-r1'),
        { marker: 'invalid-write-must-stay-denied' }
      )
    );
  }

  await denied('fundador não exclui fisicamente queueExclusions', () =>
    deleteDoc(
      doc(founder.db, 'warehouse', WORKSPACE_ID, 'queueExclusions', queueExclusionId)
    )
  );

  await denied('usuário não fundador não lê queueExclusions', () =>
    getDoc(
      doc(outsider.db, 'warehouse', WORKSPACE_ID, 'queueExclusions', queueExclusionId)
    )
  );

  for (const domain of ['alerts']) {
    await denied('domínio estacionado permanece bloqueado: ' + domain, () =>
      getDocs(collection(founder.db, 'warehouse', WORKSPACE_ID, domain))
    );
  }

  await denied('usuário não fundador não lista intakes', () =>
    getDocs(collection(outsider.db, 'warehouse', WORKSPACE_ID, 'intakes'))
  );

  console.log('\nADM Depósito modular security test: PASS');
  console.log('- fundador pode ler somente os domínios operacionais liberados');
  console.log('- withdrawals e inventories estão operacionais; alerts permanece estacionado');
  console.log('- gravações arbitrárias continuam negadas pelos contratos');
  console.log('- acesso externo permanece negado');
  console.log('- exclusão lógica retira NF da fila sem criar consumo ou movimento de estoque');
  console.log('- consumo imediato histórico continua protegido para compatibilidade');
  console.log('- cabeçalho de Saída de Material é founder-only, monotônico e não pode ser reaberto após FINALIZED');
  console.log('- INVOICE_ENTRY válido é aceito sobre saldo existente e preserva ledger/locationBalance');
  console.log('- alocação completa TRANSFER + posições + lote + intake é coberta pelo teste positivo');
  console.log('- duas alocações sequenciais em subposições distintas levam o intake parcial a PROCESSED');
  console.log('- retirada total OUTBOUND reduz saldo agregado, zera a posição física e zera o lote correspondente');
  console.log('- ficha do item realoca posição e lote por TRANSFER sem alterar saldo agregado');
  console.log('- edição de barcode preserva o código anterior inativo e cria o substituto ativo');
  console.log('- inventário conta sem alterar estoque e só INVENTORY_ADJUSTMENT confirmado modifica ledger/saldos');
  console.log('- TRANSFER não regrava o saldo agregado quando a quantidade total não muda');
  console.log('- devolução reutiliza MANUAL_ENTRY auditável, limita o remanescente e preserva a saída original');
  console.log('- operações com estoque continuam obrigadas a respeitar ledger e invariantes');
}

main()
  .catch((error) => {
    console.error('\nADM Depósito ADM-R1 security test: FAIL');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all(apps.map((app) => deleteApp(app).catch(() => undefined)));
  });
