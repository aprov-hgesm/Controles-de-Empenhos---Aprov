# MOBILE-R1 — CHECKPOINT PÓS-INTEGRAÇÃO 3

Data: 2026-10-03

## Integrador
`feat/central-mobile-r1`

## Último estado operacional certificado
`f11b7bf29f8b3fe9525ff80880f4e0f87cd1c67e`

## Workers
- F: APROVADA / INTEGRADA — HEAD `42954adab43694816262720581abad2bc0761d4c`, PR #239 fechado sem merge direto.
- G: APROVADA / INTEGRADA — HEAD `0b513edf7324e40d7b0a505edfdaf84270301ccf`, PR #242 fechado sem merge direto.
- H: APROVADA / INTEGRADA — HEAD `f30f4dcbb1d03d15230fa4414a7d1b95e231253e`, PR #241 fechado sem merge direto.

## Integração
- PR técnico #243;
- HEAD `e40c80d73cf9c444ec0573503a63af18f141bd11`;
- squash `f11b7bf29f8b3fe9525ff80880f4e0f87cd1c67e`;
- ordem semântica H → F → G.

## Gates
- Application CI #940 SUCCESS;
- Core #227 SUCCESS;
- Recovery #618 SUCCESS;
- Legal #42 SUCCESS;
- Integration 3 SUCCESS;
- Production Build SUCCESS;
- Final TypeScript SUCCESS;
- Diff Hygiene SUCCESS.

## Build
- /central-mobile 5.18 kB / 257 kB;
- /central-mobile/alocar 20.6 kB / 275 kB;
- /central-mobile/conferir 8.81 kB / 260 kB;
- /central-mobile/inventario 16.9 kB / 271 kB;
- /central-mobile/saida 10.2 kB / 265 kB;
- /central-mobile/transferir 6.65 kB / 261 kB;
- Shared First Load 104 kB.

## Jornada combinada
Inventário → mesma identidade física/material → OUTBOUND canônico → consulta/conferência oficial.

Invariantes:
- contagem F sem write direto de saldo;
- ajuste somente por inventário canônico após confirmação;
- G escreve somente por OUTBOUND canônico;
- H permanece read-only;
- mesma posição/material/barcode/lote/saldo/ledger canônicos.

## Schema
Nenhum schema persistente novo.

## APIs
Nenhuma API compartilhada SaaS alterada.

## Guards
Nenhum guard Auth/workspace/sessão/legal/warehouseAccess alterado.

## Package/CI
Novo delta aditivo:
- scripts F/G/H/Integration 3 em package.json;
- gates correspondentes no Application CI.

## Comparação transversal
SaaS observado:
`feat/saas-r1-commercializacao@9a294bc543ec7150b9144ed96e767a161864d72f`.

Idênticos:
- LegalAcceptanceGate;
- workspaceContext;
- platformAccess;
- platformSessionControl;
- warehouse feature flag;
- Firestore Rules;
- warehouse Rules;
- app/layout;
- inventoryRepository;
- outboundRepository.

Deltas:
- CT-01 preexistente: Permissions-Policy para RC;
- WarehouseProtectedSurface preexistente/aceito;
- **novo delta de tooling package/CI**, compatível e não funcional.

## Produção
NÃO ALTERADA.

## Blockers
Nenhum blocker funcional Mobile.
MOBILE-I aguarda decisão do Program Control sobre o novo delta de tooling.

## Risco
BAIXO/MÉDIO CONTROLADO:
- runtime Mobile certificado;
- pendências físicas de câmera/etiqueta continuam para certificação final;
- tooling requer reconciliação antes da próxima barreira global.

## Recomendação
Program Control pode liberar MOBILE-I após aceitar/classificar o delta de tooling package/CI.
Não há necessidade de reabrir F/G/H ou alterar runtime.
