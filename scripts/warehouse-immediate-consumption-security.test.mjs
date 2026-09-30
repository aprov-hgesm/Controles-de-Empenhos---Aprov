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
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  runTransaction,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-emprovex-security';
const API_KEY = 'fake-api-key';
const AUTH_BASE = 'http://127.0.0.1:9099';
const WORKSPACE_ID = 'hgesm-aprov';
const UG = '160416';
const WAREHOUSE_DATABASE_ID = 'emprovex-warehouse';

function founderCredential() {
  return GoogleAuthProvider.credential(
    JSON.stringify({
      sub: 'google-founder-immediate',
      email: 'aprov1hgesm@gmail.com',
      email_verified: true,
    })
  );
}

async function main() {
  console.log('Central de Depósitos — consumo imediato fundador\n');

  const app = initializeApp({
    projectId: PROJECT_ID,
    apiKey: API_KEY,
    authDomain: PROJECT_ID + '.firebaseapp.com',
  }, 'warehouse-immediate-founder');

  try {
    const auth = getAuth(app);
    connectAuthEmulator(auth, AUTH_BASE, { disableWarnings: true });
    const credential = await signInWithCredential(auth, founderCredential());
    const token = await credential.user.getIdTokenResult(true);

    assert.equal(credential.user.emailVerified, true);
    assert.equal(token.signInProvider, 'google.com');

    const db = getFirestore(app, WAREHOUSE_DATABASE_ID);
    connectFirestoreEmulator(db, '127.0.0.1', 8080);

    const destinationId = 'dest_' + 'd'.repeat(32);
    await setDoc(
      doc(db, 'warehouse', WORKSPACE_ID, 'destinations', destinationId),
      {
        schemaVersion: 'warehouse_destination_v1',
        id: destinationId,
        workspaceId: WORKSPACE_ID,
        ug: UG,
        name: 'Cozinha',
        status: 'active',
        createdBy: credential.user.uid,
        updatedBy: credential.user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );
    console.log('  [PASS] ALLOW — fundador cria destino ativo');

    const intakeId = 'intake_' + 'e'.repeat(64);
    const consumptionId = 'cons_' + 'f'.repeat(64);

    await runTransaction(db, async (transaction) => {
      transaction.set(
        doc(db, 'warehouse', WORKSPACE_ID, 'intakes', intakeId),
        {
          schemaVersion: 'warehouse_item_intake_v2',
          id: intakeId,
          workspaceId: WORKSPACE_ID,
          ug: UG,
          invoiceRecordKey: 'nf-2914-founder-immediate',
          invoiceId: '2914',
          empenhoId: '2026NE000001',
          itemId: 'ITEM-001',
          materialId: null,
          description: 'Fruta, tipo tangerina poncan, apresentação natural',
          unitLabel: 'KG',
          supplier: 'Fornecedor de teste',
          receivedQuantity: 10,
          allocatedQuantity: 0,
          immediateConsumptionQuantity: 10,
          pendingQuantity: 0,
          status: 'PROCESSED',
          createdBy: credential.user.uid,
          updatedBy: credential.user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      transaction.set(
        doc(db, 'warehouse', WORKSPACE_ID, 'consumptions', consumptionId),
        {
          schemaVersion: 'warehouse_consumption_record_v1',
          id: consumptionId,
          workspaceId: WORKSPACE_ID,
          ug: UG,
          origin: 'IMMEDIATE_CONSUMPTION',
          materialId: null,
          materialDescription: 'Fruta, tipo tangerina poncan, apresentação natural',
          unitLabel: 'KG',
          quantity: 10,
          requestedQuantity: 10,
          presentationLabel: 'KG',
          destinationId,
          destinationName: 'Cozinha',
          withdrawnBy: 'Militar de teste',
          operatorUid: credential.user.uid,
          movementId: null,
          withdrawalId: null,
          lineId: null,
          intakeId,
          invoiceRecordKey: 'nf-2914-founder-immediate',
          barcode: null,
          lotCode: null,
          positionLabel: 'Consumo imediato · sem entrada em estoque',
          siscofisStatus: 'PENDING',
          occurredAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          siscofisUpdatedBy: null,
          siscofisUpdatedAt: null,
        }
      );
    });

    const [intake, consumption] = await Promise.all([
      getDoc(doc(db, 'warehouse', WORKSPACE_ID, 'intakes', intakeId)),
      getDoc(doc(db, 'warehouse', WORKSPACE_ID, 'consumptions', consumptionId)),
    ]);

    assert.equal(intake.exists(), true);
    assert.equal(intake.data()?.status, 'PROCESSED');
    assert.equal(consumption.exists(), true);
    assert.equal(consumption.data()?.origin, 'IMMEDIATE_CONSUMPTION');

    console.log('  [PASS] ALLOW — fundador registra consumo imediato sem entrada em estoque');
    console.log('\nCentral de Depósitos immediate founder security test: PASS');
  } finally {
    await deleteApp(app);
  }
}

main().catch((error) => {
  console.error('\nCentral de Depósitos immediate founder security test: FAIL');
  console.error(error);
  process.exitCode = 1;
});
