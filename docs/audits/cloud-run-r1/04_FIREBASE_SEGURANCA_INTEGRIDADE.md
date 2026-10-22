# Firebase, segurança e integridade — P0
**Situação:** código auditado estaticamente; IAM, backup e consoles não auditados. Migração BLOQUEADA.

## Bancos e identidade
Firebase client: lib/firebase.ts obtém getFirestore(app, firebaseConfig.firestoreDatabaseId) para Core e getFirestore(app, 'emprovex-warehouse') para warehouse. firebase.json possui dois bancos nomeados. Uso do (default) no Cloud Run criaria destino incorreto. E2E usa banco (default) explicitamente sob switches de emulador: verificar ausência desses switches nos builds de produção.

Fluxos de alto privilégio:
1. lib/server/sectorProvisioningAdmin.ts exige FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON e assina JWT para Google OAuth; sem variável, SERVER_CONFIGURATION 503. api/central-depositos/intake-action/route.ts obtém getGoogleAccessToken para Firestore REST de **alocação e consumo**, logo ADC puro não funciona hoje.
2. lib/server/firebaseAuthBackup.ts usa chave JSON para Identity Toolkit e Firestore REST; exige revisão de privilégios e segregação.
3. lib/server/googleCloudMonitoring.ts usa chave JSON Firebase/Admin ou dedicated Monitoring, não consulta automaticamente o metadata service; isGoogleCloudMonitoringConfigured retorna false sem essas credenciais.
4. lib/server/globalUsageHistory.ts retorna false quando falta credencial e compromete histórico do cron.
5. lib/server/warehouseAccess.ts verifica Firebase ID token e associa workspace/UG; preservar estritamente este controle ao modernizar tokens de serviço.

## Caminho recomendado (não implementado)
- Conta runtime dedicada, chave zero: Cloud Run Service Identity + Application Default Credentials. Alterar **somente em etapa futura autorizada** a forma de adquirir OAuth access tokens nos módulos acima; não alterar a autorização de domínio por usuário, workspace e banco.
- Permissões de Firestore e Identity Toolkit mínimas e verificadas em IAM; se administração exigir privilégios amplos, separar serviços/contas com trust boundaries e rede/rotas protegidas. Admin SDK pode contornar Rules: testes server-side de isolamento obrigatórios.
- Cloud Monitoring: preferir identidade runtime com permissão de leitura de métricas. Secret Manager apenas para segredos reais; nada em NEXT_PUBLIC_, logs, artefatos ou Dockerfile.
- Cloud Run não deve receber credenciais de produção em preview/homologação; imagens devem diferenciar configs públicas compiladas em build; usar projeto teste/emulador e negar por IAM escrita cross-env.

## Segurança e continuidade
- Cliente Google Drive usa drive.file, tokens efêmeros em memória (lib/workspaceDriveRuntime.ts): não migrar PDFs para disco efêmero por engano.
- lib/server/requestSecurity.ts lê x-vercel-forwarded-for; em novo proxy redefinir a fonte de IP com cadeia de proxies confiáveis. Limite atual é best-effort local: reinício limpa buckets e escala distribui contagem; não declarar proteção DDoS.
- Verificar Auth authorized domains, OAuth redirect URIs, Site Key recaptcha Enterprise/App Check e domínio HTTPS mobile; congelar configurações até homologação.
- Backup lógico de workspace não cobre dados warehouse; só backup nativo preparado. docs/SAAS_R1_OPERACAO_RECUPERACAO.md diz executar recovery:verify para estado externo; restaurar somente isolado, registrar RPO/RTO comprovados e comparar saldos/ledger.
- Programar reconciliação read-only pré/pós em duas bases, snapshots com checksums e trilha imutável. Rollback de código não desfaz escrita em banco; compatibilidade de esquemas precisa ser bilateral.

## Gates obrigatórios
B1: serviços ADC com dois bancos; B2: testes de permissões/negações multi-tenant; B3: simular credencial/403/retry; B4: backup e restore testados em isolamento; B5: F05/F06/F09 concorrência e atomicidade; B6: produção inacessível a preview; B7: tokens nunca expostos. Tudo PENDENTE.

Docs oficiais: https://docs.cloud.google.com/run/docs/securing/service-identity e https://firebase.google.com/docs/auth/web/redirect-best-practices (consultados 2026-10-15).
