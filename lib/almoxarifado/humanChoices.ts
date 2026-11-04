import { validateWarehouseStockPosition, normalizeWarehouseLocationQuantity } from '../warehouse/location';
import type { PositionChoiceV1 } from './positionPlanner';

/** Only explicit human allocation choices cross the wire. Snapshots and correspondence do not. */
export function parseAlmoxHumanChoices(value: unknown): Record<string, PositionChoiceV1> {
  if (value === undefined || value === null) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('ALMOX_CHOICES_INVALID');
  const choices: Record<string, PositionChoiceV1> = Object.create(null);
  const entries = Object.entries(value);
  if (entries.length > 250) throw new Error('ALMOX_CHOICES_INVALID');
  for (const [id, raw] of entries) {
    if (!/^([a-z0-9_-]{1,70})$/i.test(id) || !raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('ALMOX_CHOICES_INVALID');
    }
    const item = raw as Record<string, unknown>;
    if (Object.keys(item).some(k => k !== 'allocations' && k !== 'allowPartial')
      || typeof item.allowPartial !== 'boolean'
      || !Array.isArray(item.allocations) || item.allocations.length > 16) {
      throw new Error('ALMOX_CHOICES_INVALID');
    }
    const allocations: PositionChoiceV1['allocations'][number][] = [];
    for (const rawAllocation of item.allocations) {
      if (!rawAllocation || typeof rawAllocation !== 'object' || Array.isArray(rawAllocation)) {
        throw new Error('ALMOX_CHOICES_INVALID');
      }
      const a = rawAllocation as Record<string, unknown>;
      const position = validateWarehouseStockPosition(a.position);
      const qty = normalizeWarehouseLocationQuantity(a.plannedBaseQuantity);
      if (Object.keys(a).some(k => !['position','balanceRevision','plannedBaseQuantity'].includes(k))
        || !position || position.kind === 'UNASSIGNED'
        || !Number.isSafeInteger(a.balanceRevision) || (a.balanceRevision as number) < 1
        || qty === null || qty <= 0) throw new Error('ALMOX_CHOICES_INVALID');
      allocations.push({position, balanceRevision:a.balanceRevision as number,plannedBaseQuantity:qty});
    }
    choices[id] = {allowPartial:item.allowPartial,allocations};
  }
  return choices;
}
