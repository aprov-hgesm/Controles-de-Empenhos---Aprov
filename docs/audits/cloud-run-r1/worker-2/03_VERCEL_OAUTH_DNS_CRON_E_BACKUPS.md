# CLOUD-RUN-R1 / W2 — Vercel, OAuth, DNS/TLS, cron e backups

**Evidência consultada:** 2026-10-15. **Nenhum painel proprietário foi alterado.** Escopo X03–X08, X12, X15; riscos R03/R04/R05/R06/R11/R17.

## Vercel — limite administrativo comprovado

- A conexão Vercel existente nesta sessão acessou equipe distinta do projeto EMPROVEX; lista filtrada na conta conectada não retornou o projeto.
- A tentativa de GET de projeto/listagem no escopo **aprov-hgesms-projects** retornou **403 Forbidden** (sem autorização à equipe). Não se afirma que projeto inexista; ele está **inacessível por esta conexão**.
- Fato repositório: main/vercel.json contém git.deploymentEnabled:false e cron path /api/cron/usage-snapshot schedule 15 9 * * *. O cron agenda em UTC segundo contrato Vercel usado no PR #316. Estado **real** da programação, Hooks, protection, team, alias, preview, regiões e último deploy: NÃO VERIFICADO.
- Variáveis de interesse **apenas nomes/escopos a consultar**: FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON; CRON_SECRET; Monitoring credential names; NEXT_PUBLIC_*. **NÃO consultar nem copiar os valores.**

**Ação mínima do titular:** abrir projeto no painel Vercel correto, registrar nomes e targets de env; em Settings/Deployment Protection, Domains, Git/Deploy Hooks e Cron Jobs, obter estado/escopo/URLs sanitizados; em Deployments, registrar SHA/data/state e alias produção. Sem salvar tokens, session cookies ou valores.

## OAuth/Auth/App Check — X06/X07

REPO indica Firebase Auth e OAuth Google Drive independente; configuração de client/authDomain e domínios é dependência de runtime/build. Consultar **somente metadados** em Firebase Authentication > Settings/Authorized domains, Google Cloud > APIs & Services > Credentials/OAuth Clients, Firebase App Check; listar origens/redirect URIs relevantes (canônico emprovex.com.br, preview e possível URL temporária), scopes Drive autorizados, política App Check/reCAPTCHA e enforcement por aplicativo. Sanitizar IDs e nunca revelar client secret/site secret. Alterar console **somente após autorização em fase futura**. Testes browser serão G03/G09, não foram executados.

## DNS/TLS e rollback — X08/X15

Sem acesso administrativo a DNS/registrar. Pendente: registrar e titular, NS, A/AAAA/CNAME, TXT (sem revelar valores de verificação), CAA, www, TTL, wildcard, redirecionamentos, certificado e HSTS; domínio canônico emprovex.com.br. Manter export sanitizado da zona/aliases e procedimento de reversão para Vercel. Histórico e capacidade real de editar zona são provas futuras. Não houve leitura de zona completa nem troca de registro, TLS, alias ou configuração Auth. O plano W1 de rollback é PROPOSTO, não ensaio.

## Cron — estado certo e lacunas

- **Configurado no código:** GET /api/cron/usage-snapshot; 09:15 UTC diário por vercel.json.
- **Autorização no código:** handler depende de Authorization Bearer CRON_SECRET, conforme PR #316; Cloud Scheduler com OIDC **não satisfaz automaticamente** esse contrato.
- **Não verificado:** se cron Vercel executa em produção, se há outro cron/Scheduler, webhooks ou retry com duplicação, e a última observação persistida.
- **Conduta futura:** desenhar autenticação do job, idempotência por data, transição de proprietário do cron numa única janela e plano de rollback exclusivo. NESTA auditoria não disparar URL, não pausar Vercel, não criar Scheduler.

## Backups e recuperação — X05

- **Conhecido no runbook:** backup lógico workspace cobre entidades Core selecionadas em Drive (missing-only) e **não cobre** dados logísticos Warehouse; backup nativo dos dois bancos está descrito como política preparada que requer verificação externa.
- **Sem prova:** agendas realmente habilitadas por banco, READY, retenção, proteção contra exclusão, região, status do snapshot, última execução, incidente de restore, RPO/RTO real, reconciliação lote/saldo/ledger.
- **Procedimento read-only do titular:** Firestore Databases > banco Core nomeado e emprovex-warehouse > Disaster Recovery/Scheduled Backups: registrar (sem payload) periodicidade, retenção, timestamps/status de backups existentes. Se optar por usar recovery:verify, somente com verificação de que é read-only e credenciais locais adequadas, nunca com restauração; W2 não executou.
- **Limite crítico:** backup marcado READY não é prova de restore. Restaurar **somente em novo banco/projeto isolado**, numa fase posterior explicitamente autorizada e com comparação de hashes, saldos, lotes, ledger e invariantes.

Fontes internas: main/vercel.json, main/docs/SAAS_R1_OPERACAO_RECUPERACAO.md, PR #316 docs 04, 06, 09 e 11. Referência oficial para restore em banco novo: https://firebase.google.com/docs/firestore/backups ; limite Firebase Hosting→Cloud Run 60 s: https://firebase.google.com/docs/hosting/cloud-run .

**Resultado:** verificação real dos consoles Vercel, OAuth, DNS e backups bloqueada por acesso; não declarar PASS.
