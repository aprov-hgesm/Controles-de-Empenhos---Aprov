/** Shared Consulta de Itens identity/search rules for UI and W3.
 * Item identity is name+unit; never merge unlike units or synonym guesses.
 */
export const normalizeConsultaItemName=(value:string):string=>
  value.trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');
export const normalizeConsultaItemSearch=(value:string):string=>
  normalizeConsultaItemName(value.normalize('NFD').replace(/[\u0300-\u036f]/g,''));
export const matchesConsultaItemSearch=(name:string,query:string):boolean=>
  normalizeConsultaItemSearch(name).includes(normalizeConsultaItemSearch(query));
