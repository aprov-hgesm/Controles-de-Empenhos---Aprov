# EMPROVEX — Central Móvel R1 — Freeze da Onda 2

Data: **2026-10-02**

Este commit marca o **freeze comum da Onda 2** após:
- MOBILE-A integrada;
- MOBILE-B integrada;
- Integração 1 certificada;
- regra permanente SaaS R1 ↔ MOBILE-R1 incorporada ao Memorial;
- reconciliação semântica com `feat/saas-r1-commercializacao` concluída com **PASS**;
- ausência de conflito transversal capaz de bloquear C/D/E.

Branches da Onda 2 devem nascer exatamente do commit que introduz este arquivo:
- `mobile-r1-c-intake-allocation`;
- `mobile-r1-d-transfer`;
- `mobile-r1-e-physical-query`.

Contratos obrigatórios desta onda:
- scanner compartilhado da MOBILE-A;
- namespace físico EPX1 e resolver da MOBILE-B;
- `WarehouseStockPosition`;
- Auth/workspace/UG/sessão/legal vigentes;
- Rules vigentes;
- uma única fonte de verdade para ledger/saldo/intake/transferência;
- online-first;
- nenhuma sincronização cega entre integradoras SaaS e Mobile.

Qualquer worker que tocar domínio compartilhado deve registrar **Impacto SAAS-R1** no handoff.
