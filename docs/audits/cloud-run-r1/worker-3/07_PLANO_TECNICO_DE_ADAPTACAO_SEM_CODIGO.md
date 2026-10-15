# W3 — Plano técnico de adaptação (sem código, sem autorização de migração)

Este é desenho futuro dependente de decisão do Coordenador/Fundador. Não define recursos criados, valor de conta, deployments ou credenciais. Sempre trabalhar em projeto de teste isolado, preservando produção na Vercel.

| Sequência | Alterações futuras propostas (APENAS especificação) | Dependência e critério de aceite |
|---|---|---|
| 0. Inventário | Congelar SHA alvo de main, relacionar PRs ativos e scripts que alterem Warehouse/Auth | G01; cobertura W3 é apenas 7,28% e não substitui testes |
| 1. Segregação | Validar IDs Core/Warehouse e configurações NEXT_PUBLIC_ no build; declarar fail-closed quando env/projeto divergirem | IAM/domínios e dois bancos verificados W2; G04/G08 |
| 2. Identidade | Interface de OAuth access token via ADC/service identity com escopos e teste de permissão; preservar Firebase ID token e authorization por workspace/fundador | IAM mínimo X01/X02; R01/R02; G03/G05 |
| 3. Admin | Refatoração futura dos consumidores de JWT-key: provisioning, lifecycle, auth backup, Monitoring, usage history e billing | negar operações não autorizadas e token 403; G04/G05 |
| 4. Warehouse | Provar F05 REST preconditions, F06 transações/plano de lote, F09 imediato e saga de retirada; falha/retentativa interinstância | Emulator + chamadas reais em homolog isolada; G06 |
| 5. Recuperação | Validar PITR, schedule, READY, isolamento de backups Core e Warehouse e restore sintético com hashes/ledger | responsável Admin Recovery; G07 |
| 6. Runtime | Docker multi-stage, npm ci, Node, standalone/static/public, health/liveness e egress monitorados, crash/restart/SIGTERM | Docker/Cloud Run só após autorização futura; G02/G10/G15 |
| 7. Rede/caches | Trust boundary dos forwarded headers; revisar limite local e classificação cliente/server de memoryReadCache; cache público billing | G09/G10/G15, teste spoof/réplicas |
| 8. Jobs | Cloud Scheduler invocação OIDC protegida e tradução em auth de rota OU contrato de secret gerenciado; idempotência e persistência obrigatória | não coexistir com cron Vercel; G12 |
| 9. Domínio/OAuth | Selecionar Firebase Hosting ou alternativa pelo p95 e teto 60s; configurar authorized domains/origins/links/redirects | comprovação com hostname de teste, sem troca de DNS; G03/G09/G10/G13 |
| 10. Pipeline | GitHub Actions manual + WIF/OIDC, Artifact Registry digest fixo, SBOM/scan e gates críticos exigidos | sem chave permanente nem bypass; G14 |
| 11. Aceite/cutover | QA funcional empenhos/NF/SAG/NS/PDF/Depósito/Operador/visual, custo comparado, rollback de app e recovery de dados separados | todos G01–G16 PASS com provas, aceite humano expresso |

## Critérios objetivos de teste
1. Testes negativos de token (issuer/aud vencido, revogado, projeto indevido), 403 cross-tenant em Core e Warehouse e chamadas admin sem fundador.
2. Prova de imagem com projectId e NEXT_PUBLIC_* corretos antes do deploy; homologação sem qualquer escrita em produção mesmo diante de configuração deliberadamente errada.
3. F05/F06/F09 e retirada multi-linha: replays idênticos/diferentes, mesmas/diferentes chaves, perda do processo depois do commit, concorrência entre 2 instâncias e reconciliação de saldo/lotes/ledger/consumos.
4. Backup lógico vs backup nativo: restore de fixture em projeto isolado, comparação de checksums, medição de RPO/RTO e incidente simulado; sem dados reais.
5. Latência p50/p95/p99, consumo Firestore por operação, cold start, scanner HTTPS, redirects, headers e 60s; comparar custo real e baseline Vercel, sem alegar grátis.
6. Repetição do cron com service identity, secret/OIDC correto, ausência de duplicidade do agendamento, falha da persistência exposta e observabilidade explícita.
7. Health público permanece liveness; readiness/dependências são verificadas por mecanismo autenticado e sem side effects.
8. Gate Application CI: TypeScript atualmente sob budget e next build ignora erros — exigir critério futuro explícito, sem declarar PASS de teste não rodado.

## Artefatos esperados somente após autorização
PR de código separado, Dockerfile/workflows revisados, matriz IAM e dois bancos, manifests não produtivos, relatórios de Emulator/E2E/recovery, digests e gráficos de custo, runbook de cutover/rollback e termo de aceite. **Este Worker não produziu nada disso.**