import {
  resolveHospitalScope,
  requireHospitalPermission,
} from '../../../lib/server/hospital/core/auth.mjs';

/**
 * W1 entry boundary. Only scopes minted by the W0 server verifier may enter.
 * The caller must supply its own server-owned organization ID and hospital store.
 * No hospital data or membership is obtained from user-controlled claims.
 */
export async function authorizeHospitalEntry({ authorization, organizationId, store, verifyToken }) {
  const scope = await resolveHospitalScope({
    authorization,
    organizationId,
    store,
    ...(verifyToken ? { verifyToken } : {}),
  });
  // A ordem dos papéis no cadastro não reduz o acesso clínico de um
  // profissional que também possua atribuições administrativas.
  const primaryRole = ['UNIT', 'KITCHEN', 'NUTRITION', 'HOSPITAL_ADMIN']
    .find(role => scope.roles.includes(role));
  const permissionByRole = {
    UNIT: 'map:read',
    KITCHEN: 'meal:read',
    NUTRITION: 'nutrition:read',
    HOSPITAL_ADMIN: 'hospital:manage',
  };
  const permission = permissionByRole[primaryRole];
  if (!permission) {
    // Defense in depth: W0 currently refuses unknown roles already.
    throw new Error('HOSPITAL_ENTRY_ROLE_UNAVAILABLE');
  }
  requireHospitalPermission(
    scope,
    permission,
    primaryRole === 'HOSPITAL_ADMIN' ? undefined : scope.unitIds[0]
  );
  return Object.freeze({
    roles: Object.freeze([...scope.roles]),
    unitCount: scope.unitIds.length,
    canOpenClinicalWorkspace: true, // W9: administrador hospitalar autenticado abre somente a área W7; APIs clínicas seguem protegidas.
  });
}
