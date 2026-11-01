/**
 * Academia EMPROVEX — espelho estático dos 14 tutoriais oficiais presentes em
 * public/institucional/content.html, validado pelo teste scripts/emprovex-support-w1.test.mjs.
 * Não adicionar vídeos sem atualizar/validar a origem institucional.
 */
export const SUPPORT_TOPICS = [
  { id: 'todos', label: 'Todos' },
  { id: 'primeiros-passos', label: 'Primeiros passos' },
  { id: 'empenhos', label: 'Empenhos e saldos' },
  { id: 'cronogramas', label: 'Cronogramas' },
  { id: 'notas-fiscais', label: 'Notas Fiscais' },
  { id: 'itens-fornecedores', label: 'Itens e fornecedores' },
  { id: 'depositos', label: 'Central de Depósitos' },
  { id: 'relatorios', label: 'Relatórios' },
] as const;

export type SupportTopicId = (typeof SUPPORT_TOPICS)[number]['id'];
export type TutorialTopicId = Exclude<SupportTopicId, 'todos'>;

export interface SupportTutorial {
  number: number;
  title: string;
  youtubeId: string;
  topic: TutorialTopicId;
  keywords: string;
}

// Ordem e títulos preservados da landing institucional, tutoriais 01–14.
export const SUPPORT_TUTORIALS: readonly SupportTutorial[] = [
  { number: 1, title: 'Como cadastrar empenhos no EMPROVEX', youtubeId: 'Hmt9__qnqJ0', topic: 'primeiros-passos', keywords: 'cadastro empenho nova ne saldo' },
  { number: 2, title: 'Explore a aba Empenhos', youtubeId: 'Fuo0-XADCRw', topic: 'empenhos', keywords: 'saldo acompanhamento consulta ne' },
  { number: 3, title: 'Painel EMPROVEX: visão geral da gestão', youtubeId: 'SCnT_-bBb8I', topic: 'primeiros-passos', keywords: 'inicio painel indicadores navegação' },
  { number: 4, title: 'Consulte os itens', youtubeId: 'CPJeUKmvrIo', topic: 'itens-fornecedores', keywords: 'materiais consulta itens fornecedor pesquisa' },
  { number: 5, title: 'Cronogramas e fornecedores', youtubeId: 'd6AX6aBIPbE', topic: 'cronogramas', keywords: 'pedidos entregas fornecedor' },
  { number: 6, title: 'Acompanhe as notas fiscais', youtubeId: 'LxOMxEwudH8', topic: 'notas-fiscais', keywords: 'nf acompanhamento' },
  { number: 7, title: 'Cadastre uma nova NF', youtubeId: 'tx5EmAW2XfQ', topic: 'notas-fiscais', keywords: 'nota fiscal registro' },
  { number: 8, title: 'Comissão de Recebimento', youtubeId: 'VGSjPgYeoJk', topic: 'notas-fiscais', keywords: 'termo de recebimento tr' },
  { number: 9, title: 'Conheça os relatórios', youtubeId: '38UXm8hfrA0', topic: 'relatorios', keywords: 'exportação consulta relatório' },
  { number: 10, title: 'Conheça a Central 3D', youtubeId: 'rPlKeOHgmpA', topic: 'depositos', keywords: 'central estoque localização visualização' },
  { number: 11, title: 'Validade dos materiais', youtubeId: 'tqUAd9L1lfg', topic: 'depositos', keywords: 'vencimentos alertas prazo' },
  { number: 12, title: 'Alocação de materiais', youtubeId: 'UIMqKvoMeYI', topic: 'depositos', keywords: 'posição depósito estante prateleira localização' },
  { number: 13, title: 'Saída de materiais', youtubeId: 'qgv2ZbavrKk', topic: 'depositos', keywords: 'retirada movimentação consumo' },
  { number: 14, title: 'Controle de depósitos e etiquetas', youtubeId: 'JU8ed1vhP9Y', topic: 'depositos', keywords: 'código barras etiquetas organização' },
];

const ALLOWED_VIDEO_IDS = new Set(SUPPORT_TUTORIALS.map(tutorial => tutorial.youtubeId));

export function normalizeSupportText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

export function filterSupportTutorials(query: string, topic: SupportTopicId = 'todos'): SupportTutorial[] {
  const normalized = normalizeSupportText(query);
  return SUPPORT_TUTORIALS.filter(tutorial => {
    if (topic !== 'todos' && tutorial.topic !== topic) return false;
    const topicLabel = SUPPORT_TOPICS.find(item => item.id === tutorial.topic)?.label ?? '';
    const haystack = normalizeSupportText(
      tutorial.title + ' ' + topicLabel + ' ' + tutorial.keywords + ' ' + tutorial.number
    );
    return !normalized || normalized.split(/\s+/).every(word => haystack.includes(word));
  });
}

export function getSupportVideoUrl(youtubeId: string, embed = false): string | null {
  if (!/^[\w-]{11}$/.test(youtubeId) || !ALLOWED_VIDEO_IDS.has(youtubeId)) return null;
  return embed
    ? 'https://www.youtube-nocookie.com/embed/' + youtubeId + '?rel=0&playsinline=1'
    : 'https://www.youtube.com/watch?v=' + youtubeId;
}

// Canal já publicado no rodapé de login e nos documentos legais.
export const DEFAULT_SUPPORT_EMAIL = 'aprov1hgesm@gmail.com';
