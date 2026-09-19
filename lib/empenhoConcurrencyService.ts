import { runTransaction } from 'firebase/firestore';

import {
  assertEmpenhoRevision,
  buildNextEmpenho,
  EmpenhoConcurrencyError,
  isEmpenhoConcurrencyError,
} from './empenhoConcurrency';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  getCurrentOperationalScope,
  getOperationalDocumentPath,
  operationalDocRef,
} from './operationalPaths';
import type { Empenho } from './types';

export async function commitEmpenhoCreate(
  userId: string,
  empenho: Empenho
): Promise<Empenho> {
  const scope = getCurrentOperationalScope(userId);
  const path = getOperationalDocumentPath(scope, 'empenhos', empenho.id);
  const ref = operationalDocRef(scope, 'empenhos', empenho.id);

  try {
    return await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists()) {
        throw new EmpenhoConcurrencyError(
          'create_conflict',
          `O empenho ${empenho.id} já foi criado por outra sessão. Atualize a tela antes de continuar.`
        );
      }

      const next = buildNextEmpenho(empenho, null, userId);
      transaction.set(ref, { ...next, userId });
      return next;
    });
  } catch (error) {
    if (isEmpenhoConcurrencyError(error)) throw error;
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function commitEmpenhoUpdate(
  userId: string,
  empenho: Empenho
): Promise<Empenho> {
  const scope = getCurrentOperationalScope(userId);
  const path = getOperationalDocumentPath(scope, 'empenhos', empenho.id);
  const ref = operationalDocRef(scope, 'empenhos', empenho.id);

  try {
    return await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) {
        throw new EmpenhoConcurrencyError(
          'missing_empenho',
          `O empenho ${empenho.id} não existe mais. Atualize a tela antes de continuar.`
        );
      }

      const stored = snapshot.data() as Empenho;
      assertEmpenhoRevision(stored, empenho.revision);

      const next = buildNextEmpenho(empenho, stored, userId);
      transaction.set(ref, { ...next, userId });
      return next;
    });
  } catch (error) {
    if (isEmpenhoConcurrencyError(error)) throw error;
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}
