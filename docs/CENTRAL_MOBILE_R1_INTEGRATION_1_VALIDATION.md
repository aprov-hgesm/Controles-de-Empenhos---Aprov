# EMPROVEX — Central Móvel R1 — Certificação da Integração 1

Data: **2026-10-02**

Branch técnica de certificação: `mobile-r1-integration-1-certification`
Base exata da validação: `feat/central-mobile-r1@4a65ea928b4b36be6ff6b8e67b4581a575fdd803`

## Escopo

Validar exclusivamente o gate:

```text
scanner
→ classificação EPX1 como LOCATION
→ resolver autoritativo
→ WarehouseStockPosition
```

Sem qualquer movimento de estoque.

## Contratos presentes

- MOBILE-A integrada via PR #221 / squash `19fc6be4a1deb5de44ec6999ef42d1cf6ced576c`;
- MOBILE-B integrada via PR #220 / squash `5edb19812b1121fdf867dc63c787bb2439ae68d5`;
- `EPX1` válido é LOCATION;
- barcode comercial não é posição;
- LOCAL/SUBPOSITION resolvem para `WarehouseStockPosition`;
- DEPOT falha fechado como posição;
- workspace/UG/status/hierarquia são revalidados no repository/resolver;
- integração é read-only;
- nenhuma escrita de ledger/saldo/intake/outbound/inventory.

## Gates específicos

- `npm run test:mobile-r1-scanner`;
- `npm run verify:mobile-r1-platform-scanner`;
- `npm run test:adm-deposito-locations`;
- `npm run test:mobile-r1-integration-1`;
- `npm run verify:mobile-r1-integration-1`;
- TypeScript;
- Production Build;
- Core Protection;
- Diff Hygiene;
- segurança/regressão canônica via Application CI.

## Pendências físicas transferidas

Ainda exigem validação manual:
- header HTTP efetivo de `/central-mobile`;
- câmera real;
- impressão/leitura Code 128 COMPACT/MEDIUM/LARGE.

Essas pendências não autorizam movimento de estoque e permanecem obrigatórias para certificação física/final.
