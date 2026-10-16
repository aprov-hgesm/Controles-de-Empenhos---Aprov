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
