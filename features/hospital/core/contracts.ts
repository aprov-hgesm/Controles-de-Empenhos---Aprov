/** EMPROVEX Hospital R1 — contratos estáveis; uso exclusivamente com autorização no servidor. */
export const HOSPITAL_CONTRACT_VERSION = 'hospital.r1' as const;
export type HospitalRole = 'UNIT' | 'KITCHEN' | 'NUTRITION' | 'HOSPITAL_ADMIN';
export type HospitalPermission = 'hospital:manage' | 'membership:manage' | 'patient:read' | 'patient:write' | 'admission:read' | 'admission:write' | 'map:read' | 'map:write' | 'meal:read' | 'meal:write' | 'meal:production' | 'meal:distribution' | 'nutrition:read' | 'nutrition:write' | 'audit:read' | 'incident:write';
export type HospitalErrorCode = 'UNAUTHORIZED' | 'FORBIDDEN' | 'INVALID' | 'CONFLICT' | 'NOT_FOUND' | 'PRECONDITION' | 'UNAVAILABLE';
export type CycleId = '06' | '10' | '16';
export type MealType = 'PRIMARY' | 'SECONDARY';
export type MapStatus = 'DRAFT' | 'SUBMITTED' | 'CLOSED';
export type MealStatus = 'REQUESTED' | 'PREPARING' | 'READY' | 'DISPATCHED' | 'RECEIVED_BY_UNIT' | 'DELIVERED' | 'SUSPENDED' | 'CANCELLED' | 'SAFETY_BLOCKED';
export type LocationStatus = 'PLANNED' | 'CONFIRMED' | 'CANCELLED';
export type NutritionAuditStatus = 'IDENTIFIED' | 'CONTACTED' | 'FOLLOW_UP' | 'CLOSED';
export interface HospitalScope { readonly uid: string; readonly organizationId: string; readonly ug: string; readonly membershipId: string; readonly unitIds: readonly string[]; readonly roles: readonly HospitalRole[]; readonly active: true; }
export interface HospitalOrganization { id: string; ug: string; name: string; timezone: 'America/Sao_Paulo'; active: boolean; }
export interface HospitalUnit { id: string; organizationId: string; code: string; name: string; type: 'CARE' | 'KITCHEN' | 'NUTRITION'; active: boolean; }
export interface HospitalMembership { id: string; organizationId: string; ug: string; uid: string; unitIds: string[]; roles: HospitalRole[]; active: boolean; }
export interface Bed { id: string; organizationId: string; unitId: string; label: string; active: boolean; }
export interface Patient { id: string; organizationId: string; referenceCode: string; displayName?: string; birthDate?:string|null; createdAt: string; }
export interface Admission { id: string; organizationId: string; patientId: string; unitId: string; bedId: string | null; status: 'ACTIVE' | 'DISCHARGED'; fasting: boolean; allergyCodes: string[]; revision: number; }
export interface PatientLocationEvent { id: string; admissionId: string; organizationId: string; fromUnitId: string; toUnitId: string; status: LocationStatus; effectiveAt: string | null; recordedAt: string; actorUid: string; }
export interface MedicalDietReference { id: string; admissionId: string; organizationId: string; sourceRef: string; prescribedAt: string; enteredByUid: string; catalogItemId: string; validUntil?: string; }
export interface DietCatalogItem { id: string; organizationId: string; code: string; label: string; restrictionCodes: string[]; active: boolean; }
export interface AllergyRestriction { code: string; severity: 'CRITICAL' | 'OTHER'; note?: string; }
export interface MealCycleConfig { id: CycleId; timezone: 'America/Sao_Paulo'; mapDue: string; primaryTolerance: string; primaryName: string; secondaryName: string; }
export interface DietMap { id: string; organizationId: string; unitId: string; localDate: string; cycleId: CycleId; status: MapStatus; revision: number; createdAt: string; submittedAt: string | null; closedAt: string | null; }
export interface DietMapVersion { mapId: string; version: number; kind: 'SUBMISSION' | 'CLOSE' | 'AMENDMENT'; snapshot: unknown; reason: string | null; actorUid: string; recordedAt: string; }
export interface MealRequest { id: string; organizationId: string; unitId: string; mapId: string; admissionId: string; localDate: string; cycleId: CycleId; mealType: MealType; dietCode: string; medicalReferenceId: string; status: MealStatus; revision: number; requestedAt: string; effectiveAt: string | null; advisory: string; }
export interface ProductionBatch { id: string; organizationId: string; cycleId: CycleId; localDate: string; mealIds: string[]; status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE'; }
export interface MealLabel { id: string; mealId: string; destinationUnitId: string; destinationBed: string | null; dietCode: string; restrictionCodes: string[]; printedAt: string; }
export interface DeliveryEvent { id: string; mealId: string; type: 'DISPATCHED' | 'RECEIVED_BY_UNIT' | 'DELIVERED'; actorUid: string; occurredAt: string; effectiveAt: string | null; }
export interface Incident { id: string; organizationId: string; unitId: string; admissionId: string | null; type: string; note: string; status: 'OPEN' | 'RESOLVED'; createdAt: string; }
export interface AuditEvent { id: number; organizationId: string; aggregateKind: string; aggregateId: string; eventType: string; actorUid: string; occurredAt: string; effectiveAt: string | null; payload: unknown; }
export interface NutritionAudit { id: string; organizationId: string; unitId: string; admissionId: string; status: NutritionAuditStatus; observation: string; actorUid: string; createdAt: string; }
export interface MedicalReviewRequest { id: string; organizationId: string; nutritionAuditId: string; sourceRef: string; status: 'REQUESTED' | 'ANSWERED' | 'CLOSED'; createdAt: string; }
export interface HospitalCommandMeta { idempotencyKey: string; expectedRevision?: number; effectiveAt?: string | null; }
export interface HospitalErrorDTO { ok: false; error: { code: HospitalErrorCode; message: string }; }
export interface HospitalSuccessDTO<T> { ok: true; data: T; }
export type HospitalResult<T> = HospitalSuccessDTO<T> | HospitalErrorDTO;
