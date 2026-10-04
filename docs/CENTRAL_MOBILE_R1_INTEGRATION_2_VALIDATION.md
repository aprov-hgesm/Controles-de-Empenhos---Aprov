# EMPROVEX — Central Móvel R1 — Certificação da Integração 2

Data: **2026-10-03**

Escopo:
```text
MOBILE-E read-only
+ MOBILE-C ALLOCATE oficial
+ MOBILE-D TRANSFER oficial
→ jornada cruzada certificada
```

Jornada mínima do Plano Mestre:
1. alocar quantidade em posição A;
2. consultar A;
3. transferir parte A → B;
4. consultar A e B;
5. preservar total físico/agregado da transferência;
6. alterar somente a distribuição física.

Proteções adicionais:
- classificador PRODUCT/LOCATION/UNKNOWN único entre C e D;
- reader crítico de lotes da D fail-closed;
- limite de 24 lotes preservado;
- MOBILE-E sem escrita;
- C e D sem escrita direta de saldo/ledger.

Esta certificação não substitui validação física em aparelho real nem autoriza produção.
