from pathlib import Path

path = Path('features/relatorios/hooks/useDocumentActions.ts')
text = path.read_text(encoding='utf-8')
old = "      const blob = new Blob([bytes], { type: 'application/pdf' });"
new = "      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });"
if text.count(old) != 1:
    raise RuntimeError('Trecho do Blob consolidado não encontrado de forma única.')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Blob consolidado ajustado para ArrayBuffer.')
