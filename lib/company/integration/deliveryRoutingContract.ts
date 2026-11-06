import type { CompanyQuantity } from '../contracts';

/** W10 frozen handoff interface between W9 deliveries and W11 routing.
 * No coordinates, ETA, distances or allocations are invented by this contract.
 * Route proposals are NOT dispatched deliveries.
 */
export interface DeliveryCandidate {
  companyId: string;
  workspaceId: string;
  deliveryId: string;
  customerOrderId: string;
  customerOrderLineId: string;
  destination: { address: string; confirmed: boolean;
    latitude?: number; longitude?: number; coordinateSource?: string };
  receptionWindow?: { start: string; end: string };
  unloadMinutes?: number;
  quantity: CompanyQuantity;
  weightKg?: number;
  volumeM3?: number;
}
export interface ProposedStop {
  candidateDeliveryId: string;
  sequence: number;
  estimatedArrival?: string;
  estimatedTravelMinutes?: number;
  estimatedDistanceMeters?: number;
}
export interface RouteProposal {
  companyId: string;
  workspaceId: string;
  source: 'manual' | 'osrm-vroom' | 'operator';
  status: 'draft' | 'optimizedSuggestion';
  proposedVehicleId?: string;
  stops: readonly ProposedStop[];
  unassigned: readonly {candidateDeliveryId: string;reason: string}[];
  calculatedAt?: string;
  provider?: string;
  /** Human approval cannot be inferred from proposal creation or external map navigation. */
  requiresHumanApproval: true;
}
export function proposalNeedsReview(candidateIds: readonly string[], proposal: RouteProposal): boolean {
  const assigned = new Set(proposal.stops.map(stop=>stop.candidateDeliveryId));
  const unassigned = new Set(proposal.unassigned.map(stop=>stop.candidateDeliveryId));
  if (proposal.status !== 'draft' && proposal.status !== 'optimizedSuggestion') return true;
  if (new Set(proposal.stops.map(stop=>stop.sequence)).size !== proposal.stops.length) return true;
  return candidateIds.some(id=>!assigned.has(id)&&!unassigned.has(id));
}
