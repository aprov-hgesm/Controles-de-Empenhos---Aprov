/**
 * Compatibilidade do Central de Depósitos.
 *
 * A política de acesso pertence à camada neutra de plataforma para impedir que
 * o shell operacional dependa da implementação warehouse.
 */
export {
  warehouseModuleEnabled,
  canAccessWarehouseModule,
} from '../platformModuleAccess';
