from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: esperado 1 ocorrência, encontrado {count}: {old[:90]!r}')
    file_path.write_text(text.replace(old, new, 1), encoding='utf-8')


def append_once(path: str, marker: str, addition: str) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding='utf-8')
    if marker in text:
        raise SystemExit(f'{path}: marcador já aplicado: {marker}')
    file_path.write_text(text.rstrip() + '\n\n' + addition.strip() + '\n', encoding='utf-8')


# app/page.tsx — toast robusto e feedback de autenticação.
replace_once(
    'app/page.tsx',
    "import { useState, useEffect } from 'react';",
    "import { useCallback, useEffect, useRef, useState } from 'react';",
)

replace_once(
    'app/page.tsx',
    """  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);\n  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {\n    setToast({ message, type });\n    setTimeout(() => {\n      setToast(null);\n    }, 4000);\n  };\n""",
    """  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);\n  const [isSigningIn, setIsSigningIn] = useState(false);\n  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);\n  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {\n    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);\n    setToast({ message, type });\n    toastTimerRef.current = setTimeout(() => {\n      setToast(null);\n      toastTimerRef.current = null;\n    }, 4000);\n  }, []);\n\n  useEffect(() => () => {\n    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);\n  }, []);\n""",
)

replace_once(
    'app/page.tsx',
    """          <button\n            onClick={async () => {\n              try {\n                await signInUser();\n                showToast('Acesso autorizado com sucesso!', 'success');\n              } catch (err: any) {\n                console.error('Erro na autenticação:', err);\n                showToast('Falha na autenticação. Verifique sua conta Google.', 'error');\n              }\n            }}\n            className=\"w-full h-12 bg-[#00288e] hover:bg-[#001e6a] text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-3 shadow-md hover:shadow-lg active:scale-95 group\"\n          >\n            <LogIn className=\"w-5 h-5 flex-shrink-0 group-hover:translate-x-1 transition-transform\" />\n            Entrar no Sistema\n          </button>\n""",
    """          <button\n            onClick={async () => {\n              if (isSigningIn) return;\n              setIsSigningIn(true);\n              try {\n                await signInUser();\n                showToast('Acesso autorizado com sucesso!', 'success');\n              } catch (err: any) {\n                console.error('Erro na autenticação:', err);\n                showToast('Falha na autenticação. Verifique sua conta Google.', 'error');\n              } finally {\n                setIsSigningIn(false);\n              }\n            }}\n            disabled={isSigningIn}\n            aria-busy={isSigningIn}\n            className=\"w-full h-12 bg-[#00288e] hover:bg-[#001e6a] text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-3 shadow-md hover:shadow-lg active:scale-95 group disabled:opacity-70 disabled:cursor-wait disabled:active:scale-100\"\n          >\n            {isSigningIn ? (\n              <Loader2 className=\"w-5 h-5 flex-shrink-0 animate-spin\" />\n            ) : (\n              <LogIn className=\"w-5 h-5 flex-shrink-0 group-hover:translate-x-1 transition-transform\" />\n            )}\n            {isSigningIn ? 'Autenticando…' : 'Entrar no Sistema'}\n          </button>\n""",
)

# Header — sincronização anunciada sem alterar o comportamento.
replace_once(
    'components/layout/AppHeader.tsx',
    '          <div className="flex items-center gap-1 text-xs font-semibold text-blue-600 animate-pulse bg-blue-50/70 backdrop-blur-sm px-3 py-1 rounded-full">',
    '          <div role="status" aria-live="polite" className="flex items-center gap-1 text-xs font-semibold text-blue-600 animate-pulse bg-blue-50/70 backdrop-blur-sm px-3 py-1 rounded-full">',
)

# Empenhos — estados de processamento nas ações de gravação.
replace_once(
    'features/empenhos/components/EmpenhosView.tsx',
    'import { AlertCircle, AlertTriangle, ArrowLeft, Braces, Calendar, CalendarDays, Check, CheckCircle2, ChevronRight, Copy, Edit, Eye, FileDown, FileText, Package, Plus, Printer, Save, Search, Trash2, X } from \'lucide-react\';',
    'import { AlertCircle, AlertTriangle, ArrowLeft, Braces, Calendar, CalendarDays, Check, CheckCircle2, ChevronRight, Copy, Edit, Eye, FileDown, FileText, Loader2, Package, Plus, Printer, Save, Search, Trash2, X } from \'lucide-react\';',
)

replace_once(
    'features/empenhos/components/EmpenhosView.tsx',
    """  const [savingPregao, setSavingPregao] = React.useState(false);\n\n  return (\n""",
    """  const [savingPregao, setSavingPregao] = React.useState(false);\n  const [isCreatingEmpenho, setIsCreatingEmpenho] = React.useState(false);\n  const [isSavingReview, setIsSavingReview] = React.useState(false);\n  const [isSavingItem, setIsSavingItem] = React.useState(false);\n\n  const handleCreateEmpenhoWithFeedback = async (event: React.FormEvent) => {\n    if (isCreatingEmpenho) {\n      event.preventDefault();\n      return;\n    }\n    setIsCreatingEmpenho(true);\n    try {\n      await handleCreateEmpenho(event);\n    } finally {\n      setIsCreatingEmpenho(false);\n    }\n  };\n\n  const handleSaveReviewWithFeedback = async () => {\n    if (isSavingReview) return;\n    setIsSavingReview(true);\n    try {\n      await handleSaveReviewEmpenho();\n    } finally {\n      setIsSavingReview(false);\n    }\n  };\n\n  const handleAddItemWithFeedback = async () => {\n    if (isSavingItem) return;\n    setIsSavingItem(true);\n    try {\n      await handleAddItemToEmpenho();\n    } finally {\n      setIsSavingItem(false);\n    }\n  };\n\n  return (\n""",
)

replace_once(
    'features/empenhos/components/EmpenhosView.tsx',
    '<form onSubmit={handleCreateEmpenho} className="p-5 space-y-4">',
    '<form onSubmit={handleCreateEmpenhoWithFeedback} className="p-5 space-y-4">',
)

replace_once(
    'features/empenhos/components/EmpenhosView.tsx',
    """                            <button \n                              type=\"submit\"\n                              className=\"px-4 py-2 bg-[#00288e] text-white rounded-xl font-bold text-xs hover:bg-[#1e40af] transition-all shadow-sm\"\n                            >\n                              Prosseguir\n                            </button>\n""",
    """                            <button \n                              type=\"submit\"\n                              disabled={isCreatingEmpenho}\n                              aria-busy={isCreatingEmpenho}\n                              className=\"px-4 py-2 bg-[#00288e] text-white rounded-xl font-bold text-xs hover:bg-[#1e40af] transition-all shadow-sm flex items-center gap-2 disabled:opacity-60 disabled:cursor-wait\"\n                            >\n                              {isCreatingEmpenho && <Loader2 className=\"w-4 h-4 animate-spin\" />}\n                              {isCreatingEmpenho ? 'Processando…' : 'Prosseguir'}\n                            </button>\n""",
)

replace_once(
    'features/empenhos/components/EmpenhosView.tsx',
    """                                  type=\"button\"\n                                  onClick={handleAddItemToEmpenho}\n                                  className=\"px-5 py-2.5 bg-[#00288e] text-white font-bold text-xs rounded-xl hover:bg-[#1e40af] transition-all shadow-sm cursor-pointer flex items-center gap-2\"\n                                >\n                                  <Save className=\"w-4 h-4\" />\n                                  <span>Salvar Item no Empenho</span>\n""",
    """                                  type=\"button\"\n                                  onClick={handleAddItemWithFeedback}\n                                  disabled={isSavingItem}\n                                  aria-busy={isSavingItem}\n                                  className=\"px-5 py-2.5 bg-[#00288e] text-white font-bold text-xs rounded-xl hover:bg-[#1e40af] transition-all shadow-sm cursor-pointer flex items-center gap-2 disabled:opacity-60 disabled:cursor-wait\"\n                                >\n                                  {isSavingItem ? <Loader2 className=\"w-4 h-4 animate-spin\" /> : <Save className=\"w-4 h-4\" />}\n                                  <span>{isSavingItem ? 'Salvando Item…' : 'Salvar Item no Empenho'}</span>\n""",
)

replace_once(
    'features/empenhos/components/EmpenhosView.tsx',
    """                          type=\"button\"\n                          onClick={handleSaveReviewEmpenho}\n                          className=\"px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow-sm flex items-center gap-1\"\n                        >\n                          Salvar Empenho\n""",
    """                          type=\"button\"\n                          onClick={handleSaveReviewWithFeedback}\n                          disabled={isSavingReview}\n                          aria-busy={isSavingReview}\n                          className=\"px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-wait\"\n                        >\n                          {isSavingReview && <Loader2 className=\"w-4 h-4 animate-spin\" />}\n                          {isSavingReview ? 'Salvando…' : 'Salvar Empenho'}\n""",
)

replace_once(
    'features/empenhos/components/EmpenhosView.tsx',
    '                                      disabled={savingPregao}\n                                      onClick={async () => {',
    '                                      disabled={savingPregao}\n                                      aria-busy={savingPregao}\n                                      onClick={async () => {',
)
replace_once(
    'features/empenhos/components/EmpenhosView.tsx',
    '                                      Salvar Pregão\n',
    '                                      {savingPregao && <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1.5" />}\n                                      {savingPregao ? \'Salvando…\' : \'Salvar Pregão\'}\n',
)

# Notas Fiscais — estados de processamento para comissão e tramitação.
replace_once(
    'features/notas-fiscais/components/NotasFiscaisView.tsx',
    """  const [isSavingInvoice, setIsSavingInvoice] = useState(false);\n  const [consolidatingInvoiceId, setConsolidatingInvoiceId] = useState<string | null>(null);\n  const getInvoiceLocation = (invoice: Invoice): NonNullable<Invoice['localizacaoAtual']> =>\n    invoice.localizacaoAtual || (invoice.tesourariaDate ? 'TESOURARIA' : invoice.comissaoDate ? 'COMISSAO' : 'APROVISIONAMENTO');\n""",
    """  const [isSavingInvoice, setIsSavingInvoice] = useState(false);\n  const [isSavingComissao, setIsSavingComissao] = useState(false);\n  const [processingInvoiceId, setProcessingInvoiceId] = useState<string | null>(null);\n  const [consolidatingInvoiceId, setConsolidatingInvoiceId] = useState<string | null>(null);\n  const getInvoiceLocation = (invoice: Invoice): NonNullable<Invoice['localizacaoAtual']> =>\n    invoice.localizacaoAtual || (invoice.tesourariaDate ? 'TESOURARIA' : invoice.comissaoDate ? 'COMISSAO' : 'APROVISIONAMENTO');\n\n  const runInvoiceTransition = async (invoiceId: string, action: () => Promise<unknown> | unknown) => {\n    if (processingInvoiceId !== null) return;\n    setProcessingInvoiceId(invoiceId);\n    try {\n      await action();\n    } finally {\n      setProcessingInvoiceId(null);\n    }\n  };\n\n  const saveComissaoWithFeedback = async () => {\n    if (isSavingComissao) return;\n    setIsSavingComissao(true);\n    try {\n      await handleSaveComissao();\n    } finally {\n      setIsSavingComissao(false);\n    }\n  };\n""",
)

replace_once(
    'features/notas-fiscais/components/NotasFiscaisView.tsx',
    '                                disabled={isSavingInvoice}\n                                className="h-12 px-6 sm:px-8',
    '                                disabled={isSavingInvoice}\n                                aria-busy={isSavingInvoice}\n                                className="h-12 px-6 sm:px-8',
)

replace_once(
    'features/notas-fiscais/components/NotasFiscaisView.tsx',
    """                      <button\n                        onClick={handleSaveComissao}\n                        className=\"w-full h-11 bg-[#00288e] text-white rounded-xl font-bold text-xs hover:bg-[#1e40af] transition-all flex items-center justify-center gap-2 shadow-md active:scale-95\"\n                      >\n                        <Save className=\"w-4 h-4\" /> Salvar Comissão de Recebimento\n                      </button>\n""",
    """                      <button\n                        onClick={saveComissaoWithFeedback}\n                        disabled={isSavingComissao}\n                        aria-busy={isSavingComissao}\n                        className=\"w-full h-11 bg-[#00288e] text-white rounded-xl font-bold text-xs hover:bg-[#1e40af] transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 disabled:opacity-60 disabled:cursor-wait\"\n                      >\n                        {isSavingComissao ? <Loader2 className=\"w-4 h-4 animate-spin\" /> : <Save className=\"w-4 h-4\" />}\n                        {isSavingComissao ? 'Salvando Comissão…' : 'Salvar Comissão de Recebimento'}\n                      </button>\n""",
)

replace_once(
    'features/notas-fiscais/components/NotasFiscaisView.tsx',
    """                            <select\n                              value={getInvoiceLocation(inv)}\n                              onChange={(event) => handleUpdateInvoiceLocation(inv.id, event.target.value)}\n                              className=\"h-10 px-3 rounded-xl border border-sky-200 bg-white text-xs font-extrabold text-sky-900 outline-none focus:ring-1 focus:ring-sky-500 min-w-[220px]\"\n""",
    """                            <select\n                              value={getInvoiceLocation(inv)}\n                              onChange={(event) => runInvoiceTransition(inv.id, () => handleUpdateInvoiceLocation(inv.id, event.target.value))}\n                              disabled={processingInvoiceId !== null}\n                              aria-busy={processingInvoiceId === inv.id}\n                              className=\"h-10 px-3 rounded-xl border border-sky-200 bg-white text-xs font-extrabold text-sky-900 outline-none focus:ring-1 focus:ring-sky-500 min-w-[220px] disabled:opacity-60 disabled:cursor-wait\"\n""",
)

replace_once(
    'features/notas-fiscais/components/NotasFiscaisView.tsx',
    """                                <button\n                                  onClick={() => handleMarkComissao(inv.id)}\n                                  className=\"mt-1 w-full py-1.5 bg-[#dde1ff] hover:bg-[#00288e] text-[#001453] hover:text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5\"\n                                >\n                                  <Check className=\"w-3.5 h-3.5\" /> Enviar p/ Comissão\n                                </button>\n""",
    """                                <button\n                                  onClick={() => runInvoiceTransition(inv.id, () => handleMarkComissao(inv.id))}\n                                  disabled={processingInvoiceId !== null}\n                                  aria-busy={processingInvoiceId === inv.id}\n                                  className=\"mt-1 w-full py-1.5 bg-[#dde1ff] hover:bg-[#00288e] text-[#001453] hover:text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-wait\"\n                                >\n                                  {processingInvoiceId === inv.id ? <Loader2 className=\"w-3.5 h-3.5 animate-spin\" /> : <Check className=\"w-3.5 h-3.5\" />}\n                                  {processingInvoiceId === inv.id ? 'Enviando…' : 'Enviar p/ Comissão'}\n                                </button>\n""",
)

replace_once(
    'features/notas-fiscais/components/NotasFiscaisView.tsx',
    """                                <button\n                                  onClick={() => handleMarkTesouraria(inv.id)}\n                                  disabled={getInvoiceLocation(inv) !== 'COMISSAO'}\n""",
    """                                <button\n                                  onClick={() => runInvoiceTransition(inv.id, () => handleMarkTesouraria(inv.id))}\n                                  disabled={getInvoiceLocation(inv) !== 'COMISSAO' || processingInvoiceId !== null}\n                                  aria-busy={processingInvoiceId === inv.id}\n""",
)
replace_once(
    'features/notas-fiscais/components/NotasFiscaisView.tsx',
    '                                  <Check className="w-3.5 h-3.5" /> Enviar p/ Tesouraria\n',
    '                                  {processingInvoiceId === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}\n                                  {processingInvoiceId === inv.id ? \'Enviando…\' : \'Enviar p/ Tesouraria\'}\n',
)

# Cronograma — acessibilidade do estado de gravação já existente.
replace_once(
    'features/cronogramas/components/CronogramasView.tsx',
    '                            disabled={isSavingCronograma}\n                            className="px-4 py-2 bg-[#00288e]',
    '                            disabled={isSavingCronograma}\n                            aria-busy={isSavingCronograma}\n                            className="px-4 py-2 bg-[#00288e]',
)

# CSS sistêmico para estados busy/disabled sem alterar layout.
append_once(
    'app/globals.css',
    '/* Bloco 1 UX: feedback de processamento */',
    """
/* Bloco 1 UX: feedback de processamento e prevenção visual de ações duplicadas. */
button:disabled,
select:disabled,
input:disabled,
textarea:disabled {
  cursor: not-allowed;
}

button[aria-busy="true"],
select[aria-busy="true"],
[aria-busy="true"][role="button"] {
  cursor: progress;
}

button[aria-busy="true"] {
  user-select: none;
}

button[aria-busy="true"] .animate-spin {
  animation-duration: 800ms;
}
""",
)

print('Bloco 1 UX aplicado com sucesso.')
