import { performance } from 'node:perf_hooks';

const EMPENHOS = 750;
const ITEMS_PER_EMPENHO = 12;
const INVOICES = 2250;
const SEARCH_TERMS = ['fornecedor 1', '2026ne1', 'material', 'fornecedor 7', '2026ne2', ''];

const empenhos = Array.from({ length: EMPENHOS }, (_, index) => ({
  id: `2026NE${String(index + 1).padStart(4, '0')}`,
  supplier: `Fornecedor ${index % 80}`,
  description: `Aquisição de material ${index % 140}`,
  classification: index % 5 === 0 ? 'PASA' : 'QR',
  pregao: `PE-${index % 25}`,
  items: Array.from({ length: ITEMS_PER_EMPENHO }, (_, itemIndex) => ({
    name: `Material ${itemIndex % 60}`,
    unit: 'UN',
    quantity: 10 + (itemIndex % 7),
    received: itemIndex % 4,
    unitPrice: 15 + (itemIndex % 11),
  })),
}));

const invoices = Array.from({ length: INVOICES }, (_, index) => ({
  id: `NF${index + 1}`,
  empenhoId: empenhos[index % empenhos.length].id,
  supplier: `Fornecedor ${index % 80}`,
  localizacaoAtual: index % 3 === 0 ? 'APROVISIONAMENTO' : index % 3 === 1 ? 'COMISSAO' : 'TESOURARIA',
}));

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const time = (fn, rounds = 15) => {
  for (let i = 0; i < 3; i += 1) fn();
  const samples = [];
  let result;
  for (let i = 0; i < rounds; i += 1) {
    const started = performance.now();
    result = fn();
    samples.push(performance.now() - started);
  }
  return { medianMs: median(samples), result };
};

function baselineEmpenhos() {
  let visits = 0;
  let checksum = 0;
  const visible = empenhos.filter((emp) => {
    let committed = 0;
    for (const item of emp.items) { visits += 1; committed += item.quantity * item.unitPrice; }
    let received = 0;
    for (const item of emp.items) { visits += 1; received += item.received * item.unitPrice; }
    return committed - received >= 0;
  });

  for (const emp of visible) {
    let committed = 0;
    let received = 0;
    let withBalance = 0;
    for (const item of emp.items) { visits += 1; committed += item.quantity * item.unitPrice; }
    for (const item of emp.items) { visits += 1; received += item.received * item.unitPrice; }
    for (const item of emp.items) { visits += 1; if (item.quantity - item.received > 0) withBalance += 1; }
    let invoiceCount = 0;
    for (const invoice of invoices) { visits += 1; if (invoice.empenhoId === emp.id) invoiceCount += 1; }
    checksum += committed + received + withBalance + invoiceCount;
  }
  return { visits, checksum };
}

function optimizedEmpenhos() {
  let visits = 0;
  let checksum = 0;
  const metrics = new Map();
  const invoicesByEmpenho = new Map();

  for (const emp of empenhos) {
    let committed = 0;
    let received = 0;
    let withBalance = 0;
    for (const item of emp.items) {
      visits += 1;
      committed += item.quantity * item.unitPrice;
      received += item.received * item.unitPrice;
      if (item.quantity - item.received > 0) withBalance += 1;
    }
    metrics.set(emp.id, { committed, received, withBalance });
  }

  for (const invoice of invoices) {
    visits += 1;
    invoicesByEmpenho.set(invoice.empenhoId, (invoicesByEmpenho.get(invoice.empenhoId) ?? 0) + 1);
  }

  for (const emp of empenhos) {
    const metric = metrics.get(emp.id);
    checksum += metric.committed + metric.received + metric.withBalance + (invoicesByEmpenho.get(emp.id) ?? 0);
  }
  return { visits, checksum };
}

function consolidateItems() {
  let visits = 0;
  const consolidated = new Map();
  for (const emp of empenhos) {
    for (const item of emp.items) {
      visits += 1;
      const key = `${item.name.toLowerCase()}::${item.unit.toLowerCase()}`;
      const current = consolidated.get(key) ?? { name: item.name, unit: item.unit, associations: [] };
      current.associations.push({ empenhoId: emp.id, supplier: emp.supplier, pregao: emp.pregao });
      consolidated.set(key, current);
    }
  }
  return { visits, items: Array.from(consolidated.values()) };
}

function filterItems(items, term) {
  let visits = 0;
  let checksum = 0;
  const normalized = term.trim().toLowerCase();
  for (const item of items) {
    visits += 1;
    if (!normalized || item.name.toLowerCase().includes(normalized)
      || item.associations.some((association) =>
        association.empenhoId.toLowerCase().includes(normalized)
        || association.supplier.toLowerCase().includes(normalized)
        || association.pregao.toLowerCase().includes(normalized))) checksum += 1;
  }
  return { visits, checksum };
}

function baselineItens() {
  let visits = 0;
  let checksum = 0;
  for (const term of SEARCH_TERMS) {
    const consolidated = consolidateItems();
    visits += consolidated.visits;
    const filtered = filterItems(consolidated.items, term);
    visits += filtered.visits;
    checksum += filtered.checksum;
  }
  return { visits, checksum };
}

function optimizedItens() {
  const consolidated = consolidateItems();
  let visits = consolidated.visits;
  let checksum = 0;
  for (const term of SEARCH_TERMS) {
    const filtered = filterItems(consolidated.items, term);
    visits += filtered.visits;
    checksum += filtered.checksum;
  }
  return { visits, checksum };
}

function findEmpenho(id, counter) {
  for (const emp of empenhos) {
    counter.visits += 1;
    if (emp.id === id) return emp;
  }
}

function baselineNotas() {
  const counter = { visits: 0 };
  let checksum = 0;
  for (let pass = 0; pass < 3; pass += 1) {
    for (const invoice of invoices) {
      counter.visits += 1;
      if (pass < 2) checksum += findEmpenho(invoice.empenhoId, counter)?.classification === 'PASA' ? 0 : 1;
      else checksum += invoice.localizacaoAtual === 'TESOURARIA' ? 1 : 0;
    }
  }
  for (const invoice of invoices) {
    counter.visits += 1;
    checksum += findEmpenho(invoice.empenhoId, counter)?.id.length ?? 0;
  }
  for (const invoice of invoices) checksum += findEmpenho(invoice.empenhoId, counter)?.id.length ?? 0;
  return { visits: counter.visits, checksum };
}

function optimizedNotas() {
  let visits = 0;
  let checksum = 0;
  const empenhosById = new Map();
  for (const emp of empenhos) { visits += 1; empenhosById.set(emp.id, emp); }
  const meta = new Map();
  for (const invoice of invoices) {
    visits += 1;
    const emp = empenhosById.get(invoice.empenhoId);
    meta.set(invoice.id, emp);
    checksum += emp?.classification === 'PASA' ? 0 : 2;
    checksum += invoice.localizacaoAtual === 'TESOURARIA' ? 1 : 0;
  }
  for (const invoice of invoices) { visits += 1; checksum += meta.get(invoice.id)?.id.length ?? 0; }
  for (const invoice of invoices) checksum += meta.get(invoice.id)?.id.length ?? 0;
  return { visits, checksum };
}

const scenarios = {
  empenhos: [time(baselineEmpenhos), time(optimizedEmpenhos)],
  notasFiscais: [time(baselineNotas), time(optimizedNotas)],
  consultaItensTyping: [time(baselineItens), time(optimizedItens)],
};

for (const [name, [before, after]] of Object.entries(scenarios)) {
  if (before.result.checksum !== after.result.checksum) throw new Error(`${name}: checksum divergente`);
}

console.log(JSON.stringify({
  fixture: {
    empenhos: EMPENHOS,
    itemsPerEmpenho: ITEMS_PER_EMPENHO,
    totalItems: EMPENHOS * ITEMS_PER_EMPENHO,
    invoices: INVOICES,
    searchTerms: SEARCH_TERMS.length,
  },
  ...Object.fromEntries(Object.entries(scenarios).map(([name, [before, after]]) => [name, {
    baselineMedianMs: Number(before.medianMs.toFixed(3)),
    optimizedMedianMs: Number(after.medianMs.toFixed(3)),
    baselineCollectionVisits: before.result.visits,
    optimizedCollectionVisits: after.result.visits,
    visitReductionPct: Number((100 * (1 - after.result.visits / before.result.visits)).toFixed(2)),
  }])),
}, null, 2));
