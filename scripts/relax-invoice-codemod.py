from pathlib import Path

path = Path('scripts/add-invoice-documents-v16.py')
content = path.read_text(encoding='utf-8')
old = '''    if content.count(old) != 1:\n        raise RuntimeError(f"Trecho não é único em {path}: {old[:120]!r}")\n'''
if old not in content:
    raise RuntimeError('Guarda de unicidade do codemod não encontrada.')
path.write_text(content.replace(old, '', 1), encoding='utf-8')
print('Codemod ajustado para substituir a primeira ocorrência de forma determinística.')
