# EMPROVEX R1 — Manifesto de certificação global e freeze técnico

Data: 2026-10-09
Escopo: RC R1 SaaS + Central Móvel + Warehouse
Branch congelável: `rc-r1-global-certification-01` (somente após gates desta branch concluírem SUCCESS)
Base funcional candidata: `rc-r1-warehouse-full-integration-01@dec21b86cbbafbb2d7f3d50bd7b9af3371abc740` / PR #279 (DRAFT)
**Estado inicial:** CANDIDATE / certificação final em andamento. Não confundir com GO produtivo.

## 1. Proveniência autoritativa

- RC original SaaS+Mobile/MOBILE-K+Inventory: PR #262, `rc-r1-composition-01@fae9ce6aed7242e85d53fc8e6470fba4425a8c27`.
- SaaS R1 Final Audit: PR #256, `saas-final-audit-01@4cc5b3797747d4d49591f4a68196e723700daa74`, **reconciliação seletiva** já feita no PR #262; NÃO foi merge completo.
- MOBILE-K: `9f1035ac447d25a8fad0ffbb0b319c31f8ba2ef0` ancestral confirmado da candidata RC.
- Warehouse Rules: PR #273, `firestore.warehouse.rules` blob `e4037e464ddbeed7629076dc7615266f0caafc7c`, coexistindo com `firestore.rules` blob `bc91185f34bcdcb4437a4de1078d1089a09292ba`.
- Warehouse F06 engine: PR #277, `lib/warehouse/locationRepository.ts` blob `17bf8952e3688841c6d92030fc5689a04c3b55d9`.
- Warehouse F05: PR #270; código produtivo `app/api/adm-deposito/intake-action/route.ts` blob `77eb8e14ac3fbdbba8d1721d76fc8e908dc251cd`.
- Warehouse F09: PR #271; código produtivo `lib/warehouse/outboundRepository.ts` blob `256b92ee0d1c0604eee0ef89d30ce329f6d0c9b7`.
- Performance: PR #272; barcode repository blob `042b78076fd37717ff957d5f4ad20eb0c100bf9b`. Cache metadata TTL 30 s, UID/UG/workspace; não é autoridade de saldo.

## 2. Gates da fonte já confirmados no SHA dec21b86cbbafbb2d7f3d50bd7b9af3371abc740

- Warehouse integrado F05/F06/F09/performance: GitHub Actions #37969698455 SUCCESS (F06 original 9/9; +8 adversariais; F05 6/6 e REST real no Emulator; F09 security; performance 16/16+8/8 em mocks).
- Core Protection: #37969742171 SUCCESS.
- Application CI: #37969740703 SUCCESS, com Mobile-K, SaaS final audit, multi-tenant, typecheck, build e Blocks 16–21.
- GitHub Vercel status success **não é smoke humano nem evidência suficiente de Preview autenticado**.

## 3. Gates adicionais obrigatórios neste HEAD final

1. Application CI + Blocks 16–21 SUCCESS e Core Protection SUCCESS;
2. Warehouse RC integrado (F05/F06/F09/performance) SUCCESS, executando código deste HEAD;
3. Legal acceptance Firestore Emulator, guard legal, páginas públicas OAuth, TypeScript/build + hygiene, via workflow próprio do RC;
4. Recovery tooling: testes, recovery:plan **read-only**, backup guard, health, SaaS ops/recovery;
5. SaaS final audit guard, SaaS integration guard e MOBILE-K/integration guard sem alterações produtivas;
6. teste explícito do replay F05 legado (ver risco abaixo), sem alterar runtime.

Classificação final dependente da conclusão de todos os gates no SHA imutável; jamais copiar resultados de outro commit como prova de HEAD novo.

## 4. Registro de riscos e compatibilidade

**Risco R-F05-LEGACY-REPLAY (conhecido e reproduzível):** um movimento F05 gravado com a nota histórica `Alocação direta da Central de Depósitos`, sem o hash `intent:`, é rejeitado como `WAREHOUSE_IDEMPOTENCY_CONFLICT` ao repetir seu operationId. A rejeição é fail-closed: nenhuma segunda gravação, movimento ou débito; porém replays legítimos legados podem exigir tratamento operacional assistido. NÃO declarar esse replay funcionalmente compatível, nem aprovar piloto envolvendo essa situação sem decisão explícita e smoke. O canário de teste preserva o código produtivo e evidencia a limitação.

**Risco R-RULES-BUDGET:** o budget de 1000 expressões pode ser atingido; o motor F06 executa reconciliação restrita somente com prova de servidor. Custo/latência desse ramo excepcional ainda não medidos em dispositivos reais ou faturamento.

**Risco R-SAAS-ONBOARDING:** `warehouseAccess` pode ser materializado somente no lifecycle; contrato de compatibilidade testado no Emulator, onboarding real exige smoke na fase 3.

**Risco R-MOBILE-FISICO:** smartphone, Code128, câmera permissões negadas, scans repetidos, offline/online, NF/alocação, inventário, saída e coerência Desktop/Mobile exigem teste físico humano.

**Risco R-PERF:** resultados simulados não representam leituras faturáveis, p50/p95, lentidão em PCs modestos, custo real.

**Risco R-LEGACY-DATA:** repair Warehouse anterior não foi repetido; Material A possui metadados `UNASSIGNED` históricos, não posição operacional válida. Nenhuma limpeza ou reparo automáticos.

## 5. Natureza do freeze

Este manifesto autoriza, quando os gates do HEAD final passam, **RC TECHNICAL FROZEN / READY FOR PREVIEW VALIDATION**: SHA fixo, sem features novas e apenas correção de blockers por re-freeze formal. Não autoriza merge em `main`, publicação de Rules, Vercel Production, billing/suspensão real ou abertura comercial.

O RC deixa de ser congelado automaticamente se houver novo commit. Preview/HTTPS e testes físicos pertencem à macroação 3; medições/rollback e GO/NO-GO produtivo pertencem à macroação 4.

## 6. Controle de execução

**Onde estamos:** macroação 1 concluída tecnicamente, macroação 2 em certificação do freeze.
**O que fazemos:** fixar manifesto, teste legado e gates globais em branch isolada.
**Quem faz:** Coordenador; Workers anteriores em standby.
**O que fazer a seguir:** acompanhar testes no SHA único, registrar FAIL/PASS e freeze apenas se todas as provas forem verdes.
**Quem fará:** Coordenador audita/certifica; Fundador decide publicação futura.
