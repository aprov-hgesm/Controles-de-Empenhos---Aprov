// EMPROVEX R1: resumo agregado puro, sem dados pessoais dos clientes.
export function brazilDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const p = Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
  return p.year + '-' + p.month + '-' + p.day;
}

export function buildAdminDigest(input) {
  const { day, now, accounts, cycles, usage, uptime, errors5xx } = input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('DIGEST_DAY_INVALID');
  const n = (v) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const out = [
    'EMPROVEX | BOLETIM DIARIO DO ADMINISTRADOR',
    'Data de referencia: ' + day + ' (Brasil)',
    'Gerado: ' + now,
    '', 'Boa tarde! Este e o seu radar diario de gestao do EMPROVEX.',
    'Preparado para apoiar suas decisoes como Desenvolvedor, Administrador e Gestor da plataforma.',
    'A prioridade e oferecer sinais confiaveis, sem confundir ausencia de dados com normalidade.',
    '', 'DISPONIBILIDADE | ultimas 24 horas',
  ];
  out.push(uptime && uptime.total > 0
    ? 'Verificacoes HTTPS bem-sucedidas: ' + n(100 * uptime.passed / uptime.total) + '% de ' + n(uptime.total) + ' amostras regionais. Nao representa SLA.'
    : 'Uptime: sem amostras confiaveis nesta consulta.');
  out.push(errors5xx === null ? 'Erros HTTP 5xx: sem medicao confiavel.'
    : 'Erros HTTP 5xx no Cloud Run: ' + n(errors5xx) + '.');

  out.push('', 'CLIENTES E ASSINATURAS');
  if (accounts === null || cycles === null) {
    out.push('Dados de clientes e cobranca indisponiveis; nao presumir zero.');
  } else {
    const counts = { active: 0, trial: 0, pending: 0, suspended: 0, canceled: 0, exempt: 0 };
    for (const a of accounts) if (Object.hasOwn(counts, a.status)) counts[a.status] += 1;
    out.push('Contas da Central de Assinaturas: ' + n(accounts.length) + '.');
    out.push('Em dia: ' + n(counts.active) + ' | Trial: ' + n(counts.trial) +
      ' | Pendentes: ' + n(counts.pending) + ' | Suspensas: ' + n(counts.suspended) + '.');
    out.push('Isentas: ' + n(counts.exempt) + ' | Canceladas: ' + n(counts.canceled) + '.');
    const month = day.slice(0, 7);
    const current = cycles.filter(c => c.referenceMonth === month);
    const paid = current.filter(c => c.status === 'paid').length;
    const pending = current.filter(c => c.status === 'open' || c.status === 'pending').length;
    const overdue = cycles.filter(c => (c.status === 'open' || c.status === 'pending')
      && typeof c.dueDate === 'string' && c.dueDate < day).length;
    const review = accounts.filter(a => a.refundReviewStatus === 'pending'
      || a.grace48ReviewStatus === 'pending').length;
    out.push('Competencia ' + month + ': ' + n(paid) + ' ciclos marcados pagos; ' + n(pending) + ' abertos/pendentes.');
    out.push('Ciclos vencidos nao quitados: ' + n(overdue) + ' | Revisoes financeiras: ' + n(review) + '.');
    out.push('Ciclos marcados pagos nao equivalem a comprovacao contabil de receita.');
  }

  out.push('', 'FIRESTORE | consumo parcial no dia de faturamento');
  if (usage === null) out.push('Metricas de consumo indisponiveis. Nao interpretar como zero.');
  else {
    out.push('Read Units: ' + n(usage.billableReadUnits) +
      ' | Realtime Read Units: ' + n(usage.billableRealtimeReadUnits) +
      ' | Write Units: ' + n(usage.billableWriteUnits) + '.');
    out.push('Ultima amostra: ' + (usage.dataThrough || 'nao informada') + '.');
    out.push('Amostra parcial do banco principal; nao inclui automaticamente emprovex-warehouse nem representa fatura.');
  }
  out.push('', 'SEGURANCA E BACKUPS',
    'Eventos de seguranca: disponiveis no Cloud Logging, sem contagem consolidada nesta R1.',
    'Backups existentes preservados; a ultima execucao nao foi consultada neste boletim.',
    '', 'Acompanhar: https://console.cloud.google.com/monitoring',
    'Administrar: https://emprovex.com.br/admin',
    '', 'Resumo agregado. Nenhum dado pessoal de cliente, documento ou detalhe por UG.',
    'Obrigado por acompanhar a saude do EMPROVEX. Ate o proximo boletim!',
    'Com respeito, Assistente de Gestao EMPROVEX.');
  return { subject: 'EMPROVEX | Resumo diario - ' + day, text: out.join('\n') };
}
