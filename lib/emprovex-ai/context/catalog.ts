import type {Intent,W3Intent} from './types';
export type Family = {id:string;label:string;availability:'P0'|'P1'|'P2'};
export const FAMILIES:readonly Family[] = [
  ['commitments','Empenhos','P0'],['invoices','Notas fiscais','P0'],['processing','Tramitação','P1'],
  ['schedules','Cronogramas','P0'],['supplier_contacts','Contatos de fornecedores','P0'],
  ['stock','Estoque','P0'],['locations','Localização física','P0'],['expiry','Validades','P1'],
  ['alerts','Alertas','P1'],['movements','Movimentações','P1'],['receipts','Recebimentos','P1'],
  ['deliveries','Entregas previstas','P1'],['inventory','Inventário','P1'],['suppliers','Fornecedores','P0'],
  ['documents','Documentos','P1'],['indicators','Indicadores','P1'],['audit','Auditoria','P2'],
  ['item_lookup','Consulta de itens','P0'],['navigation','Navegação','P1'],
  ['procedures','Procedimentos','P1'],['siscofis','SISCOFIS','P2'],
  ['admin','Administração','P2'],['billing','Assinaturas','P2'],['settings','Configurações','P2'],
  ['cross_search','Pesquisas transversais','P1'],['future_ops','Operações futuras','P2']
].map(([id,label,availability])=>({id,label,availability:availability as Family['availability']}));
export const W3_CONTRACTS:Readonly<Record<W3Intent,string>> = {
  supplier_contact_find:'supplier.contact.find.v1',commitment_get:'commitment.get.v1',
  commitment_total_balance:'commitment.balance.v1',
  commitment_previous_open_list:'commitment.previousOpen.list.v1',
  schedule_sent_history_list:'schedule.sentHistory.list.v1',
  invoice_registration_period_list:'invoice.registrationPeriod.list.v1',
  warehouse_stock_get:'warehouse.stock.get.v1',
  warehouse_material_locations_list:'warehouse.materialLocations.list.v1'
};
export const FUTURE_CONTRACTS:Partial<Record<Intent,string>>={
  invoice_by_material_period:'invoice.materialPeriod.search.v1',
  invoice_issued_period:'invoice.issuedPeriod.list.v1',
  invoice_by_number:'invoice.number.find.v1',
  supplier_by_commitment:'supplier.byCommitment.find.v1',
  warehouse_by_location:'warehouse.location.materials.v1',
  delivery_late_list:'delivery.overdue.list.v1',
  validity_alerts:'warehouse.expiry.alerts.v1',
  warehouse_movement:'warehouse.movement.list.v1',
  inventory_status:'warehouse.inventory.status.v1'
};
export const ACCEPTED_INTENTS=Object.freeze(Object.keys(W3_CONTRACTS) as W3Intent[]);
