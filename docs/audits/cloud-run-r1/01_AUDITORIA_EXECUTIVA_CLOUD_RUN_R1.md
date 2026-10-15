# CLOUD-RUN-R1 — Auditoria executiva (Worker 1)
Data: 2026-10-15. Baseline imutável de investigação: main@2b1241fe3abd96c67766caf065d24a4b2a223b98. Escopo: repositório e documentação oficial, sem acesso administrativo à Vercel/Firebase/GCP/DNS. Status: **AUDITORIA DOCUMENTAL PARCIAL — EVIDÊNCIAS EXTERNAS PENDENTES; MIGRAÇÃO BLOQUEADA**.

## Conclusão
A transição Vercel → Cloud Run é arquiteturalmente plausível, **não comprovada**. O repositório tem Next.js 15.5.24/React 19/Node 20 no CI e output standalone, mas serviços administrativos e o fast-path logístico dependem de chave JSON estática. O serviço de observabilidade também depende de chave JSON; não existe prova de que a identidade gerenciada Cloud Run funcione com o código atual. É proibido mudar DNS, banco, autenticação ou deploy antes dos gates.

## Evidências determinantes
- package.json linhas 247–278; next.config.ts linhas 3–65: SSR/Next standalone, cabeçalhos globais, redirects móveis e permissões de câmera; build ignora erros TypeScript e ESLint.
- firebase.json linhas 2–10, firebase-applet-config.json e lib/firebase.ts linhas 43–52: dois bancos nomeados no mesmo projeto Firebase (principal + emprovex-warehouse); não substituir por banco (default).
- lib/server/sectorProvisioningAdmin.ts linhas 120–217: credencial JSON exigida para token de servidor; app/api/central-depositos/intake-action/route.ts linhas 1158–1173: fast-path de alocação/consumo depende desse token.
- lib/server/firebaseAuthBackup.ts linhas 65–105; lib/server/googleCloudMonitoring.ts linhas 113–175; lib/server/globalUsageHistory.ts linhas 27–106: outros caminhos dependentes de chaves ou tokens assinados.
- lib/server/requestSecurity.ts linhas 68–87 e 123–140: leitura de x-vercel-forwarded-for e buckets locais por processo, não limitação distribuída.
- vercel.json linhas 3–11: cron diário 09:15 UTC e auto-deploy Git desabilitado. app/api/cron/usage-snapshot/route.ts linhas 12–43: Bearer CRON_SECRET e escrita de consolidado.
- docs/SAAS_R1_OPERACAO_RECUPERACAO.md: backup lógico não contém warehouse; restauração desse banco depende do backup nativo, cuja ativação precisa de verificação externa.
- .github/workflows/application-ci.yml: teste Vercel manual e orçamento de erro TypeScript; gatilhos de PR ignoram docs/**, portanto PR documental não comprova execução desses gates.
- GET /api/health só retorna status/timestamp (app/api/health/route.ts), não verifica banco nem Drive.
- main retornou protected:false na consulta GitHub em 2026-10-15; revisar rulesets e governança de release antes de autorizar deploy.

## Principais decisões
1. Manter Vercel e emprovex.com.br intactos até homologação paralela isolada, rollback comprovado e aceite formal.
2. **P0:** projetar autenticação ADC para todos os fluxos server-side, preservar controles explícitos de autorização por workspace; confirmar IAM distinto para principal/warehouse; nenhum bypass de Rules inadvertido.
3. **P0:** inspecionar backups nativos/restauração dos dois bancos, níveis de privilégio e impacto financeiro; não tocar dados reais.
4. **P0:** impedir preview/homologação de apontar para produção, inclusive configurações embutidas NEXT_PUBLIC_ durante build.
5. **P1:** validar OAuth Firebase e Drive, middleware/cookies, camera, headers, origens e roteamento sob domínio canônico.
6. **P1:** projetar troca única do cron e reversão. Cron não pode rodar ao mesmo tempo em dois provedores.
7. **P1:** simular múltiplas instâncias, timeouts, custo e rollback; comparar linha de base de latência, taxa de erro, leitura Firestore e comportamento de fluxos F05/F06/F09.

## Resultado da cobertura
Inventário Git completo: 893 arquivos (árvore não truncada); inspeção de arquivos de runtime, APIs principais, workflows, Firebase, Drive, recuperação e documentação de operação. **Não foi executado clone, build local, browser E2E nem acesso administrativo**: ambiente de execução desta auditoria não permite clone do repositório e escopo impede provisionar ou alterar infraestrutura. Portanto esta é uma auditoria estática orientada por evidências, não certificação funcional integral.

Tabela consolidada de 18 riscos em 08_MATRIZ_DE_RISCOS_E_BLOQUEADORES.md: 4 BLOCKER, 2 CRÍTICO, 6 ALTO, 5 MÉDIO, 1 INFORMATIVO. Todas as pendências continuam abertas. Dados não alterados; deploy não executado; código operacional não alterado. A auditoria documental não libera migração.
