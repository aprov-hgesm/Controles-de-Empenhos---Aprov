# CLOUD-RUN-R1 / W6 — Revisão técnica independente de W4/W5

**Escopo:** auditoria independente do PR #321 (base #320), voltada a isolamento Firebase, ADC, API real Warehouse e gates de migração. **Sem recursos externos, IAM ou produção.** Este documento registra achados sem forçar o resultado para PASS.

## Artefatos examinados

- W4: `lib/cloudRunIsolation.mjs`, `lib/server/cloudRunManagedToken.mjs`, `instrumentation.ts`.
- W5: `lib/firebaseEnvironment.mjs`, `lib/firebaseRuntimeConfig.ts`, `lib/firebase.ts`, `next.config.ts`, API intake, Auth/JWT, provisionamento, lifecycle, backup, monitoramento/histórico, testes e ci.
- Fluxos: handler real `POST /api/central-depositos/intake-action` e `transferWarehouseStock()` em `lib/warehouse/locationRepository.ts`, F09 saída via repositório e consumo imediato via handler.
- Evidências W5: Application CI #38836001393 PASS e Core Protection #38836001337 PASS no HEAD `dd305184f482ab26e9ea89c030043fbc164dd5c9`.

## Constatações independentes

| ID | Risco/constatação | Severidade | Situação |
|---|---|---|---|
| W6-01 | O handler HTTP fast-path expõe somente `ALLOCATE` e `IMMEDIATE_CONSUMPTION`. F06 transferência usa `transferWarehouseStock` no SDK, com `runTransaction`, não essa rota. Testes HTTP de F05/F09 **não provam F06**. | ALTO | Exigir suíte F06 persistente independente |
| W6-02 | W5 testa resolução pura da configuração e scanner de source, mas **não comprova** que o bundle Next compilado para Cloud Run exclua toda referência do projeto produtivo. `lib/firebaseRuntimeConfig.ts` ainda importa baseline produtiva; o scanner W5 permite esse import exclusivamente no resolvedor. O acesso produtivo continua bloqueado por lógica de seleção, porém a ausência de referência em artefato/cliente precisa ser testada. | ALTO | Build staging negativo + inspeção do artefato, antes de qualquer homologação |
| W6-03 | O interlock W4 `instrumentation.ts` lança `CLOUD_RUN_RUNTIME_NOT_CERTIFIED_R01_R02_R04` quando `K_SERVICE` existe. Portanto, **não há** Cloud Run pronto para iniciar; removê-lo sem gates remotos provariam falso PASS. | BLOCKER | Preservado; liberar só em PR independente após homologação |
| W6-04 | W4 usa metadata server e confirma projectId/e-mail em runtime, mas ainda não há identidade real vinculada e IAM efetivo testado; o projeto EMPROVEX de produção tem outras contas com roles e chaves que **não podem** ser reaproveitadas para QA. | BLOCKER | Projeto QA separado, Service Account nova sem chaves, deny de produção |
| W6-05 | A rota usa REST Google direto, com URLs imutáveis de API Google, sem `FIRESTORE_EMULATOR_HOST` no handler. Testes seguros precisam interceptar transporte em harness **exclusivamente** de teste, validar projeto/database e bloquear rede externa; não colocar fallback para Emulator em produção. | ALTO | Harness real independente |
| W6-06 | Sem prova remota de IAM/Rules, App Check, restrições OAuth, separação Auth, domínio e Storage no alvo, um PASS de CI/Emulator não certifica isolamento de múltiplos tenants. | BLOCKER | Exigir validação em QA isolado |
| W6-07 | Os testes de `IMMEDIATE_CONSUMPTION` não equivalem ao fluxo F09 de saída física multi-linha, que permanece saga sequencial (W3-R20). É obrigatório distinguir, cobrir o fluxo físico completo e falha intermediária. | ALTO | Pendente suíte dedicada / homologação |
| W6-08 | O pipeline principal pode realizar build Next sem aplicar gates staging: build da Vercel é LEGACY. É necessária execução controlada de build com `EMPROVEX_RUNTIME_TARGET=cloud-run-staging`, config QA fictícia e confirmação de guard de inicialização. | ALTO | Pendente |
| W6-09 | A ferramenta Firebase Emulator atual informou, no primeiro ensaio CI W6, aviso de suporte incompleto para múltiplas bases e fallback permissivo de Rules. Validar ambas via REST apenas como prova de persistência sintética; isso **não** certifica Rules nem negação IAM por banco. | MÉDIO | Não usar o teste de fast-path como prova de segurança remota |

## Critérios de independência

A suíte W6 carrega a rota TypeScript real com suas funções de domínio reais; somente envelope NextResponse, sessão e OAuth são substituídos por stubs sintéticos. As requisições REST são redirecionadas de maneira estrita para `127.0.0.1`, em projeto `demo-emprovex-fastpath`; qualquer outro domínio/projeto/banco falha imediatamente, antes de uma chamada de rede. Nenhuma conta Google, JSON privado, dado real ou GCP é usada.

**Escopo limitado:** a prova de gravação no Emulator com `Bearer owner` demonstra lógica/contratos do fast-path, não RBAC/IAM/Rules. O teste de F06 transacional precisa executar `runTransaction` real, não só simulação do plano.

## Decisão independente de migração

**CLOUD-RUN-R1 continua NO-GO.** Um eventual PASS do PR W6 autoriza apenas próxima análise técnica, nunca IAM, deploy, DNS ou cutover. Todos os PRs seguem DRAFT e sem merge.

Handoff:
- **ONDE ESTAMOS:** W4+W5 CI PASS, W6 revisando independentemente e testando persistência.
- **O QUE ESTAMOS FAZENDO:** fechando gaps de teste com Emulator real e documento de IAM.
- **QUEM ESTÁ FAZENDO:** coordenador/revisor independente de W6.
- **O QUE FAZER A SEGUIR:** concluir CI W6; executar F06 transação e saída física F09 separadamente; depois revisão R01/R02/R04/R03 e autorizações Cloud QA.
- **QUEM O FARÁ:** QA e coordenador técnicos; fundador autoriza criação de recursos em etapa futura.

## Encerramento da execução W6 — 2026-10-15

**Resultado técnico: PASS COM LIMITES, CLOUD-RUN-R1 NO-GO.**

- **Prova de integração sintética real:** Firebase Emulator workflow `#38837933261` = PASS, **9/9 testes**; código certificado no commit `0bf71b5ec136685fdd56c2629b75d03f75655de4`.
- **Application CI:** workflow `#38837933621` = **PASS**, `validate-application` + seis release gates 16/17/18/19/20/21 SUCCESS.
- **Core Protection:** workflow `#38837933233` = **PASS**.
- **F05:** handler POST real com Core e Warehouse sintéticos, saldo/intake/ledger/lote gravados, rejeição 403 e conflitos 409, replay idempotente.
- **F09 imediato:** handler POST real gravou consumo sem atualizar o saldo físico já alocado, replay/conflitos 409. **Não testa F09 saída física multi-linha**.
- **F06:** repositório `transferWarehouseStock()` REAL com Firebase SDK `runTransaction`, reposicionamento de estoque, total físico preservado, replay, divergência de chave; PASS.
- **Defeito real detectado e corrigido:** resultado antes do patch F06: `WAREHOUSE_TRANSFER_LOT_INVALID: Lote contém campos fora do contrato warehouse_lot_v1` ao receber lote persistido pelo F05 com campos `createdAt`/`updatedAt`. Patch no `lib/warehouse/locationRepository.ts` substituiu `{...data,id}` por `warehouseCanonicalLotReadInput(id,data)`, com validação estrita mantida. Regressão reproduzida FAIL → PASS usando **mesma suíte** de integração e o Emulator.
- **Limitações explícitas:** credenciais OAuth e sessão autenticada são sintéticas; Emulator avisou suporte incompleto multi-DB / Rules permissivas; logo não há prova de IAM/RBAC ou regras reais por banco. Bundle staging, ADC real, W3-R20, restore e cutover seguem abertos. R01/R02/R04 não encerrados.
- **Homologação real:** plano somente documental em `PLANO_HOMOLOGACAO_ADC_IAM.md`; requer autorização explícita do Fundador, custo e novos recursos no projeto QA separado. Nenhum deploy/merge/dado real/IAM/Vercel alterado.

**Handoff:** Onde estamos — testes integrados 9/9 PASS e CI PASS. O que estamos fazendo — consolidar QA e plano seguro de homologação. Quem faz — Coordenação W6. Próximo — submissão de aprovação para IAM/infra QA após revisão da etapa financeira e segurança. Quem fará — Fundador autoriza, equipe configura e testa sem acesso à produção. **CLOUD RUN NO-GO até H0–H7 certificados.**
