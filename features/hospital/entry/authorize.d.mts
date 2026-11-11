import type { HospitalRole } from '../core/contracts';
export declare function authorizeHospitalEntry(args: {
  authorization: string;
  organizationId: string;
  store: {
    findMembership(organizationId: string, uid: string): unknown;
    findOrganization(organizationId: string): unknown;
  };
  /** Injectable only by trusted server-side tests. Never supplied from HTTP/client. */
  verifyToken?: (token: string) => Promise<{ uid: string }>;
}): Promise<{
  readonly roles: readonly HospitalRole[];
  readonly unitCount: number;
  readonly canOpenClinicalWorkspace: boolean;
}>;
