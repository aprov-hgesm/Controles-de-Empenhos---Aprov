'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowUp, BookOpenText, ExternalLink, LoaderCircle, MessageCircle,
  Plus, Sparkles, X,
} from 'lucide-react';

type Evidence = { source: string; documentId: string };
type ChatMessage = {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  status?: string;
  evidence?: Evidence[];
  coverage?: string;
  morePages?: boolean;
};
type AskResponse = {
  answer?: string;
  status?: string;
  contextToken?: string;
  error?: string;
  result?: {
    evidence?: Evidence[];
    coverage?: string;
    pagination?: { truncated?: boolean; nextCursor?: string | null } | null;
  };
};
const SUGGESTIONS = [
  'Quais notas fiscais foram cadastradas ontem?',
  'Quais empenhos de exercícios anteriores têm saldo?',
  'Onde está o arroz?',
];

function EleonorSymbol({ size = 'normal' }: { size?: 'normal' | 'large' }) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex shrink-0 items-center justify-center rounded-[35%] border border-blue-300/40 bg-gradient-to-br from-[#3261e7] via-[#00288e] to-[#031229] text-white shadow-[0_7px_24px_rgba(3,35,112,0.28)] ${size === 'large' ? 'h-14 w-14' : 'h-10 w-10'}`}
    >
      <span className={`font-semibold tracking-[-0.12em] [font-family:Georgia,serif] ${size === 'large' ? 'text-[35px]' : 'text-[25px]'}`}>E</span>
      <Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5 text-[#b9dcff]" />
    </span>
  );
}

function friendlyError(status: number, error?: string): string {
  if (error === 'AI_EXPERIMENT_DISABLED' || status === 404) {
    return 'A Eleonor ainda não está habilitada neste ambiente. Suas consultas serão liberadas após a homologação do EMPROVEX AI.';
  }
  if (status === 401 || status === 403) {
    return 'Não consegui validar seu acesso agora. Confirme sua sessão do EMPROVEX e tente novamente.';
  }
  if (status === 429) return 'Há muitas consultas em andamento. Tente novamente em instantes.';
  return 'Não consegui concluir a consulta agora. Os registros do EMPROVEX não foram alterados.';
}

export function EleonorExperience({
  user,
  fullPage = false,
  onOpenFull,
}: {
  user: User | null;
  fullPage?: boolean;
  onOpenFull?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const contextRef = useRef<string | undefined>(undefined);
  const controllerRef = useRef<AbortController | null>(null);
  const requestNumber = useRef(0);
  const nextId = useRef(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open || fullPage) inputRef.current?.focus();
  }, [open, fullPage]);

  useEffect(() => {
    if (open || fullPage) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading, open, fullPage]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const newConversation = () => {
    requestNumber.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    contextRef.current = undefined;
    setMessages([]);
    setDraft('');
    setLoading(false);
    inputRef.current?.focus();
  };

  const send = async (value = draft) => {
    const message = value.trim();
    if (!message || message.length > 1000 || loading || !user) return;
    const number = ++requestNumber.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    setDraft('');
    setLoading(true);
    setMessages(previous => [...previous, {
      id: ++nextId.current, role: 'user', text: message,
    }]);

    try {
      const token = await user.getIdToken();
      if (controller.signal.aborted) return;
      const response = await fetch('/api/emprovex-ai/ask', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message,
          ...(contextRef.current ? { contextToken: contextRef.current } : {}),
        }),
        cache: 'no-store',
        signal: controller.signal,
      });
      const body: AskResponse = await response.json().catch(() => ({}));
      if (controller.signal.aborted || number !== requestNumber.current) return;
      if (!response.ok) throw new Error(friendlyError(response.status, body.error));

      // Only the server-issued encrypted context may be replayed to the backend.
      contextRef.current = typeof body.contextToken === 'string'
        ? body.contextToken : undefined;
      const text = typeof body.answer === 'string' && body.answer.trim()
        ? body.answer : 'A consulta não retornou uma resposta disponível.';
      setMessages(previous => [...previous, {
        id: ++nextId.current,
        role: 'assistant',
        text,
        status: body.status,
        evidence: Array.isArray(body.result?.evidence)
          ? body.result.evidence.filter(item => typeof item.source === 'string' && typeof item.documentId === 'string')
          : undefined,
        coverage: body.result?.coverage,
        morePages: body.result?.pagination?.truncated === true
          || Boolean(body.result?.pagination?.nextCursor),
      }]);
    } catch (error) {
      if (controller.signal.aborted || number !== requestNumber.current) return;
      setMessages(previous => [...previous, {
        id: ++nextId.current,
        role: 'assistant',
        text: error instanceof Error && error.message.startsWith('Não consegui')
          ? error.message
          : error instanceof Error && error.message.startsWith('A Eleonor')
            ? error.message
            : 'Não foi possível conectar à Eleonor agora. Nenhuma alteração foi realizada.',
        status: 'unavailable',
      }]);
    } finally {
      if (number === requestNumber.current) {
        controllerRef.current = null;
        setLoading(false);
      }
    }
  };

  const onComposerKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  };

  const conversation = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div role="log" aria-label="Conversa com Eleonor" aria-live="polite"
        className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-6 sm:px-7">
        {messages.length === 0 && (
          <div className="flex min-h-full flex-col items-center justify-center py-8 text-center">
            <EleonorSymbol size="large" />
            <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.28em] text-blue-700/65">
              Inteligência operacional EMPROVEX
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#0b1c30] sm:text-3xl">
              Como posso ajudar?
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">
              Sou a Eleonor. Posso ajudar com empenhos, notas fiscais, fornecedores e estoque, usando os dados autorizados do seu setor.
            </p>
            <div className="mt-6 flex w-full max-w-md flex-col gap-2">
              {SUGGESTIONS.map(example => (
                <button key={example} type="button" onClick={() => void send(example)}
                  disabled={loading || !user}
                  className="rounded-2xl border border-[#dce6f3] bg-white/80 px-4 py-3 text-left text-xs font-medium text-slate-700 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50">
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map(item => (
          <div key={item.id} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[92%] rounded-[22px] px-4 py-3 text-sm leading-6 sm:max-w-[84%] ${item.role === 'user'
              ? 'rounded-br-md bg-[#00288e] text-white'
              : 'rounded-bl-md border border-slate-200/85 bg-white/90 text-[#152742] shadow-sm'}`}>
              {item.role === 'assistant' && (
                <div className="mb-2 flex items-center gap-2">
                  <EleonorSymbol />
                  <span className="text-xs font-bold text-[#00288e]">Eleonor</span>
                  {item.status === 'partial' && <span className="text-[10px] font-semibold text-amber-700">Resultado parcial</span>}
                </div>
              )}
              <p className="whitespace-pre-wrap break-words">{item.text}</p>
              {item.role === 'assistant' && ((item.coverage && item.coverage !== 'complete') || item.morePages) && (
                <p className="mt-2 text-[11px] font-semibold text-amber-700">
                  {item.morePages ? 'Existem outros registros disponíveis.' : 'A cobertura desta consulta não está confirmada como completa.'}
                </p>
              )}
              {item.role === 'assistant' && item.evidence && item.evidence.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-2">
                  <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <BookOpenText className="h-3 w-3" /> Fontes da consulta
                  </p>
                  <p className="mt-1 break-words text-[11px] text-slate-500">
                    {item.evidence.slice(0, 3).map(source => `${source.source}: ${source.documentId}`).join(' · ')}
                    {item.evidence.length > 3 ? ` · +${item.evidence.length - 3} fontes` : ''}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 pl-2 text-xs text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin text-[#3261e7]" /> Eleonor está consultando...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form className="shrink-0 border-t border-slate-200/80 bg-white/80 p-3 sm:p-4"
        onSubmit={event => { event.preventDefault(); void send(); }}>
        <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-[#f7f9fd] px-3 py-2 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100">
          <textarea ref={inputRef} value={draft} rows={1} maxLength={1000}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={onComposerKey} aria-label="Pergunte à Eleonor"
            placeholder="Pergunte à Eleonor..."
            className="max-h-28 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
          <button type="submit" disabled={!user || loading || !draft.trim()}
            aria-label="Enviar mensagem"
            className="mb-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#00288e] text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-slate-400">
          Consultas somente de leitura · Respostas baseadas no EMPROVEX
        </p>
      </form>
    </div>
  );

  if (fullPage) {
    return (
      <section data-testid="eleonor-full-chat"
        className="relative flex h-[calc(100dvh-11rem)] min-h-[440px] flex-col overflow-hidden rounded-[28px] border border-[#dce5f4] bg-gradient-to-b from-[#f4f8ff] via-[#f7faff] to-[#edf3fc] shadow-[0_20px_65px_-40px_rgba(0,40,142,0.32)]">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-blue-100 bg-white/75 px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <EleonorSymbol />
            <div>
              <h1 className="text-lg font-bold leading-tight tracking-tight text-[#0b1c30]">Eleonor</h1>
              <p className="text-[11px] font-medium text-slate-500">Assistente inteligente do EMPROVEX</p>
            </div>
          </div>
          <button onClick={newConversation} type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-white px-3 py-2 text-xs font-semibold text-[#00288e] hover:bg-blue-50">
            <Plus className="h-4 w-4" /> Nova conversa
          </button>
        </header>
        {conversation}
      </section>
    );
  }

  return (
    <aside data-testid="eleonor-floating" className="pointer-events-none fixed bottom-[5.5rem] right-4 z-[70] flex flex-col items-end gap-3 lg:bottom-6 lg:right-6">
      {open && (
        <section role="dialog" aria-modal="false" aria-label="Conversa rápida com Eleonor"
          className="pointer-events-auto flex h-[min(590px,calc(100dvh-9rem))] w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[25px] border border-blue-200/60 bg-[#f6f9ff] shadow-[0_24px_85px_rgba(2,17,49,0.28)]">
          <header className="flex shrink-0 items-center justify-between border-b border-blue-100 bg-white/90 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <EleonorSymbol />
              <div>
                <p className="text-sm font-bold text-[#0b1c30]">Eleonor</p>
                <p className="text-[10px] text-slate-500">Assistente EMPROVEX</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={newConversation} aria-label="Nova conversa"
                className="rounded-lg p-2 text-slate-500 hover:bg-blue-50"><Plus className="h-4 w-4" /></button>
              <button type="button" onClick={() => onOpenFull
                ? onOpenFull()
                : window.location.assign('/eleonor')}
                aria-label="Abrir chat completo"
                className="rounded-lg p-2 text-slate-500 hover:bg-blue-50"><ExternalLink className="h-4 w-4" /></button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar chat"
                className="rounded-lg p-2 text-slate-500 hover:bg-blue-50"><X className="h-4 w-4" /></button>
            </div>
          </header>
          {conversation}
        </section>
      )}
      <button type="button" onClick={() => setOpen(value => !value)}
        aria-label={open ? 'Recolher Eleonor' : 'Conversar com Eleonor'}
        aria-expanded={open} title="Conversar com Eleonor"
        className="pointer-events-auto group inline-flex h-14 w-14 items-center justify-center rounded-[20px] border border-blue-300/50 bg-gradient-to-br from-[#1c51df] to-[#021c57] text-white shadow-[0_12px_32px_rgba(0,40,142,0.28)] transition-transform hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(0,40,142,0.4)]">
        {open ? <MessageCircle className="h-5 w-5" /> : <span className="text-3xl [font-family:Georgia,serif]">E</span>}
        {!open && <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-[#bfddff]" aria-hidden="true" />}
      </button>
    </aside>
  );
}
