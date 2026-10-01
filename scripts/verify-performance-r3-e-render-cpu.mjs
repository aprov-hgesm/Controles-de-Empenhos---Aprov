import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const assert = (condition, message) => {
  if (!condition) {
    console.error(`PERF-E guard: FAIL — ${message}`);
    process.exit(1);
  }
};

const empenhos = read('features/empenhos/components/EmpenhosView.tsx');
const notas = read('features/notas-fiscais/components/NotasFiscaisView.tsx');
const itens = read('features/itens/components/ConsultaItensView.tsx');

assert(empenhos.includes('const deferredEmpenhosSearch = React.useDeferredValue(empenhosSearch);'), 'busca diferida de Empenhos ausente');
assert(empenhos.includes('const empenhoMetricsById = React.useMemo(() => {'), 'índice de métricas de Empenhos ausente');
assert(empenhos.includes('const invoicesByEmpenhoId = React.useMemo(() => {'), 'índice de NFs por Empenho ausente');
assert(empenhos.includes('const filteredEmpenhos = React.useMemo(() => {'), 'filtro memoizado de Empenhos ausente');
assert(!empenhos.includes('invoices.filter(inv => inv.empenhoId === emp.id)'), 'scan de invoices por card reapareceu');

assert(notas.includes('const deferredNfSearch = React.useDeferredValue(nfSearch);'), 'busca diferida de Notas Fiscais ausente');
assert(notas.includes('const empenhosById = React.useMemo('), 'índice de Empenhos em Notas Fiscais ausente');
assert(notas.includes('const invoiceDerived = React.useMemo(() => {'), 'derivação única das NFs ausente');
assert(notas.includes('const filteredInvoices = React.useMemo(() => {'), 'filtro memoizado de NFs ausente');
assert(!notas.includes('empenhos.find('), 'lookup linear de Empenho em Notas Fiscais reapareceu');
assert(!notas.includes('invoiceRequiresTR('), 'cálculo repetitivo de TR reapareceu');

assert(itens.includes('const deferredItensSearch = React.useDeferredValue(itensSearch);'), 'busca diferida de Consulta de Itens ausente');
assert(itens.includes('const consolidatedItems = React.useMemo<ConsolidatedItem[]>(() => {'), 'consolidação memoizada de itens ausente');
assert(itens.includes('empenho={empenhosById.get(association.empenhoId)}'), 'lookup indexado de Empenho em Consulta de Itens ausente');
assert(!itens.includes('empenhos.find((emp) => emp.id === association.empenhoId)'), 'lookup linear de Empenho em associação reapareceu');

console.log('PERF-E guard: PASS');
