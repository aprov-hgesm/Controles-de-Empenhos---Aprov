# EMPROVEX — W2 | Evidência de recuperação nativa (modelo)

**Estado deste arquivo em 27/10/2026: NÃO EXECUTADO.** Duplicar o modelo, um relatório para cada banco, preferencialmente em repositório privado ou registro administrativo restrito. Não adicionar dados privados, nomes pessoais, números de documentos reais, segredos, tokens ou detalhes de movimentação identificáveis.

## 1. Identificação do cenário

| Campo | Valor (preencher após operação real) |
| --- | --- |
| Ambiente e data | NÃO EXECUTADO |
| Projeto Google Cloud | gen-lang-client-0982077967 (política versionada, não validada ao vivo) |
| Cenário | PRINCIPAL / WAREHOUSE — NÃO EXECUTADO |
| Banco de origem | NÃO EXECUTADO |
| Backup — resource name completo | NÃO EXECUTADO |
| Backup — banco de origem comprovado | NÃO EXECUTADO |
| Backup — estado READY / outro | NÃO EXECUTADO |
| Snapshot UTC | NÃO EXECUTADO |
| Expiração UTC | NÃO EXECUTADO |
| Região | NÃO EXECUTADO |
| Banco novo e isolado (ID) | NÃO EXECUTADO |
| Resultado restore-inspect | NÃO EXECUTADO |
| Aprovação explícita e registro restrito | NÃO EXECUTADO |

## 2. Execução e custos

| Campo | Resultado |
| --- | --- |
| Início do incidente simulado / referência de RPO | NÃO EXECUTADO |
| Início da restauração UTC | NÃO EXECUTADO |
| Nome da operação Google Cloud | NÃO EXECUTADO |
| Término da operação UTC | NÃO EXECUTADO |
| Primeiro acesso seguro a dados restaurados UTC | NÃO EXECUTADO |
| Retorno de serviço verificado UTC | NÃO EXECUTADO |
| RPO observado (horas, método e dados) | NÃO EXECUTADO |
| RTO observado (horas, método e dados) | NÃO EXECUTADO |
| Custo estimado (moeda e fonte) | NÃO EXECUTADO |
| Custo observado (moeda e fonte) | NÃO EXECUTADO |
| Desvios e ocorrências | NÃO EXECUTADO |

**Metas internas da política:** RPO <= 24 h e RTO <= 4 h. Não marcar meta atingida sem cálculo e dado verificado. Restaurar backup não significa por si só retorno de operação.

## 3. Evidência de conteúdo recuperado

Registrar apenas contagens agregadas, identificadores técnicos saneados, hashes aplicáveis e amostras sob permissão específica. Não transcrever conteúdo pessoal/financeiro/OM, PDFs ou segredos.

| Controle | Resultado | Diferença / evidência saneada |
| --- | --- | --- |
| Separação de workspaces / UG | NÃO EXECUTADO | NÃO EXECUTADO |
| IDs e referências preservados | NÃO EXECUTADO | NÃO EXECUTADO |
| Principal: workspaces, platformAccounts, platformUgIndex, settings/global (quando presentes) | NÃO EXECUTADO | NÃO EXECUTADO |
| Principal: empenhos, invoices, comissoes, cronogramas, alerts e settings (quando presentes) | NÃO EXECUTADO | NÃO EXECUTADO |
| Warehouse: materials, depots, locations, settings, lots, barcodes, layouts | NÃO EXECUTADO | NÃO EXECUTADO |
| Warehouse: movements, balances, locationBalances, inventories, siscofisSnapshots | NÃO EXECUTADO | NÃO EXECUTADO |
| Warehouse: intakes, intakeQueueIndex, queueExclusions, destinations, withdrawals, consumptions, outboundReturns, alerts | NÃO EXECUTADO | NÃO EXECUTADO |
| Integridade dos movimentos, saldos e posição | NÃO EXECUTADO | NÃO EXECUTADO |
| Layouts e estruturas 2D/3D persistidos | NÃO EXECUTADO | NÃO EXECUTADO |
| Divergências — total e natureza | NÃO EXECUTADO | NÃO EXECUTADO |
| Dados externos não cobertos (Auth, Drive, Rules, TTL, IAM, segredos) | NÃO EXECUTADO | NÃO EXECUTADO |

## 4. Segurança, decisão e responsável

| Campo | Resultado |
| --- | --- |
| Banco original inalterado | NÃO EXECUTADO |
| Banco de recuperação não exposto a clientes | NÃO EXECUTADO |
| Revisão IAM / Rules / TTL | NÃO EXECUTADO |
| Identidades Firebase Auth tratadas separadamente | NÃO EXECUTADO |
| Integridade de logs/histórico de auditoria | NÃO EXECUTADO |
| Decisão objetiva (PASS / FAIL / INCONCLUSIVO) | INCONCLUSIVO — NÃO EXECUTADO |
| Justificativa objetiva | Nenhuma restauração real ou prova de dados foi executada nesta etapa |
| Revisor/Coordenador e referência interna | NÃO EXECUTADO |
| Destino posterior do banco isolado (preservação/encerramento autorizado) | NÃO EXECUTADO |

**PASS**: restore isolado de backup correto concluído, dados verificados, isolamento/segurança comprovados e RPO/RTO medidos, mesmo se metas não atingidas (registrar desvio). **FAIL**: origem errada, corrupção ou ruptura material de integridade/segurança. **INCONCLUSIVO**: evidência ausente ou incompleta. Não misturar as duas bases num único PASS.
