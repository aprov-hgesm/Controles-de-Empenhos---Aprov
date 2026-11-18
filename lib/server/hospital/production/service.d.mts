import type {HospitalScope} from '../../../../features/hospital/core/contracts';
import type {KitchenProductionContract} from '../../../../features/hospital/production/contracts';
import type {HospitalQAStore} from '../core/qa-store.mjs';
export declare class ProductionService implements KitchenProductionContract {
  constructor(store:HospitalQAStore);
  snapshot:KitchenProductionContract['snapshot'];
  createBatch:KitchenProductionContract['createBatch'];
  startBatch:KitchenProductionContract['startBatch'];
  completeBatch:KitchenProductionContract['completeBatch'];
  acknowledgeBatch:KitchenProductionContract['acknowledgeBatch'];
  reconcileBatch:KitchenProductionContract['reconcileBatch'];
  cancelBatch:KitchenProductionContract['cancelBatch'];
  flagAffected:KitchenProductionContract['flagAffected'];
}
