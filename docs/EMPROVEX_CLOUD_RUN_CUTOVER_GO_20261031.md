# EMPROVEX — Cutover Vercel → Cloud Run / GO de preparação

**Data:** 31/10/2026. **Decisão do fundador:** prosseguir para migração definitiva, corrigindo não bloqueadores após hospedagem Cloud Run. O comando de troca de DNS NÃO foi autorizado nem executado por estes arquivos.

## Evidência funcional fornecida

- Cloud Run em `southamerica-east1`: build Next.js standalone, GET /api/health e / HTTP 200; IAM real do Firestore 2 autorizados / 3 negados.
- Navegador via Cloud Run proxy: acesso ao operacional, Administração, Minha Assinatura, Central de Depósitos 3D, consulta de material.
- Google Drive OAuth corrigido em configuração de origem; download de Nota de Empenho PASS.
- Escritas reais realizadas no Cloud Run pelo fundador: criação e exclusão de NF, download de PDF de NF; registro de saída e download de ficha de saída. Portanto a antiga exigência de nova bateria de gravações passa a ser dispensada.
- Importante: os testes usaram o projeto Firebase operacional. Isso não dispensa a manutenção das validações multi-tenant; não publicar Firestore Rules nem migrar bancos.

## Fatos técnicos que definem o corte

1. **Cloud Run São Paulo não aceita mapping direto de domínio via recurso preview Cloud Run domain mapping.** Usar Firebase Hosting com rewrite, ou um Global External Application Load Balancer. Para manter custos menores, foi preparado Firebase Hosting isolado, sem tocar o `firebase.json` raiz com regras Firestore.
2. O código tem webhook em `POST /api/billing/portal?action=infinitepay-webhook&token=...`. Nunca substituir o segredo do webhook nem o `INFINITEPAY_ORDER_SECRET`. A origem de produção do checkout é `EMPROVEX_BILLING_PUBLIC_ORIGIN`; seu conteúdo precisa corresponder a `https://emprovex.com.br` ao passar o DNS.
3. O fluxo de checkout exige `INFINITEPAY_API_KEY`, `INFINITEPAY_ORDER_SECRET`, `INFINITEPAY_WEBHOOK_TOKEN`, além dos oito segredos R6, todos já transferidos para Secret Manager versão 1. O novo candidato tem de receber todos os 11 valores por referência **sem registrar seu conteúdo**.
4. A aplicação depende de outras variáveis que não foram parte do lote R4/R6, por exemplo `CRON_SECRET`, `EMPROVEX_SHARED_BILLING_ENABLED`, `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` (com fallback no código) e parâmetros de integração da Vercel. Não presumir equivalência completa sem conferir nomes/estado do ambiente Vercel Production. Autenticação Firebase usa configuração presente no repositório; o Drive já foi testado via localhost.
5. `vercel.json` agenda `GET /api/cron/usage-snapshot` diariamente em `15 9 * * *` (cron UTC). Enquanto Cloud Scheduler não tiver `CRON_SECRET` e OIDC configurados corretamente, **não desativar o cron Vercel** e **não criar um segundo agendamento**. O relatório pode continuar rodando na Vercel temporariamente, como mecanismo isolado.
6. No Cloud Run, `--no-allow-unauthenticated` mantém o candidato privado. O Firebase Hosting HTTP público somente entregará as páginas após liberação deliberada da invocação. Essa liberação deve ocorrer **apenas com domínio/HTTPS e configurações de cobrança checadas**, porque o Cloud Run possui IAM administrativo em bancos operacionais.
7. O Hosting tem timeout máximo de 60 segundos; o contêiner também está configurado para 60 segundos. Fluxos que excedam esse limite precisarão de arquitetura distinta.
8. Vercel e Cloud Run usam os mesmos bancos; não existe migração de dados, somente troca de hospedagem. Não alterar backups, workspaces, e-mail dos clientes, Firestore Rules, Firebase Auth ou Google Drive.

## Arquivos de preparação executáveis

**A.** `ops/cloud-run-production-candidate.ps1`: dry-run por padrão; com `-Create`, monta o **mesmo artefato Docker já homologado** em um novo Cloud Run privado chamado `emprovex-cloudrun-candidate`, com 11 secrets versão 1, sem mudar o staging, o DNS ou o domínio. Verifica SA e referências dos segredos antes de sair.

**B.** `ops/prepare-firebase-hosting-cutover.ps1`: dry-run por padrão; com `-Prepare`, cria ou reutiliza o site separado `emprovex-cloudrun-943599311487.web.app` e publica **apenas Hosting** usando `ops/cloud-run-hosting/firebase.json`; nenhuma Rule implantada. O backend ainda permanece privado, logo o site público não estará operacional antes da liberação do acesso.

**C.** Recurso externo: no console Firebase Hosting adicionar o domínio `emprovex.com.br` ao site acima, registrar/verificar titularidade e preparar DNS/SSL. **Não trocar DNS** antes de conferir o certificado válido, a origem OAuth e o alvo financeiro; registrar TXT/A/CNAME atuais do provedor DNS para rollback.

## GO / NO-GO enxuto para virar DNS

- [ ] Candidato Cloud Run privado responde a `/api/health` e `/` por token IAM.
- [ ] Referências dos 11 segredos conferidas e valores não expostos em logs.
- [ ] Comparação das variáveis de Vercel Production essenciais: assinatura, origem do checkout, pagamentos, cron e integrações. Preservar a política comercial em vigor e VIPs.
- [ ] Site Firebase Hosting preparado, URL e domínio anexados; HTTPS funcionando. Sem expor serviço privado antes do corte.
- [ ] Configuração e DNS anteriores da Vercel documentados para rollback; não apagar projeto Vercel.
- [ ] Acesso público habilitado somente no momento do corte, com autenticação e autorização da aplicação intactas.
- [ ] Após troca, smoke de login/Drive/assinatura, `/api/health`, entrada/saída e webhook com casos controlados; nenhum pagamento real de teste exigido.
- [ ] Vercel permanece funcional como rollback até termos estabilidade e substituição do cron.

**GO para preparar candidato/Hosting**; **NO-GO para troca de DNS sem HTTPS, paridade dos segredos/flags financeiros e rollback**. Não são auditorias fragmentadas: essas ações fazem parte do único cutover operacional.
