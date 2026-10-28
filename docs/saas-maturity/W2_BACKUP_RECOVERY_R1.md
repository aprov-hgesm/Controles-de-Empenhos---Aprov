# EMPROVEX — SAAS MATURITY R1 / WORKER 2
## Engenharia de Backup e Recuperação — entrega de preparação

Data: 27/10/2026 (BRT)
Repositório: aprov-hgesm/Controles-de-Empenhos---Aprov
Branch exclusiva: feat/saas-maturity-w2-backup-recovery-r1
Base congelada da main: 86a775485d4e0761d5baed02dbb275f1a4d132a6
**Status: IMPLEMENTADO EM BRANCH / COMPROVAÇÃO REAL PENDENTE.** Nenhum teste, lint, typecheck, CI, consulta à produção ou restore executado. Main e Vercel intocadas.

## 1. Diagnóstico estático e decisões

Política versionada em ops/firestore-recovery.json: Google Cloud gen-lang-client-0982077967, banco principal ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1 e banco logístico emprovex-warehouse. Objetivos: backup nativo diário, retenção 14 semanas (8.467.200 segundos), PITR e delete protection; RPO-alvo 24h / RTO-alvo 4h, **sem resultado medido ou compromisso de SLA**. A política é código de intenção; não garante que os controles estejam ativos hoje.

Handoff histórico de 02/10/2026: PITR, proteção contra exclusão e backup diário configurados em ambos; zero backups concluídos e nenhum READY naquele instante; zero restore isolado comprovado. Não extrapolar essa evidência para 27/10. A atualização real cabe a recovery:status / recovery:verify pelo Coordenador.

A lacuna principal encontrada no script: restore-plan montava comando de restauração apenas a partir de backup informado, sem verificar origem real, READY, vencimento e existência do destino. O procedimento anterior sugeria copiar o comando diretamente. Isso foi endurecido mantendo o plano offline e adicionando **restore-inspect, somente leitura**, que consulta metadados e falha fechado. A decisão de executar o restore permanece exclusivamente humana.

## 2. Modelo de proteção — três camadas sem duplicação

| Camada | Protege | Limites e recuperação |
| --- | --- | --- |
| A. Drive da própria UG | workspaces/{id}/empenhos, invoices, comissoes, cronogramas, alerts, settings termoRecebimentoCounter e empenhoClasses | Envelope emprovex-workspace-backup v1; SHA-256, compressão opcional, até 30 arquivos; após upload, releitura e conferência; recuperação missing-only por responsável autenticado da própria UG |
| B. Backup nativo Firestore | Todo o estado Firestore de cada banco e seus índices no momento do snapshot, inclusive namespaces das UGs e Warehouse | Backup diário previsto para cada banco, retenção 14w, PITR e delete protection; restaurar em novo banco isolado, jamais sobre original; verificar READY real e reconciliação |
| C. Auth/diretório/configurações | Exportação separada metadata-only de Firebase Auth e diretório global (workspaces, platformAccounts, platformUgIndex, settings/global) no Drive fundador | Geração manual sob acesso founder; inventário para reconstrução, não restauração automática completa de credenciais; reset de senha e reconstrução de configurações externas |

### Dados ausentes da camada lógica e dependências externas

A camada A **não** inclui dados do database emprovex-warehouse: nenhuma exportação lógica operacional da Central de Depósitos foi constatada na implementação atual. O namespace real de lib/warehouse/namespace.ts é warehouse/{workspaceId}/{domínio}/{documentId}, com os domínios:

- Cadastros: materials, depots, locations, settings, lots, barcodes e layouts.
- Auditoria e saldo: movements, balances, locationBalances, inventories e siscofisSnapshots.
- Fluxos: intakes, intakeQueueIndex, queueExclusions, destinations, withdrawals, consumptions e outboundReturns.
- Alertas: alerts.

O 2D/3D depende do layout/croqui efetivamente persistido; não há promessa de reconstruir alterações não gravadas. Os domínios anteriores foram conferidos no mapa de constantes; não se inventou coleção a partir de títulos de interface. A inspeção posterior deve incluir subcoleções comprovadamente existentes, caso haja.

Exclusões lógicas relevantes: bytes de PDFs, configuração documentStorage, tokens OAuth/refresh, slots e revogações de sessão, telemetria, caches, backupLease e settings transitórios. PDFs e anexos permanecem na conta Google autorizada da UG. A camada nativa não restaura arquivos externos, Firebase Auth, secrets da Vercel, credenciais, regras de segurança do Firebase, TTL, nem IAM de configuração. Índices do Firestore ficam no backup nativo; configurações críticas devem ser conferidas após restore. A camada C não contém passwordHash/passwordSalt: contas com senha podem exigir redefinição. Não há restauração automatizada garantida de todos os provedores de identidade.

Nenhum sistema novo de backup, serviço, pacote ou fluxo de cobrança foi introduzido. O painel admin permanece metadados-only; não permite visualizar empenhos/NFs de outra UG. Drive de cada setor continua sob sua conta autorizada, sem cópia indiscriminada ao fundador.

## 3. Mudanças da engenharia nesta branch

- scripts/firestore-recovery.mjs: restauração continua **somente planejada**, nunca executada pelo script. Novo restore-inspect exige projeto e database de origem explícitos; valida resource name do backup, metadados de origem, READY, snapshot, prazo de expiração, prefixo do alvo isolado e inexistência do destino inclusive em registros de databases excluídos; se consulta falha ou o resultado é incompleto, não libera comando como elegível. restore-plan agora avisa expressamente que o backup é NÃO VERIFICADO. Sem alteração do apply e da política de retenção.
- docs/RECUPERACAO_FIRESTORE.md: seleção de backup e procedimento de inspeção, autorização, restore isolado, operação, coleta de amostras e barreiras.
- docs/BACKUP_RECOVERY.md: quatro tipos de incidentes com fonte adequada, limitações, decisões permitidas e proibidas.
- docs/saas-maturity/W2_RECOVERY_EVIDENCE_TEMPLATE.md: registro preenchível para recuperação do principal e do Warehouse, com campos reais marcados NÃO EXECUTADO.
- Este handoff: fontes, limites, etapas e pendências. Memorial Oficial intocado.

## 4. Sequência para certificação REAL pelo Coordenador (NÃO EXECUTAR nesta branch)

1. Fixar janela, responsável autorizado, escopo, projeto e origem; obter uma única leitura atual de recovery:status / recovery:verify. Registrar estado de schedules, PITR, delete protection e pelo menos um READY por database. Confirmar custos de backup, PITR e restore no Billing antes de operações cobradas.
2. Escolher separadamente backup READY do **principal** e backup READY do **Warehouse**. Documentar resource name, origem, região, snapshotTime, expireTime, estado e validade; nunca inferir backups READY pela existência do schedule.
3. Gerar restore-plan com ID novo. Em sessão autorizada executar restore-inspect (somente leitura), conferir saída. Corrigir ou parar se houver divergência. Nenhuma operação de restore automática.
4. Apresentar autorização explícita contendo comando, alvo, controles de isolamento, custo potencial e critério de recusa. Selecionar IDs distintos como emprovex-restore-main-AAAAMMDD e emprovex-restore-warehouse-AAAAMMDD; jamais os IDs originais ou (default).
5. Restaurar cada backup somente após autorização. Guardar timestamp de início, operação retornada, timestamp de término e eventuais falhas; monitorar via gcloud firestore operations list/describe e databases describe.
6. Validar dados de cada banco de maneira independente: contagens e amostras saneadas, vínculo de UG, IDs, referências, integridade e histórico. Para principal, conferir workspaces, platformAccounts, platformUgIndex, settings/global quando presentes, empenhos, invoices, comissoes, cronogramas e alerts. Para Warehouse, checar **todos os domínios reais** do namespace e coerência entre saldos, movements, localização e movimentos de entrada/retirada/consumo/devolução, inventories, validade e layouts persistidos. A conclusão do restore pelo Google não prova os dados.
7. Revisar IAM, Rules, TTL e índices/configuração; não oferecer acesso de cliente ao database restaurado antes de decisão formal. Auth e Drive são verificados por trilhas separadas. Não usar UI de outro workspace para inspecionar dados.
8. Preencher um relatório por banco no template. RPO observado = tempo entre o último ponto de dados recuperados e o momento do incidente escolhido, devidamente comparado; RTO observado = intervalo desde o incidente/início do objetivo de recuperação até o serviço verificado como utilizável, não apenas até o comando de restore concluir. Se não medidos, deixar NÃO EXECUTADO.
9. Classificar PASS apenas com backup correto, restore isolado finalizado, dados comprovados, segurança e vínculo preservados, RPO/RTO registrados (atingidos ou não); FAIL diante de divergência material; INCONCLUSIVO se evidência insuficiente. Validação de um banco não certifica o outro.

Sintaxe gcloud e checklist completo: docs/RECUPERACAO_FIRESTORE.md. Execução em banco isolado pode gerar custos de armazenamento, operações e leituras; evitar repetição desnecessária e excluir o banco de diagnóstico posteriormente somente com autorização separada e política de preservação de evidências.

## 5. Runbook executivo em caso de desastre

| Incidente | Fonte inicial | Deve conferir | Nunca fazer |
| --- | --- | --- | --- |
| Registros de uma UG apagados | Drive da própria UG, checksum, simulação e missing-only | Identidade, workspace, IDs, vínculos e diferenças | Copiar dados de outras UGs ou sobrescrever existentes sem reconciliação |
| Banco financeiro corrompido | Backup nativo do principal READY e restore isolado | Diretório global, empenhos, NFs, comissões, cronogramas e alertas | Reapontar clientes ao banco restaurado sem validação |
| Warehouse indisponível/corrompido | Backup nativo do Warehouse READY e restore isolado | Materiais, locais, layouts, saldos, ledger, consumos, devoluções, inventários | Alterar balances/movements manualmente como remendo |
| Firebase Auth/identidade perdida | Backup metadata-only do fundador e procedimento de reconstrução oficial | UID, providers, vínculo UG, reset de senha, diretório | Restaurar hashes inexistentes, liberar credenciais alheias ou bypass |

Se nenhum backup READY for encontrado, avaliar PITR **conforme disponibilidade real**, backups lógicos por UG para dados cobertos e suporte Google Cloud, preservando dados/evidências. Nunca prometer recuperação completa sem prova.

## 6. Autorização, propriedade e responsabilidade

Os dados do setor pertencem ao setor. Responsável legítimo deve poder recuperar/exportar dados próprios mesmo sem assinatura, sem taxa adicional apenas para entrega desses registros; isso não libera serviços premium, manipulação de documentos, acesso de outra UG, desvios de autenticação ou chaves de terceiros. A inspeção nativa é restrita ao Coordenador e não vira mecanismo de consulta indiscriminada a todos os dados de clientes.

IAM, credenciais e custos permanecem sob controle do Google Cloud; não solicitar chave privada do fundador. Assinatura comercial não aumenta nem reduz as políticas de isolamento. Qualquer promoção para produção, merge, aplicação de Rules, restauração real ou alteração de billing foge desta entrega.

## 7. Matriz de estado

| Elemento | Estado |
| --- | --- |
| Inventário da arquitetura existente | Inspecionado estaticamente |
| Proteção dos dois IDs como destino | Implementada em código, não testada |
| Plano offline e inspeção metadados READY/origem/expiração/destino | Implementados em código, não testados |
| Runbooks de quatro incidentes | Documentados |
| Template de relatório | Preparado |
| Estado atual dos dois schedules, PITR e backup READY | DEPENDENTE DE GOOGLE CLOUD / NÃO COMPROVADO |
| Restore isolado do principal | NÃO EXECUTADO |
| Restore isolado do Warehouse | NÃO EXECUTADO |
| Reconciliação de dados e RPO/RTO medidos | NÃO EXECUTADO |
| Revisão independente, testes e CI | DEPENDENTE DO COORDENADOR |
| Merge na main e Vercel | NÃO EXECUTADOS |

**Declaração de entrega:** IMPLEMENTAÇÃO ENTREGUE — SEM TESTES — SEM CI — RESTORE NÃO EXECUTADO — PRODUÇÃO INALTERADA.

Referências: docs/BACKUP_RECOVERY.md; docs/RECUPERACAO_FIRESTORE.md; docs/SAAS_P_C_RECOVERY_UPTIME_HANDOFF.md; docs/SAAS_R1_OPERACAO_RECUPERACAO.md; lib/warehouse/namespace.ts; lib/server/firebaseAuthBackup.ts; hooks/useWorkspaceBackup.ts; hooks/useFounderAuthBackup.ts; app/admin/backups/page.tsx; ops/firestore-recovery.json.
