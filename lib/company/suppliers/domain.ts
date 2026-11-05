/** EMPROVEX Empresas W2 — domain-only records; never import sector supplier or warehouse models. */
import type { CompanyOwnedRecord, CompanyUnit, CompanyUnitConversion, CompanyMoney } from '../contracts';

export type SupplierLifecycle = 'active' | 'suspended' | 'inactive';
export type SupplierChannel = 'email' | 'phone' | 'whatsapp' | 'website' | 'portal';
export interface SupplierContact { name: string; role: string; email: string; phone: string; preferredChannel: SupplierChannel }
export interface SourceSupplierInput {
  legalName: string; tradeName: string; cnpj: string | null; contacts: SupplierContact[];
  channels: SupplierChannel[]; commercialTerms: string; estimatedLeadTimeDays: number | null;
  lifecycle: SupplierLifecycle;
}
export interface SourceSupplier extends CompanyOwnedRecord, SourceSupplierInput {
  status: 'active' | 'suspended' | 'archived';
  normalizedName: string;
}
export interface SupplierPrice {
  /** Quoted price for ONE purchaseUnit in integer BRL cents, never current market price. */
  amountCents: number; currency: 'BRL'; quotedAt: string;
  validFrom: string | null; validUntil: string | null;
  basis: 'quotation' | 'negotiated';
}
export interface SupplierSourceOption {
  sourceSupplierId: string; supplierSku: string; packageLabel: string;
  purchaseUnit: CompanyUnit; conversion: CompanyUnitConversion;
  estimatedLeadTimeDays: number | null; channel: SupplierChannel;
  priceHistory: SupplierPrice[];
}
export interface CatalogItemInput {
  sku: string; title: string; description: string; canonicalUnit: CompanyUnit;
  sourcingOptions: SupplierSourceOption[];
}
export interface CatalogItem extends CompanyOwnedRecord, CatalogItemInput {
  status: 'active' | 'archived';
}
export class SupplierValidationError extends Error {
  constructor(public readonly code: string, message = code) { super(message); this.name = 'SupplierValidationError'; }
}
const units = new Set<CompanyUnit>(['UN','KG','G','L','ML','CX','FD','M']);
const channels = new Set<SupplierChannel>(['email','phone','whatsapp','website','portal']);
const body = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SupplierValidationError('INVALID_BODY');
  return value as Record<string, unknown>;
};
const str = (value: unknown, field: string, max: number, optional = false): string => {
  if (optional && (value === undefined || value === null)) return '';
  if (typeof value !== 'string') throw new SupplierValidationError('INVALID_'+field);
  const result = value.trim();
  if ((!optional && !result) || result.length > max || /[\u0000-\u001f\u007f]/.test(result)) throw new SupplierValidationError('INVALID_'+field);
  return result;
};
const digits = (value: string) => value.replace(/\D/g, '');
export function isValidCnpj(value: string): boolean {
  const n = digits(value);
  if (!/^\d{14}$/.test(n) || /^(\d)\1+$/.test(n)) return false;
  for (let index = 12; index < 14; index += 1) {
    let weight = index === 12 ? 5 : 6;
    let sum = 0;
    for (let i = 0; i < index; i += 1) { sum += Number(n[i]) * weight; weight = weight === 2 ? 9 : weight - 1; }
    const mod = sum % 11;
    if (Number(n[index]) !== (mod < 2 ? 0 : 11 - mod)) return false;
  }
  return true;
}
export function normalizedSupplierName(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim();
}
const channel = (value: unknown): SupplierChannel => {
  if (typeof value !== 'string' || !channels.has(value as SupplierChannel)) throw new SupplierValidationError('INVALID_CHANNEL');
  return value as SupplierChannel;
};
const unit = (value: unknown): CompanyUnit => {
  if (typeof value !== 'string' || !units.has(value as CompanyUnit)) throw new SupplierValidationError('INVALID_UNIT');
  return value as CompanyUnit;
};
const leadTime = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 3650) throw new SupplierValidationError('INVALID_LEAD_TIME');
  return value as number;
};
const unique = <T>(items: T[], key: (item: T) => string): T[] => {
  if (new Set(items.map(key)).size !== items.length) throw new SupplierValidationError('DUPLICATE_ENTRY');
  return items;
};
export function parseSourceSupplier(value: unknown): SourceSupplierInput {
  const v = body(value);
  const legalName = str(v.legalName, 'LEGAL_NAME', 180);
  const rawCnpj = v.cnpj === null || v.cnpj === '' || v.cnpj === undefined ? null : str(v.cnpj, 'CNPJ', 24);
  if (rawCnpj && !isValidCnpj(rawCnpj)) throw new SupplierValidationError('INVALID_CNPJ');
  if (!Array.isArray(v.contacts) || v.contacts.length > 12) throw new SupplierValidationError('INVALID_CONTACTS');
  const contacts = v.contacts.map((raw) => {
    const c = body(raw);
    const email = str(c.email, 'CONTACT_EMAIL', 254, true).toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new SupplierValidationError('INVALID_CONTACT_EMAIL');
    const phone = str(c.phone, 'CONTACT_PHONE', 30, true);
    if (!email && !phone) throw new SupplierValidationError('CONTACT_REQUIRES_CHANNEL');
    return { name: str(c.name, 'CONTACT_NAME', 120), role: str(c.role, 'CONTACT_ROLE', 80, true), email, phone, preferredChannel: channel(c.preferredChannel) };
  });
  if (!Array.isArray(v.channels) || v.channels.length > 5) throw new SupplierValidationError('INVALID_CHANNELS');
  const supplierChannels = unique(v.channels.map(channel), c => c);
  const lifecycle = v.lifecycle === undefined ? 'active' : v.lifecycle;
  if (!['active', 'suspended', 'inactive'].includes(String(lifecycle))) throw new SupplierValidationError('INVALID_STATUS');
  return {
    legalName,
    tradeName: str(v.tradeName, 'TRADE_NAME', 180, true),
    cnpj: rawCnpj ? digits(rawCnpj) : null,
    contacts,
    channels: supplierChannels,
    commercialTerms: str(v.commercialTerms, 'TERMS', 2000, true),
    estimatedLeadTimeDays: leadTime(v.estimatedLeadTimeDays),
    lifecycle: lifecycle as SupplierLifecycle,
  };
}
export function supplierRecordStatus(lifecycle: SupplierLifecycle): SourceSupplier['status'] {
  return lifecycle === 'inactive' ? 'archived' : lifecycle;
}
export function assertSupplierSelectable(supplier: Pick<SourceSupplier, 'status' | 'lifecycle'>): void {
  if (supplier.status !== 'active' || supplier.lifecycle !== 'active') throw new SupplierValidationError('SUPPLIER_NOT_SELECTABLE');
}
export function normalizedSku(value: string): string {
  const sku = value.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._-]{1,63}$/.test(sku)) throw new SupplierValidationError('INVALID_SKU');
  return sku;
}
const isoDay = (value: unknown, nullable = false): string | null => {
  if (nullable && (value === null || value === undefined || value === '')) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value + 'T00:00:00Z')) || new Date(value + 'T00:00:00Z').toISOString().slice(0,10) !== value) throw new SupplierValidationError('INVALID_PRICE_DATE');
  return value;
};
export function parseCatalogItem(value: unknown): CatalogItemInput {
  const v = body(value);
  if (!Array.isArray(v.sourcingOptions) || v.sourcingOptions.length > 30) throw new SupplierValidationError('INVALID_SOURCE_OPTIONS');
  const canonicalUnit = unit(v.canonicalUnit);
  const sourcingOptions = unique(v.sourcingOptions.map((raw) => {
    const o = body(raw);
    const conversion = body(o.conversion);
    const purchaseUnit = unit(o.purchaseUnit);
    if (conversion.from !== purchaseUnit || conversion.to !== canonicalUnit || !Number.isSafeInteger(conversion.numerator) || !Number.isSafeInteger(conversion.denominator) || Number(conversion.numerator) <= 0 || Number(conversion.denominator) <= 0 || Number(conversion.numerator) > 1000000000 || Number(conversion.denominator) > 1000000000) throw new SupplierValidationError('INVALID_CONVERSION');
    if (!Array.isArray(o.priceHistory) || o.priceHistory.length > 50) throw new SupplierValidationError('INVALID_PRICE_HISTORY');
    const priceHistory = o.priceHistory.map((rawPrice): SupplierPrice => {
      const p = body(rawPrice);
      if (!Number.isSafeInteger(p.amountCents) || Number(p.amountCents) < 0 || p.currency !== 'BRL' || !['quotation','negotiated'].includes(String(p.basis))) throw new SupplierValidationError('INVALID_PRICE');
      const quotedAt = isoDay(p.quotedAt)!;
      const validFrom = isoDay(p.validFrom, true);
      const validUntil = isoDay(p.validUntil, true);
      if (validFrom && validUntil && validUntil < validFrom) throw new SupplierValidationError('INVALID_PRICE_PERIOD');
      return { amountCents: p.amountCents as number, currency: 'BRL', quotedAt, validFrom, validUntil, basis: p.basis as SupplierPrice['basis'] };
    });
    return {
      sourceSupplierId: str(o.sourceSupplierId,'SOURCE_SUPPLIER_ID',128),
      supplierSku: str(o.supplierSku,'SUPPLIER_SKU',80,true),
      packageLabel: str(o.packageLabel,'PACKAGE_LABEL',120,true),
      purchaseUnit,
      conversion: { from: purchaseUnit, to: canonicalUnit, numerator: conversion.numerator as number, denominator: conversion.denominator as number },
      estimatedLeadTimeDays: leadTime(o.estimatedLeadTimeDays),
      channel: channel(o.channel),
      priceHistory,
    };
  }), o => o.sourceSupplierId + ':' + o.supplierSku);
  return { sku: normalizedSku(str(v.sku,'SKU',64)), title: str(v.title,'TITLE',180), description: str(v.description,'DESCRIPTION',2000,true), canonicalUnit, sourcingOptions };
}
/** Exacts only: repeating fractions fail rather than round inventory / purchase quantities. */
export function convertQuantityExact(decimal: string, conversion: CompanyUnitConversion): string {
  if (!/^(0|[1-9]\d{0,14})(\.\d{1,9})?$/.test(decimal)) throw new SupplierValidationError('INVALID_QUANTITY');
  if (!units.has(conversion.from) || !units.has(conversion.to) || !Number.isSafeInteger(conversion.numerator) || !Number.isSafeInteger(conversion.denominator) || conversion.numerator <= 0 || conversion.denominator <= 0) throw new SupplierValidationError('INVALID_CONVERSION');
  const [integer, fraction = ''] = decimal.split('.');
  let numerator = BigInt(integer + fraction) * BigInt(conversion.numerator);
  let denominator = 10n ** BigInt(fraction.length) * BigInt(conversion.denominator);
  const gcd = (a: bigint, b: bigint): bigint => b === 0n ? a : gcd(b, a % b);
  const divisor = gcd(numerator, denominator);
  numerator /= divisor; denominator /= divisor;
  let decimalPlaces = 0;
  let remaining = denominator;
  while (remaining % 2n === 0n) { remaining /= 2n; decimalPlaces += 1; }
  let fivePlaces = 0;
  while (remaining % 5n === 0n) { remaining /= 5n; fivePlaces += 1; }
  if (remaining !== 1n) throw new SupplierValidationError('INEXACT_CONVERSION');
  const scale = Math.max(decimalPlaces, fivePlaces);
  if (scale > 9) throw new SupplierValidationError('INEXACT_CONVERSION');
  const scaled = numerator * 10n ** BigInt(scale) / denominator;
  const digitsValue = scaled.toString().padStart(scale + 1, '0');
  if (scale === 0) return digitsValue;
  return (digitsValue.slice(0,-scale) + '.' + digitsValue.slice(-scale).replace(/0+$/, '')).replace(/\.$/, '');
}
export interface SourceSupplierSelection { supplierId: string; catalogItemId: string; supplierSku: string; purchaseUnit: CompanyUnit; conversion: CompanyUnitConversion; /** Historical reference only, never a live or binding quote. */ historicalReferencePrice: (CompanyMoney & { quotedAt: string }) | null }
/** For W6: reread supplier from server and assert active at the transaction boundary. */
export function purchaseSelectionContract(item: CatalogItem, supplier: SourceSupplier, supplierSku: string): SourceSupplierSelection {
  if (item.companyId !== supplier.companyId || item.workspaceId !== supplier.workspaceId || item.status !== 'active') throw new SupplierValidationError('SUPPLIER_SCOPE_INVALID');
  assertSupplierSelectable(supplier);
  const option = item.sourcingOptions.find(o => o.sourceSupplierId === supplier.id && o.supplierSku === supplierSku);
  if (!option) throw new SupplierValidationError('SOURCE_OPTION_NOT_FOUND');
  const latest = [...option.priceHistory].sort((a,b) => b.quotedAt.localeCompare(a.quotedAt))[0];
  return { supplierId: supplier.id, catalogItemId: item.id, supplierSku, purchaseUnit: option.purchaseUnit, conversion: option.conversion, historicalReferencePrice: latest ? { amountCents: latest.amountCents, currency: 'BRL', quotedAt: latest.quotedAt } : null };
}
