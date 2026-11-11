'use server';

import { HospitalQAStore } from '@/lib/server/hospital/core/qa-store.mjs';
import { authorizeHospitalEntry } from './authorize.mjs';

export type HospitalEntryDecision =
  | { status: 200; roles: string[]; unitCount: number; nextPath: string | null }
  | { status: 401 | 403 | 503; message: string };

/**
 * This action never provisions a clinical datastore or grants production access.
 * Until a separate, institutionally approved production adapter exists, access
 * is confined to a QA-only SQLite store and Firebase-verified identities.
 */
export async function checkHospitalEntry(idToken: string): Promise<HospitalEntryDecision> {
  const organizationId = process.env.HOSPITAL_QA_ORGANIZATION_ID?.trim();
  const filename = process.env.HOSPITAL_QA_SQLITE_PATH?.trim();
  if (process.env.NODE_ENV === 'production' || !organizationId || !filename) {
    return { status: 503, message: 'Acesso hospitalar ainda não habilitado para esta instalação.' };
  }
  if (typeof idToken !== 'string' || idToken.length < 20 || idToken.length > 16000) {
    return { status: 401, message: 'A identidade precisa ser autenticada novamente.' };
  }

  let store: HospitalQAStore | null = null;
  try {
    // W0 owns server Firebase Admin verification and its default-app bootstrap.
    // Fail closed until W0's Firebase Admin runtime dependency is installed
    // and initialized by the integration environment. Do not downgrade to
    // unrevoked/unverified client claims in this entry layer.
    store = new HospitalQAStore({ filename, qa: true });
    const access = await authorizeHospitalEntry({
      authorization: `Bearer ${idToken}`,
      organizationId,
      store,
    });
    return {
      status: 200,
      roles: [...access.roles],
      unitCount: access.unitCount,
      // W9 is the sole owner of the operational hospital route.
      // No redirect to a non-existent app before integration.
      nextPath: access.canOpenClinicalWorkspace && process.env.HOSPITAL_QA_APP_READY === '1'
        ? '/cozinha-dietetica/app'
        : null,
    };
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === 'UNAUTHORIZED') {
      return { status: 401, message: 'Identidade inválida ou sessão expirada.' };
    }
    if (code === 'FORBIDDEN') {
      return { status: 403, message: 'Acesso negado (403): sem vínculo hospitalar ativo ou unidade autorizada.' };
    }
    // Do not leak DB paths, credentials, membership details or clinical data.
    return { status: 503, message: 'Serviço hospitalar de QA indisponível. Tente novamente mais tarde.' };
  } finally {
    store?.close();
  }
}
