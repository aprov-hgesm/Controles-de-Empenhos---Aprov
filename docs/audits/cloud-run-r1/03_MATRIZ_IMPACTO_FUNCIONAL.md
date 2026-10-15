# Matriz de impacto funcional — testes mandatórios
Snapshot main@2b1241fe3abd. Esta matriz é plano de validação, **não** registro de PASS.

| Área / arquivos principais | Dependência da troca | Risco | Teste de aceite e evidência |
|---|---|---|---|
| Login fundador; components/auth, lib/firebase.ts | authDomain/OAuth/cookies/callback | CRÍTICO | desktop/mobile login/logout, token refresh, rejeitar origem indevida; capturas+logs |
| Acesso externo; lib/server/warehouseAccess.ts e platformIdentity | tokens/Rules/workspace | CRÍTICO | email/senha, Google Drive separado, cross-tenant 403; Emulator+browser |
| Empenhos e fornecedores; features/empenhos e fornecedores | Firestore banco nomeado/SSR | ALTO | CRUD, controles de concorrência e reversão sem escrita em prod |
| Notas fiscais/recebimento; features/notas-fiscais, components/*DocumentActions | Firestore/Drive/PDF | ALTO | criação, upload, readback SHA e cancelamento |
| Relatórios, NS e SAG; features/relatorios | importações PDFs, browsers, timeouts | ALTO | import export, NS idempotente, PDF e longa execução |
| Cronogramas/envios; features/cronogramas | callbacks e Gmail/Drive cliente | ALTO | envio mock, anexos/estado sem duplicar |
| Warehouse cadastro; lib/warehouse/material*.ts, features/warehouse | banco warehouse/Rules | CRÍTICO | leitura, criação e rejeição entre workspaces |
| F05 alocação; app/api/central-depositos/intake-action/route.ts | chave Admin REST/IAM/commit | BLOCKER | commits material+lote+movimento+saldo, replay e falha intermediária |
| F06 transferência; lib/warehouse/mobileTransfer*.ts | concorrência e transações | CRÍTICO | 2 operações simultâneas mesmo key e keys distintas; serialização |
| F09 saída/consumo; lib/warehouse/mobileOutbound*.ts, intake-action | idempotência e direitos | CRÍTICO | rejeitar duplo consumo e negar workspace diferente |
| Inventário/conferência/etiquetas; lib/warehouse/{inventory,labels,barcode}* | Firestore, câmera e printing | ALTO | scanner iOS/Android, impressora e câmera no domínio HTTPS |
| Navegação Operador Móvel; app/operador-movel | redirects e Permissions-Policy | ALTO | roteamento /central-mobile antigo, autenticação, scanner |
| Admin SaaS; app/api/admin/* e components/admin | chave de serviço + auditoria | BLOCKER | provisionar/suspender/reativar usuário teste sem prod; kill switches |
| Faturamento e consumo; lib/server/googleCloudMonitoring.ts | credenciais e cron | ALTO | reportar consumo, registrar once/day, reconciliar banco |
| Backup workspace; lib/workspaceBackup*.ts | Drive e autenticação | ALTO | backup lógico SHA e restauração somente isolada |
| Disaster recovery warehouse | backups nativos | BLOCKER | prova de restauração real dos dois bancos em projeto/ambiente isolado |
| Visual: orbes, loaders, motion, border beam; features/visual-orbs, components/visual | SSR, estáticos e streaming | MÉDIO | E2E desktop/mobile, legibilidade/reduced motion sem regressão |
| HTTP headers, links antigos; next.config.ts | camada hosting/proxy | MÉDIO | status/redirect/câmera/cache/HSTS/TLS equivalentes |
| Saúde; app/api/health/route.ts | probes Cloud Run | MÉDIO | health responde e egress para Firebase medido separadamente |

## Falhas injetadas sem dados reais
Desligamento simulado, cold start, instâncias >=2, fila concorrente, 429/401/403, perda de Drive, Firestore indisponível, timeout, replay com mesma chave, retry scheduler, DNS falho e rollback de revisão. Para cada teste recolher SHA de imagem, banco fake, IDs sintéticos, logs sanitizados, resultado esperado/observado e custo/leitura Firestore. Bloquear release em divergência de saldo, duplicação de movimento, autenticação ou acesso indevido.

## Métrica de equivalência
Medir p50/p95 por fluxo, erros HTTP, quedas de login, tempo de recuperação, consultas Firestore por ação, volume e latência, custo, cold starts e CPU/RAM. Não definir percentual de performance sem baseline real; aceitar apenas metas aprovadas pelo Coordenador, com tolerâncias justificadas.
