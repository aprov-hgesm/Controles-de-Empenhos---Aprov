# CI/CD, tarefas automáticas e domínio — contrato proposto
Nenhuma mudança em infra, GitHub Actions, DNS, ou cron foi efetuada.

## CI/CD
Application CI, Core Protection, Recovery Guardrails e Browser E2E sob demanda devem permanecer. application-ci.yml e core-protection.yml ignoram mudanças somente em docs/**; portanto este PR documental **não é evidência** de todos os gates. Ação D-127 desliga Vercel auto-deploy Git; deve permanecer assim até cutover autorizado e sem deploy duplicado.

Modelo desejado: PR → gates de segurança/domínio/Emulator/código → aprovação manual com GitHub Environment protected → construção de imagem única, digested → autenticacão temporária GitHub OIDC → WIF restrito a repo, ref/ambiente → push Artifact Registry → rollout homologação → browser real → aprovação separada de produção → release controlada → observabilidade/rollback. Não conferir papéis de admin globais sem justificativa. A conta aprov-hgesm proprietária e Moriark colaboradora no GitHub **não conferem automaticamente** acesso a projeto Google Cloud ou Vercel. Matriz de IAM concreta depende de administradores e contas verificadas. main não tinha proteção de branch ativa na consulta inicial: ampliar governança antes de adicionar automação de produção.

## Cron único
Vercel agenda GET /api/cron/usage-snapshot em 15 9 * * * (UTC presumido pela documentação Vercel, confirmar painel). Handler exige Authorization Bearer CRON_SECRET; acessa Cloud Monitoring e escreve observação do dia anterior, com resposta ok/persisted. Cloud Scheduler normalmente usa OIDC para Cloud Run; este OIDC **não passa na checagem CRON_SECRET atual**. Opções futuras: manter segredo rotacionado com invocação HTTP protegida por camada adicional, ou adaptar handler para validar identidade OIDC sob um endpoint protegido e com controle de invocador. Nunca liberar chamada pública sem proteção. Exigir idempotência por data, conferir efeito real de persistGlobalUsageObservation, evitar dois schedulers habilitados, teste retry e fuso. Escolher instante de transição após uma janela de cron e registrar último snapshot.

## Domínio/URL
Produção em https://emprovex.com.br na Vercel; não editar registro ou alias durante auditoria. Inventariar zona DNS/A/AAAA/CNAME/TXT, certificado, CAA/HSTS, wildcard, www, domínios de preview, redirect antigo /adm-deposito e /central-mobile, service workers e links absolutos; simular corte TTL/rollback. Firebase Hosting com rewrite para Cloud Run é candidato, não decisão. Testar Auth authorized domains e redirecionamentos /__/auth/handler, login Google desktop/mobile e Drive independente, App Check recaptcha, headers Camera Permissions-Policy, caches, cookies e Google Search Console.

## Critérios prévios
Gates de qualidade e WIF comprovados; proteção de produção; DNS/SSL/Hosting verificáveis; preview isolado; cron desativado na fonte antiga somente após novo cron aprovado; rollback para Vercel testado, sem modificar Firestore. Alteração de domínio requer janela aprovada pelo Fundador.

Fontes verificadas em 2026-10-15:
https://docs.cloud.google.com/run/docs/triggering/using-scheduler
https://github.com/google-github-actions/auth
https://firebase.google.com/docs/hosting/cloud-run
https://firebase.google.com/docs/auth/web/redirect-best-practices
