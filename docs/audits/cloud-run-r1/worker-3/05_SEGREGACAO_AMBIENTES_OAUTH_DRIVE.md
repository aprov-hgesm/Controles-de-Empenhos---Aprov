# W3 — Segregação rigorosa de ambientes, OAuth e Drive

## Evidência da seleção de projeto/banco
lib/firebase.ts:7–20 lê **NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS**, **NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID** e parâmetro de porta; o Firebase config de base é importado de firebase-applet-config.json (projeto de produção codificado em repositório). O Core cliente usa banco **(default)** apenas no modo E2E e banco nomeado configurado em produção (:43–45); Warehouse usa env **NEXT_PUBLIC_EMPROVEX_WAREHOUSE_FIRESTORE_DATABASE_ID** ou emprovex-warehouse (:47–51). Se switches de E2E forem ativados indevidamente, emuladores locais são conectados (:53–58). Em server, lib/server/warehouseAccess.ts:51–64 admite default exclusivamente no ramo EMPROVEX_E2E_SERVER_AUTH; firebaseFounderAuth.ts:16–64 restringe contexto emulator a localhost e prefixo demo-. Isto é proteção parcial, **não prova de homologação separada**.

Variáveis NEXT_PUBLIC_* são embutidas no artefato cliente no build. Usar mesma imagem com valores públicos trocados apenas no Cloud Run runtime **não prova** mudança de projeto Firebase no bundle. Não existe mecanismo de validação cross-env por IAM demonstrado. Futuro fail-closed: artefatos/ambientes com identidade explícita e invariantes de projectId, authDomain, banco Core e Warehouse, origem, Cloud Run service identity e secrets; abortar se teste e produção coincidirem. Não implementar aqui.

## Identidade e OAuth/Drive
- lib/server/firebaseFounderAuth.ts:112–145 valida Firebase ID token; rotas fundadoras exigem provedor Google. Workspaces externos usam provedor password e vínculo em Core via lib/server/warehouseAccess.ts. Auth tokens de usuário não são substituíveis por IAM da instância.
- lib/googleDriveWorkspace.ts:12,187–277 usa scope Google **drive.file**, cliente Google OAuth JS e **NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID**. lib/workspaceDriveRuntime.ts:1–81 mantém token temporário em memória, não em Firestore/localStorage. lib/googleDriveFiles.ts:46–55 envia Bearer do usuário ao Drive. O domínio, JS authorized origins, Firebase authorized domains, callbacks e cliente OAuth real dependem de console externo.
- NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY no lib/firebase.ts:22–40 inicializa reCAPTCHA Enterprise quando habilitado; revisar domínios permitidos, comportamento no Chrome/mobile e preview.
- Backup lógico em lib/workspaceBackup.ts usa operações Firestore cliente e Drive, não backend Cloud Run e não cobre warehouse/*.

## Provas negativas obrigatórias (sem usar dados reais)
1. Build de homologação carrega SOMENTE projectId demo ou projeto de homologação separado; grep sanitizado do bundle verifica projeto, banco, authDomain e OAuth client. Simular variáveis faltantes, misturadas ou trocadas: **falhar fechado**.
2. Runtime de homologação com service identity limitada não consegue ler/gravar bancos ou usuários de produção, mesmo que URL de produção seja enviada intencionalmente (HTTP 403/IAM e negação de domínio); testar os DOIS Firestore nomeados.
3. Firebase Rules no Emulator: login fundador, setor ativo/inativo, token vencido, workspace cruzado e provedor não permitido.
4. OAuth Firebase Login Google e e-mail/senha, consentimento Drive externo, revoke/reconnect, token expiry, logout, pop-up bloqueado, refresh, hostnames temporários; confirmar redirects e JS origins no console antes do cutover.
5. O endpoint GET status da Central **não deve** compor bateria read-only com identidade real, pois pode ajustar claims (W3-R19). Use fixture e inspeção de code path.
6. Garantir que nenhum secret apareça no Docker, logs, Next bundle, NEXT_PUBLIC_, HTML, GitHub workflow ou reporte.

**Status:** projeto teste independente, IAM, authorized origins/redirects, App Check e prova de negação: **NÃO VERIFICÁVEIS nesta auditoria**. Owner: W2+administradores GCP/Firebase/OAuth; testes futuros QA/Auth/Security.