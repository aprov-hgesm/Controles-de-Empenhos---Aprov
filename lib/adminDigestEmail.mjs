// Presentation only. Escapes every operational metric before inserting HTML.
function safe(value) {
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}
const sectionNames = new Map([
  ['DISPONIBILIDADE | ultimas 24 horas', 'Disponibilidade e saude tecnica'],
  ['CLIENTES E ASSINATURAS', 'Clientes e assinaturas'],
  ['FIRESTORE | consumo parcial no dia de faturamento', 'Consumo e infraestrutura'],
  ['SEGURANCA E BACKUPS', 'Seguranca e continuidade'],
]);
export function renderAdminDigestHtml(text, { test = false } = {}) {
  const lines = String(text).split('\n');
  const day = lines.find(s => s.startsWith('Data de referencia: '))?.replace('Data de referencia: ', '') || '';
  const sections = [];
  let current = { title: 'Panorama executivo', lines: [] };
  for (const line of lines.slice(3)) {
    if (sectionNames.has(line)) {
      sections.push(current);
      current = { title: sectionNames.get(line), lines: [] };
    } else if (line.trim()) {
      current.lines.push(line);
    }
  }
  sections.push(current);
  const sectionHtml = sections.filter(s => s.lines.length).map(s =>
    '<section style="margin:0 0 20px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:18px 20px">' +
    '<h2 style="font-size:15px;line-height:22px;margin:0 0 12px;color:#0f172a;font-weight:700">' + safe(s.title) + '</h2>' +
    s.lines.map(line => '<p style="margin:0 0 9px;font-size:13px;line-height:21px;color:#334155">' + safe(line) + '</p>').join('') +
    '</section>'
  ).join('');
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>' +
    '<body style="margin:0;padding:24px 10px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">' +
    '<main style="max-width:680px;margin:0 auto">' +
    '<header style="background:#0f172a;padding:28px 26px;border-radius:16px 16px 0 0;color:#fff">' +
    '<div style="font-size:12px;letter-spacing:2px;font-weight:700;color:#93c5fd">EMPROVEX</div>' +
    '<h1 style="font-size:26px;line-height:32px;margin:12px 0 6px;color:#fff">Seu boletim de gestao</h1>' +
    '<p style="font-size:14px;line-height:22px;margin:0;color:#cbd5e1">Desenvolvedor, Administrador e Gestor da plataforma</p>' +
    '</header><div style="background:#f8fafc;padding:22px 20px;border-radius:0 0 16px 16px">' +
    (test ? '<p style="padding:10px 14px;border-radius:9px;background:#fef3c7;color:#92400e;font-size:12px;font-weight:700">ENVIO DE TESTE - o boletim diario das 18h permanece independente</p>' : '') +
    '<p style="font-size:12px;color:#64748b;margin:0 0 18px">Referencia: ' + safe(day) + '</p>' +
    sectionHtml +
    '<footer style="padding:12px 8px;text-align:center;color:#64748b;font-size:12px;line-height:19px">' +
    'Resumo administrativo agregado. Dados ausentes sao identificados. ' +
    'Nenhum documento ou informacao pessoal de clientes foi incluido.' +
    '<p style="margin:9px 0">EMPROVEX &middot; Gestao Logistica e Financeira</p></footer></div></main></body></html>';
}
