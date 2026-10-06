# EMPROVEX — Central Móvel R1 — Validação da Integração 3

Data: **2026-10-03**

Composição:
- MOBILE-H read-only;
- MOBILE-F inventário canônico;
- MOBILE-G OUTBOUND canônico.

Ordem semântica da composição:
`H → F → G`, do menor para o maior risco mutável.

Superfícies compartilhadas conciliadas semanticamente:
- `WarehouseMobileHome.tsx`;
- `package.json`;
- `.github/workflows/application-ci.yml`.

Jornada cruzada protegida:
```text
posição/material canônicos
→ inventário reconhece o mesmo escopo físico
→ OUTBOUND é preparado para a mesma posição
→ projeção física resultante é lida pela conferência
→ posição correta = CORRETO
→ posição diferente = INCORRETO + alternativa oficial
```

Invariantes:
- inventário salva contagem sem write direto de saldo/ledger;
- INVENTORY_ADJUSTMENT continua no contrato oficial após confirmação;
- OUTBOUND é a única mutação da MOBILE-G;
- H permanece sem mutação;
- PRODUCT/LOCATION/UNKNOWN permanece compartilhado;
- workspace/UG/source of truth permanecem únicos;
- CT-01 não é modificada pela Integração 3.

Esta validação não autoriza produção nem substitui validação física em aparelho real.
