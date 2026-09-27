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
  doc,
  getDoc,
  getDocs,
  getFirestore,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-emprovex-security';
const API_KEY = 'fake-api-key';
const AUTH_BASE = 'http://127.0.0.1:9099';
const WORKSPACE_ID = 'hgesm-aprov';
const UG = '160416';

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

  const db = getFirestore(app);
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

  for (const domain of [
    ['materials', materialId],
    ['depots', depotId],
    ['locations', locationId],
    ['layouts', layoutId],
    ['settings', 'logistics-alerts'],
    ['destinations', destinationId],
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
    'intakes',
    'queueExclusions',
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

  for (const domain of ['alerts', 'inventories', 'withdrawals']) {
    await denied('domínio estacionado permanece bloqueado: ' + domain, () =>
      getDocs(collection(founder.db, 'warehouse', WORKSPACE_ID, domain))
    );
  }

  await denied('usuário não fundador não lista intakes', () =>
    getDocs(collection(outsider.db, 'warehouse', WORKSPACE_ID, 'intakes'))
  );

  console.log('\nADM Depósito modular security test: PASS');
  console.log('- fundador pode ler somente os domínios operacionais liberados');
  console.log('- alertas, inventários e withdrawals continuam estacionados');
  console.log('- gravações arbitrárias continuam negadas pelos contratos');
  console.log('- acesso externo permanece negado');
  console.log('- exclusão lógica retira NF da fila sem criar consumo ou movimento de estoque');
  console.log('- consumo imediato histórico continua protegido para compatibilidade');
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
