'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_SUPPORT_EMAIL, SUPPORT_TOPICS, filterSupportTutorials,
  getSupportVideoUrl, type SupportTopicId, type SupportTutorial,
} from './tutorialCatalog';

export interface EmprovexHelpCenterProps {
  /** Contato oficial configurado pelo host, quando disponível; sem requisição própria. */
  supportContact?: string | null;
  /** Define a aba de abertura para reutilização na Central de Depósitos. */
  initialTopic?: SupportTopicId;
  className?: string;
}

/** Módulo independente: W4 fará a montagem nos shells autenticados. */
export function EmprovexHelpCenter({
  supportContact,
  initialTopic = 'todos',
  className = '',
}: EmprovexHelpCenterProps) {
  const [topic, setTopic] = useState<SupportTopicId>(initialTopic);
  const [search, setSearch] = useState('');
  const [playing, setPlaying] = useState<SupportTutorial | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);
  const results = useMemo(() => filterSupportTutorials(search, topic), [search, topic]);
  const contact = supportContact?.trim() || DEFAULT_SUPPORT_EMAIL;
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
  const videoUrl = playing ? getSupportVideoUrl(playing.youtubeId, true) : null;
  const originalUrl = playing ? getSupportVideoUrl(playing.youtubeId) : null;

  useEffect(() => {
    if (playing) closeButton.current?.focus();
  }, [playing]);

  function closePlayer() {
    setPlaying(null);
    lastTrigger.current?.focus();
  }

  return (
    <section
      aria-labelledby="emprovex-support-heading"
      data-testid="emprovex-help-center"
      className={'mx-auto w-full max-w-6xl rounded-2xl bg-white p-4 text-slate-900 sm:p-6 ' + className}
    >
      <header className="mb-5">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Ajuda / Academia EMPROVEX</p>
        <h1 id="emprovex-support-heading" className="mt-1 text-xl font-bold sm:text-2xl">Como podemos ajudar?</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Encontre os tutoriais oficiais por assunto. O vídeo só será carregado quando você escolher assistir.
        </p>
      </header>

      <div className="mb-5">
        <label htmlFor="emprovex-support-search" className="mb-2 block text-sm font-semibold text-slate-800">
          Buscar orientação
        </label>
        <input
          id="emprovex-support-search"
          data-testid="emprovex-support-search"
          type="search"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Ex.: saldo, nota fiscal, validade..."
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-offset-2 focus-visible:outline-2 focus-visible:outline-blue-600"
        />
      </div>

      <div role="group" aria-label="Filtrar por assunto" className="mb-5 flex flex-wrap gap-2">
        {SUPPORT_TOPICS.map(item => (
          <button
            key={item.id}
            type="button"
            aria-pressed={topic === item.id}
            onClick={() => setTopic(item.id)}
            className={
              'min-h-10 rounded-full border px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ' +
              (topic === item.id
                ? 'border-blue-800 bg-blue-800 text-white'
                : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100')
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      <p role="status" aria-live="polite" className="mb-3 text-sm text-slate-600">
        {results.length} {results.length === 1 ? 'tutorial encontrado' : 'tutoriais encontrados'}
      </p>
      {results.length ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="emprovex-support-results">
          {results.map(tutorial => (
            <li key={tutorial.youtubeId}>
              <button
                type="button"
                onClick={event => {
                  lastTrigger.current = event.currentTarget;
                  setPlaying(tutorial);
                }}
                className="flex h-full w-full flex-col items-start rounded-xl border border-slate-200 bg-slate-50 p-4 text-left hover:border-blue-500 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                aria-label={'Assistir tutorial ' + String(tutorial.number).padStart(2, '0') + ': ' + tutorial.title}
              >
                <span className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-700">
                  Tutorial {String(tutorial.number).padStart(2, '0')}
                </span>
                <span className="flex-1 text-base font-semibold">{tutorial.title}</span>
                <span className="mt-3 text-sm font-medium text-blue-800" aria-hidden="true">▶ Assistir vídeo</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          Nenhum tutorial corresponde à busca. Tente outra palavra ou entre em contato com o suporte.
        </p>
      )}

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <section aria-labelledby="emprovex-support-mobile-guide" className="rounded-xl border border-slate-200 p-4">
          <h2 id="emprovex-support-mobile-guide" className="font-semibold">Operador Móvel</h2>
          <p className="mt-2 text-sm text-slate-600">
            O passo a passo ilustrado está na página institucional. Ainda não há vídeo oficial dessa área no catálogo.
          </p>
          <a
            href="/institucional#explorar"
            className="mt-3 inline-block text-sm font-semibold text-blue-800 underline underline-offset-2"
          >
            Ver demonstração da Operação Móvel
          </a>
        </section>
        <section aria-labelledby="emprovex-support-contact" className="rounded-xl border border-slate-200 p-4">
          <h2 id="emprovex-support-contact" className="font-semibold">Falar com o suporte</h2>
          <p className="mt-2 text-sm text-slate-600">
            Informe a área do sistema e descreva a dificuldade. Não envie senhas, códigos de acesso ou documentos sensíveis.
          </p>
          {isEmail ? (
            <a
              href={'mailto:' + contact + '?subject=Suporte%20EMPROVEX'}
              className="mt-3 inline-block break-all text-sm font-semibold text-blue-800 underline underline-offset-2"
            >
              {contact}
            </a>
          ) : (
            <p className="mt-3 break-words text-sm font-semibold text-slate-800">{contact}</p>
          )}
        </section>
      </div>

      {playing && videoUrl && originalUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-3 sm:p-6"
          role="presentation"
          onMouseDown={event => { if (event.target === event.currentTarget) closePlayer(); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="emprovex-support-player-title"
            onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); closePlayer(); } }}
            className="w-full max-w-4xl rounded-xl bg-white p-3 text-slate-900 sm:p-5"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 id="emprovex-support-player-title" className="text-base font-bold sm:text-lg">{playing.title}</h2>
              <button
                ref={closeButton}
                type="button"
                onClick={closePlayer}
                className="min-h-10 shrink-0 rounded-lg border border-slate-300 px-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-blue-600"
                aria-label="Fechar vídeo"
              >
                Fechar
              </button>
            </div>
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-slate-950">
              <iframe
                title={playing.title + ' — YouTube'}
                src={videoUrl}
                loading="lazy"
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="h-full w-full border-0"
              />
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Se o player não carregar,{' '}
              <a href={originalUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-800 underline">
                abra o tutorial no YouTube
              </a>.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

export default EmprovexHelpCenter;
