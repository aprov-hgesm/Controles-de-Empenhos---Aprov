/**
 * Projeções somente leitura para o Almoxarifado.
 * Dados financeiros são originados de empenhos já autorizados ao workspace;
 * saldos físicos pertencem EXCLUSIVAMENTE ao Warehouse.
 */
import type { Empenho, SupplierContact, SupplierDirectoryEntry } from '../../../lib/types';
import { normalizeSupplierCnpj } from '../../../lib/invoiceIdentity';
import type { WarehouseMaterial, WarehouseMaterialUnit } from '../../../lib/warehouse/material';
import { warehouseMaterialUnitKey } from '../../../lib/warehouse/material';
import type { WarehouseDepot, WarehouseLocation, WarehouseLocationBalance } from '../../../lib/warehouse/location';
import { findWarehouseMaterialsAcrossDepots, type GlobalMaterialPosition } from '../../../lib/warehouse/globalMaterialSearch';

export type AlmoxLinkStatus = 'CONFIRMED' | 'NO_LINK' | 'MISSING' | 'INACTIVE' | 'INCOMPATIBLE_UNIT';
export interface AlmoxItemRow {
  key: string;
  empenhoId: string;
  empenhoStatus: Empenho['status'];
  itemId: string;
  name: string;
  unit: string;
  supplierKey: string;
  supplierName: string;
  quantity: number;
  received: number;
  balance: number;
  unitPrice: number;
  balanceValue: number;
  materialId: string | null;
  linkStatus: AlmoxLinkStatus;
  /** Não converte saldo do empenho em saldo físico. */
  baseUnitFactor: number | null;
}
export interface AlmoxSupplierRow {
  key: string;
  name: string;
  cnpj: string;
  email: string;
  phone: string;
  whatsapp: string;
  aliases: string[];
  empenhoIds: string[];
  activeEmpenhoIds: string[];
  suppliedItemKeys: string[];
  financialBalance: number;
}
export interface AlmoxMaterialRow {
  materialId: string;
  description: string;
  aliases: string[];
  unit: string;
  status: WarehouseMaterial['status'];
  physicalQuantity: number;
  positions: GlobalMaterialPosition[];
  /** TRUE somente para vínculos explícitos e validados. */
  financialItemKeys: string[];
}
export interface AlmoxCatalogInput {
  workspaceId: string;
  ug: string;
  empenhos: readonly Empenho[];
  contacts: readonly SupplierContact[];
  directory: readonly SupplierDirectoryEntry[];
  materials: readonly WarehouseMaterial[];
  depots: readonly WarehouseDepot[];
  locations: readonly WarehouseLocation[];
  balances: readonly WarehouseLocationBalance[];
  /** Limites atingidos: contagens físicas não devem ser interpretadas como completas. */
  coverageComplete: boolean;
}
export interface AlmoxCatalogProjection {
  suppliers: AlmoxSupplierRow[];
  items: AlmoxItemRow[];
  materials: AlmoxMaterialRow[];
  coverageComplete: boolean;
}

const unitAliases: Record<string, WarehouseMaterialUnit['code']> = {
  un: 'unit', und: 'unit', unid: 'unit', unidade: 'unit', unidades: 'unit',
  kg: 'kg', quilograma: 'kg', quilogramas: 'kg',
  g: 'g', grama: 'g', gramas: 'g',
  l: 'l', litro: 'l', litros: 'l',
  ml: 'ml', mililitro: 'ml', mililitros: 'ml',
  pct: 'package', pacote: 'package', pacotes: 'package',
  cx: 'box', caixa: 'box', caixas: 'box',
  fardo: 'bundle', fardos: 'bundle',
};
function normalizeName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}
function safeQuantity(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}
function unitFromItem(label: string): WarehouseMaterialUnit | null {
  const normalized = normalizeName(label);
  if (!normalized) return null;
  const code = unitAliases[normalized];
  // Apresentações compostas (ex.: "caixa com 12") nunca são inferidas.
  return code ? { code, label: null } : null;
}
export function factorForFinancialItem(unit: string, material: WarehouseMaterial): number | null {
  const parsed = unitFromItem(unit);
  if (!parsed) {
    // Para unidade customizada exige coincidência textual EXATA com apresentação cadastrada.
    const key = normalizeName(unit);
    if (material.unit.code === 'other' && normalizeName(material.unit.label || '') === key) return 1;
    const explicit = material.conversions.filter((c) =>
      c.presentation.code === 'other' && normalizeName(c.presentation.label || '') === key);
    return explicit.length === 1 && Number.isFinite(explicit[0].factorToBaseUnit)
      && explicit[0].factorToBaseUnit > 0 ? explicit[0].factorToBaseUnit : null;
  }
  const baseKey = warehouseMaterialUnitKey(parsed);
  if (baseKey === warehouseMaterialUnitKey(material.unit)) return 1;
  const conversions = material.conversions.filter((c) =>
    warehouseMaterialUnitKey(c.presentation) === baseKey
    && Number.isFinite(c.factorToBaseUnit) && c.factorToBaseUnit > 0);
  return conversions.length === 1 ? conversions[0].factorToBaseUnit : null;
}
function ensureScoped(input: AlmoxCatalogInput): void {
  if (!input.workspaceId || !/^\d{6}$/.test(input.ug)) {
    throw new Error('ALMOX_W7_INVALID_SCOPE');
  }
  for (const entity of [...input.materials, ...input.depots, ...input.locations, ...input.balances]) {
    if (entity.workspaceId !== input.workspaceId || entity.ug !== input.ug) {
      throw new Error('ALMOX_W7_CROSS_WORKSPACE_DATA');
    }
  }
}
function supplierIdentity(name: string, cnpjRaw: string | undefined): string {
  const cnpj = normalizeSupplierCnpj(cnpjRaw);
  return cnpj ? 'cnpj:' + cnpj : 'name:' + normalizeName(name || 'Fornecedor não identificado');
}
/** Nenhum lookup textual produz vínculo logístico. */
export function buildAlmoxCatalog(input: AlmoxCatalogInput): AlmoxCatalogProjection {
  ensureScoped(input);
  const materials = new Map(input.materials.map((material) => [material.id, material]));
  const contactsByCnpj = new Map(input.contacts.map((c) => [normalizeSupplierCnpj(c.cnpj), c]));
  const directoryByCnpj = new Map(input.directory.map((d) => [normalizeSupplierCnpj(d.cnpj), d.email]));
  const contactsByName = new Map<string, SupplierContact[]>();
  for (const contact of input.contacts) {
    const key = normalizeName(contact.legalName);
    contactsByName.set(key, [...(contactsByName.get(key) || []), contact]);
  }
  const supplierMap = new Map<string, AlmoxSupplierRow>();
  function register(key: string, name: string, cnpj: string): AlmoxSupplierRow {
    let row = supplierMap.get(key);
    if (!row) {
      const contact = cnpj ? contactsByCnpj.get(cnpj) : undefined;
      row = {
        key, name: contact?.legalName || name || 'Fornecedor não identificado',
        cnpj, email: contact?.email || directoryByCnpj.get(cnpj) || '',
        phone: contact?.phone || '', whatsapp: contact?.whatsapp || '',
        aliases: [], empenhoIds: [], activeEmpenhoIds: [],
        suppliedItemKeys: [], financialBalance: 0,
      };
      supplierMap.set(key, row);
    }
    if (name && !row.aliases.includes(name)) row.aliases.push(name);
    return row;
  }
  // Contatos sem empenho também pertencem ao diretório local.
  for (const contact of input.contacts) {
    const cnpj = normalizeSupplierCnpj(contact.cnpj);
    register(supplierIdentity(contact.legalName, cnpj), contact.legalName, cnpj);
  }

  const items: AlmoxItemRow[] = [];
  for (const empenho of input.empenhos) {
    const cnpj = normalizeSupplierCnpj(empenho.supplierCnpj);
    const name = empenho.supplier?.trim() || 'Fornecedor não identificado';
    const candidates = cnpj ? [] : contactsByName.get(normalizeName(name)) || [];
    // Nome sem CNPJ só corresponde ao contato caso exista UM candidato não ambíguo.
    const impliedCnpj = candidates.length === 1 ? normalizeSupplierCnpj(candidates[0].cnpj) : '';
    const supplierCnpj = cnpj || impliedCnpj;
    const key = supplierIdentity(name, supplierCnpj);
    const supplier = register(key, name, supplierCnpj);
    if (!supplier.empenhoIds.includes(empenho.id)) supplier.empenhoIds.push(empenho.id);
    if ((empenho.status === 'Ativo' || empenho.status === 'Urgente')
      && !supplier.activeEmpenhoIds.includes(empenho.id)) {
      supplier.activeEmpenhoIds.push(empenho.id);
    }
    for (const item of empenho.items || []) {
      const materialId = item.warehouseMaterialId || null;
      const material = materialId ? materials.get(materialId) : undefined;
      const factor = material?.status === 'active'
        ? factorForFinancialItem(item.unit, material) : null;
      const linkStatus: AlmoxLinkStatus = !materialId ? 'NO_LINK'
        : !material ? 'MISSING'
        : material.status !== 'active' ? 'INACTIVE'
        : factor === null ? 'INCOMPATIBLE_UNIT' : 'CONFIRMED';
      const quantity = safeQuantity(item.quantity);
      const received = safeQuantity(item.received);
      const balance = Math.max(0, quantity - received);
      const unitPrice = safeQuantity(item.unitPrice);
      const financialKey = empenho.id + '::' + item.id;
      supplier.suppliedItemKeys.push(financialKey);
      supplier.financialBalance += balance * unitPrice;
      items.push({
        key: financialKey, empenhoId: empenho.id, empenhoStatus: empenho.status,
        itemId: item.id, name: item.name, unit: item.unit,
        supplierKey: key, supplierName: supplier.name,
        quantity, received, balance, unitPrice, balanceValue: balance * unitPrice,
        materialId, linkStatus, baseUnitFactor: factor,
      });
    }
  }
  // Não transferir estoque nem inferir vínculo por descrição semelhante.
  const materialRows = input.materials.map((material) => {
    const result = findWarehouseMaterialsAcrossDepots({
      query: material.id, depots: [...input.depots], locations: [...input.locations],
      balances: [...input.balances], materials: [...input.materials], maxMaterials: 10,
    }).find((match) => match.materialId === material.id);
    const positions = material.status === 'active' ? result?.positions || [] : [];
    return {
      materialId: material.id, description: material.description, aliases: material.aliases,
      unit: material.unit.label || material.unit.code.toUpperCase(),
      status: material.status,
      positions,
      physicalQuantity: positions.reduce((sum, position) => sum + position.quantity, 0),
      financialItemKeys: items.filter((item) =>
        item.materialId === material.id && item.linkStatus === 'CONFIRMED').map((item) => item.key),
    };
  }).sort((a, b) => a.description.localeCompare(b.description, 'pt-BR'));
  return {
    suppliers: [...supplierMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR')),
    items, materials: materialRows, coverageComplete: input.coverageComplete,
  };
}
