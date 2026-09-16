from pathlib import Path

path = Path('features/relatorios/hooks/useDocumentActions.ts')
text = path.read_text(encoding='utf-8')
old = "      const blob = new Blob([bytes], { type: 'application/pdf' });"
new = "      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });"
if text.count(old) != 1:
    raise RuntimeError('Trecho do Blob consolidado não encontrado de forma única.')
path.write_text(text.replace(old, new, 1), encoding='utf-8')

nf_path = Path('features/notas-fiscais/components/NotasFiscaisView.tsx')
nf_text = nf_path.read_text(encoding='utf-8')
old_ws = "                                    getInvoiceLocation(inv) === 'COMISSAO' \n"
new_ws = "                                    getInvoiceLocation(inv) === 'COMISSAO'\n"
if nf_text.count(old_ws) != 1:
    raise RuntimeError('Whitespace residual da condição de localização não encontrado de forma única.')
nf_path.write_text(nf_text.replace(old_ws, new_ws, 1), encoding='utf-8')

print('Blob consolidado e diff hygiene ajustados.')
