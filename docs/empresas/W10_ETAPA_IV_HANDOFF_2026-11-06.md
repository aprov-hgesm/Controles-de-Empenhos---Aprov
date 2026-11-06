# EMPROVEX Empresas — W10 Etapa IV | Integração W15 fiscal (handoff)

**Data:** 06/11/2026  
**Status:** integração de código em PR Draft, QA isolado; **sem merge/deploy, sem emissão fiscal real**.  
**Branch:** `integration/emprovex-empresas-w10-stage4-w15-fiscal-20261106`  
**PR base W10-III:** [#527](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/527) — `d9aa77a5e0c27b77582ecf6742a3358a509e8abb`.  
**W15:** [#529](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/529) — `65faaefacfb182e36111197fa578a6418caff068`.  
**Origem histórica W10-I:** [#520](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/520) — `46af306ea67e2c5d45f8a2af922ef2781e154212`.  
**Memorial:** PR #510; handoffs W10-III e W15.

## Estratégia de base e proveniência

O W15 #529 é **descendente direto** do HEAD W10-III #527. A nova branch W10-IV foi criada do HEAD W15, **sem alterar a PR W15**, conservando exatamente os 8 arquivos de origem W15 (UI, API de navegador, fronteira tenant, testes, tipos, handoff e workflow). Contra o W10-III, a nova PR deve conter **esses 8 arquivos mais o patch integrador W10-IV**. W12/W13/W14 já estavam no W10-III e não foram reimportados ou duplicados.

## Implementação

1. `components/company/CompanyOperationalModule.tsx`: montagem de `FiscalIssuanceWorkspace` na aba existente `notas-fiscais`; o componente recebe o token do usuário autenticado e uma `key` derivada de `session.workspaceId`, para desmontar e limpar o estado fiscal ao trocar de CNPJ. Mantido `FinanceWorkspace` W8 **em seção separada**, com esclarecimento de que lançamento manual não emite NF-e, não atesta e não dá baixa automática.
2. `app/api/company/fiscal/nfe/route.ts`: corrigida a guarda do endpoint de `accountsReceivable:read/write` para `fiscal:read/issue` com autorização live pelo W10; **GET e POST permanecem 503 NFE_INTEGRATION_PENDING** após a guarda. Sem chamadas WLG, reservas de numeração, documentos, mutações ou emissão. O W14 não deve ser desinterditado por um `canIssue` de frontend.
3. `scripts/empresas-w10-stage4-fiscal.test.mjs`: testes determinísticos para montagem, isolamento/remontagem A/B, manutenção do W8, RBAC fiscal, fail-closed da rota, bloqueio de `canIssue`, filtro do histórico e POST único 503.
4. `.github/workflows/emprovex-empresas-w10.yml`: inclui a suíte W15 de **22 cenários** e a regressão W10-IV, além de manter W0–W14, TypeScript, Auth/Firestore Emulator, Core e build. O workflow W15 original também permanece intacto.

## Matriz rigorosa de verificação

| Item | Tipo | Estado |
| --- | --- | --- |
| W15 22 cenários de transporte/isolamento/estados | Node com mock | **A verificar no CI do HEAD W10-IV** |
| W10-IV contrato integrado / endpoint bloqueado | Node e asserções de código | **A verificar no CI do HEAD W10-IV** |
| W1–W14 + W10 / TypeScript | Node e compilação | **A verificar no CI do HEAD W10-IV** |
| Autorização real A/B + revogação, CAS, cadastro segundo CNPJ | Firebase Auth/Firestore Emulator | **A verificar no CI do HEAD W10-IV** |
| Core/Next build | scripts e build CI | **A verificar no CI do HEAD W10-IV** |
| Playwright autenticado desktop/mobile, screenshots e acessibilidade W15 | Browser demo | **SKIPPED — sem harness de identidade empresarial navegador certificado** |
| WLG/SEFAZ real, assinatura XML, download privado W5, eventos fiscais | Provedores externos / storage | **SKIPPED — sem aprovação/licença, segredos e E2E fiscais** |
| Segundo CNPJ comercial e produção | Operação real | **NO-GO** |

**Não confundir**: testes Node do W15 simulam rede; Auth/Firestore Emulator valida backend W10, mas não representa autorização SEFAZ nem Playwright real. Checks antigos da #529 não certificam este HEAD.

## P0 remanescentes antes de qualquer piloto

- Contrato jurídico/técnico SaaS WLG escrito, segregação de `empresaId` e segredos por CNPJ em vault.
- Prova de representação do segundo CNPJ/credenciais; autorização `fiscal:write/approve/issue` em fluxo separado, vinculado a pedido W1, CAS e idempotência.
- XML assinado e protocolo SEFAZ verificados pelo servidor, armazenamento W5 privado e download autenticado `fiscal:download`; não expor URL pública de DANFE/XML.
- Playwright desktop/mobile com usuários empresariais A/B, revogação live, dois CNPJs e regressão visual/acessibilidade; nenhuma captura inventada.
- Liberação expressa do responsável pelo piloto e publicação posterior independente.

## Parecer e rollback

**GO técnico condicionado aos checks verdes do HEAD W10-IV, somente para revisão e QA isolado.**  
**NO-GO para merge, deploy, piloto comercial, WLG ativo, emissão NF-e real, cancelamento/CC-e e dados fiscais reais.**

Rollback imediato: fechar a PR e descartar branch isolada. A `main`, o ambiente produtivo, Firestore Rules, IAM, a infraestrutura Cloud Run, os módulos militares, Almoxarifado, Warehouse e billing permanecem sem mudanças.
