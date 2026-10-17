/** Occupancy illustration only: marker count is NOT the quantity of units. */
export type WarehousePalletCargoSlot = {
  column: number;
  tier: number;
  x: number;
  y: number;
  width: number;
  depth: number;
  bottomZ: number;
  topZ: number;
};
export function layoutWarehousePalletCargo(markers: number): WarehousePalletCargoSlot[] {
  const count = Number.isFinite(markers) ? Math.max(0, Math.min(4, Math.floor(markers))) : 0;
  const tierHeight = 24;
  return Array.from({ length: count }, (_, index) => {
    const column = index % 2;
    const tier = Math.floor(index / 2);
    return {
      column, tier,
      x: count === 1 ? 0.325 : column === 0 ? 0.115 : 0.535,
      y: 0.16, width: 0.35, depth: 0.68,
      bottomZ: tier * tierHeight,
      topZ: (tier + 1) * tierHeight,
    };
  });
}
