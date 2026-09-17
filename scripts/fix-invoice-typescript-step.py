from pathlib import Path
import json
import os

step = int(os.environ['STEP'])
path = Path('features/empenhos/components/EmpenhosView.tsx')
text = path.read_text(encoding='utf-8')

replacements = {
    1: ('{formatDateOnly(inv.date)}', '{formatDateOnly(inv.issueDate)}'),
    2: ('{inv.dataRecebimentoTermo ? (', '{inv.termoEmissaoDate ? ('),
    3: ('{formatDateOnly(inv.dataRecebimentoTermo)}', '{formatDateOnly(inv.termoEmissaoDate)}'),
    4: ('{inv.dataComissao ? (', '{inv.comissaoDate ? ('),
    5: ('{formatDateOnly(inv.dataComissao)}', '{formatDateOnly(inv.comissaoDate)}'),
    6: ('{inv.dataTesouraria ? (', '{inv.tesourariaDate ? ('),
    7: ('{formatDateOnly(inv.dataTesouraria)}', '{formatDateOnly(inv.tesourariaDate)}'),
    8: ('{inv.nsLiquidacao ? (', '{inv.numeroNS ? ('),
    9: ('{inv.nsLiquidacao}', '{inv.numeroNS}'),
}

if step not in replacements:
    raise SystemExit(f'STEP inválido: {step}')

old, new = replacements[step]
count = text.count(old)
if count != 1:
    raise SystemExit(f'STEP {step}: esperado exatamente 1 uso de {old!r}, encontrado {count}')

path.write_text(text.replace(old, new, 1), encoding='utf-8')
print(f'STEP {step}: {old} -> {new}')
