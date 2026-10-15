# Gates objetivos de aceite — CLOUD-RUN-R1
Status inicial de todos: **PENDENTE**. Build, isolamento e assinatura de documentos não implicam aprovação de produção. Auditoria documental ≠ migração liberada.

| Gate | Comprovação obrigatória | Responsável | Condição de bloqueio |
|---|---|---|---|
| G01 baseline | HEAD versionado, superfície inventariada; diffs de PRs pendentes classificados | Auditor/Coordenador | Drift entre main e release alvo |
| G02 container | Build imutável, npm ci, Node/ports/startup/SIGTERM, static/SSR/assets completos | Infra/QA | Erro no runtime ou artefato não reproduzível |
| G03 Auth | Google fundador, email/senha externos, refresh, logout, Drive OAuth, domínios authorized, App Check mobile | Auth/QA | Qualquer falha de login ou redirecionamento |
| G04 Workspaces | Negar leitura/escrita inter-UG; servidor admin não contorna controles de negócio | Security | Cross-tenant possível |
| G05 Firestore | Dois bancos nomeados, IAM mínimo, transações, regras e acesso sem chave JSON permanente testados | Backend/Firebase admin | 403, banco default acidental, privilégios excessivos |
| G06 Warehouse | F05/F06/F09, idempotência, concorrência, replay/timeout/interrupção, reconciliação sem divergência | Warehouse/QA | Saldo/lote/ledger divergente ou duplo movimento |
| G07 Backup | Backups nativos ambos bancos, restore isolado com hashes e reconciliação; auth backup sob credencial testada | Admin/Recovery | Restore não comprovado |
| G08 Preview | Projeto isolado e prova de negação de escrita de produção | Infra/Security | Preview com chave/projeto de produção |
| G09 Browser | Desktop/mobile, câmera, redirects legado, headers de segurança, certificados e todos os visuais | QA/Foundador | Regressão visual/operacional em fluxo crítico |
| G10 Performance | baseline e comparação p95/p99, cold start, >=2 instâncias, SSR/cache, rede/Firestore | Infra/Performance | Degradação fora da tolerância acordada |
| G11 Custos | medições reais, projeção de baixa/média/alta demanda, alertas e controle financeiro | FinOps/Foundador | Fatura desconhecida/sem limite operacional |
| G12 Jobs | Cloud Scheduler autenticação e cron Vercel sem overlap; dia/fuso/retry/replay | Infra/Backend | Dupla execução ou 401/504 |
| G13 Domínio | DNS/SSL/TLS, HTTPS, redirects/OAuth, teste de rollback e propagação | Admin DNS/QA | Rollback inviável ou domínio indisponível |
| G14 CI/CD | Application CI, Core Protection, Recovery Guardrails, Emulator, Browser E2E, SBOM/scan, WIF e aprovação | CI/Security | Bypass de gate ou chave permanente desnecessária |
| G15 Operação | Observabilidade, alertas e playbook incidentes, retenção de logs sem secrets, suporte recovery | Coordenador/Ops | Falha sem diagnóstico/reação |
| G16 Aceite | Evidências anexadas a PR separado; sem BLOCKER/CRÍTICO; decisão expressa do Fundador | Coordenador/Foundador | Ausência de qualquer prova mandatória |

## Evidência mínima por gate
SHA do commit e digest do container, configuração sanitizada do ambiente, data/hora, executor, comandos/sequências de testes, fixture e project IDs de homologação (sem segredos), capturas/logs sanitizados, resultado esperado/real, impacto Firestore, métricas e aprovação humana. Workflows docs-only não disparam Application CI automaticamente; executar explicitamente gates quando código de migração for submetido.

## Critério final
GO = todos os gates obrigatórios PASS documentados + nenhum BLOCKER/CRÍTICO aberto + rollback testado + Fundador autoriza. NO-GO = qualquer falha de integridade/autenticação/segurança/recovery. ESCALATE = lacuna de acesso impede certificação; não inventar PASS.
